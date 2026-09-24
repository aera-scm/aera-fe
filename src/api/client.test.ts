import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoCases, demoTrace, referenceId } from './demo';

const auth = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: auth.session }));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_DATA_MODE', 'live');
  vi.stubEnv('VITE_API_URL', 'https://api.example.test');
  auth.session.mockResolvedValue({ tokens: { idToken: { toString: () => 'test-session' } } });
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

function respond(value: unknown, status = 200) {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(value), { status }));
}

describe('FR-UI-01 live data boundary', () => {
  it('uses authenticated requests and passes cancellation', async () => {
    respond(demoCases);
    const { cases } = await import('./client');
    const controller = new AbortController();
    expect(await cases(controller.signal)).toEqual(demoCases);
    expect(fetch).toHaveBeenCalledWith('https://api.example.test/cases', expect.objectContaining({
      method: 'GET', signal: controller.signal, headers: { Authorization: 'Bearer test-session' },
    }));
  });
  it('fails closed without an API URL or session', async () => {
    vi.stubEnv('VITE_API_URL', '');
    const { cases } = await import('./client');
    await expect(cases()).rejects.toThrow('not configured');
    expect(fetch).not.toHaveBeenCalled();
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', 'https://api.example.test');
    auth.session.mockResolvedValue({});
    await expect((await import('./client')).cases()).rejects.toThrow('sign in again');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('never silently substitutes demo data after a live failure', async () => {
    respond({ detail: 'server-private-detail' }, 403);
    await expect((await import('./client')).cases()).rejects.toThrow('not permitted');
  });
  it('rejects incompatible case envelopes', async () => {
    respond({ items: demoCases });
    await expect((await import('./client')).cases()).rejects.toThrow('not compatible');
  });
  it('does not enable demo mode for misspelled live configuration', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'lve');
    expect((await import('./client')).demoMode).toBe(false);
  });
  it('returns isolated demo fixtures without network calls', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'demo');
    const { cases, trace } = await import('./client');
    const rows = await cases();
    rows[0].material = 'changed';
    expect((await cases())[0].material).toBe('MAT-48219');
    const events = await trace(referenceId);
    events[0].detail = 'changed';
    expect((await trace(referenceId))[0].detail).not.toBe('changed');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('FR-UI-03 generated trace contract', () => {
  it('accepts backend events without a top-level title or optional eventId', async () => {
    const event = { caseId: referenceId, kind: 'TOOL_RESULT', detail: 'Stock read', ts: '2026-09-14T01:00:00Z' };
    respond([event]);
    const { trace, traceTitle } = await import('./client');
    const events = await trace(referenceId);
    expect(events).toEqual([event]);
    expect(traceTitle(events[0])).toBe('tool result');
    expect(traceTitle(demoTrace[0])).toBe('Supplier signal received');
  });
  it.each([
    { caseId: 'another-case' }, { kind: 'UNTRUSTED' }, { ts: 'invalid' },
    { detail: {} }, { data: [] }, { data: null }, { eventId: 42 },
  ])('rejects incompatible trace data: %j', async change => {
    respond([{ ...demoTrace[0], ...change }]);
    await expect((await import('./client')).trace(referenceId)).rejects.toThrow('not compatible');
  });
  it.each([409, 412])('requires review after conflict %s', async status => {
    respond({}, status);
    await expect((await import('./client')).request('/test', {})).rejects.toThrow('Refresh and review');
  });
});
