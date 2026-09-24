import { type ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useRealtime } from './realtime';

const api = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('./client', () => ({ demoMode: false, request: api.request }));

class Socket {
  static instances: Socket[] = [];
  onopen: (() => void) | null = null;
  onmessage: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => this.onclose?.());
  constructor(readonly url: URL) { Socket.instances.push(this); }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('VITE_WS_URL', 'wss://events.example.test/dev');
  vi.stubGlobal('WebSocket', Socket);
  Socket.instances = [];
  api.request.mockReset().mockResolvedValue({ ticket: 'test-one-use-ticket' });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function mount(caseId?: string) {
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(query, 'invalidateQueries');
  const hook = renderHook(({ target }) => useRealtime(target), {
    initialProps: { target: caseId },
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={query}>{children}</QueryClientProvider>,
  });
  return { ...hook, invalidate };
}

it('FR-UI-03 subscribes to board, refreshes on reconnect and enables polling on disconnect', async () => {
  const hook = mount();
  await act(async () => { await Promise.resolve(); });
  const first = Socket.instances[0];
  expect(hook.result.current).toBe(false);
  act(() => first.onopen?.());
  expect(first.send).toHaveBeenCalledWith(JSON.stringify({ action: 'subscribe', board: true }));
  expect(hook.result.current).toBe(true);
  expect(hook.invalidate).toHaveBeenCalledWith({ queryKey: ['cases'] });
  act(() => first.close());
  expect(hook.result.current).toBe(false);
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(api.request).toHaveBeenCalledTimes(2);
  expect(Socket.instances).toHaveLength(2);
  act(() => Socket.instances[1].onopen?.());
  expect(hook.result.current).toBe(true);
});

it('FR-UI-03 subscribes to selected case and closes old subscription on navigation', async () => {
  const hook = mount('EXC-2026-0914');
  await act(async () => { await Promise.resolve(); });
  const first = Socket.instances[0];
  act(() => first.onopen?.());
  expect(first.send).toHaveBeenCalledWith(JSON.stringify({ action: 'subscribe', caseId: 'EXC-2026-0914' }));
  act(() => first.onmessage?.());
  expect(hook.invalidate).toHaveBeenCalledWith({ queryKey: ['trace'] });
  hook.rerender({ target: 'EXC-2026-0915' });
  await act(async () => { await Promise.resolve(); });
  expect(first.close).toHaveBeenCalledOnce();
  expect(hook.result.current).toBe(false);
  act(() => Socket.instances[1].onopen?.());
  expect(Socket.instances[1].send).toHaveBeenCalledWith(JSON.stringify({ action: 'subscribe', caseId: 'EXC-2026-0915' }));
  hook.unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(api.request).toHaveBeenCalledTimes(2);
});

it('FR-UI-03 retains polling after ticket failure without opening a socket', async () => {
  api.request.mockRejectedValue(new Error('Unavailable'));
  const hook = mount();
  await act(async () => { await Promise.resolve(); });
  expect(hook.result.current).toBe(false);
  expect(Socket.instances).toHaveLength(0);
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(api.request).toHaveBeenCalledTimes(2);
});

it('NFR-SEC-05 refuses insecure WebSocket URLs', async () => {
  vi.stubEnv('VITE_WS_URL', 'ws://events.example.test/dev');
  const hook = mount();
  await act(async () => { await Promise.resolve(); });
  expect(hook.result.current).toBe(false);
  expect(Socket.instances).toHaveLength(0);
  expect(api.request).not.toHaveBeenCalled();
});
