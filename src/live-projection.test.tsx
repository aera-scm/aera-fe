import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProjectionPanel } from './projection';
import './i18n';

vi.hoisted(() => { vi.stubEnv('VITE_DATA_MODE', 'live'); vi.stubEnv('VITE_API_URL', 'https://api.example.test'); });
vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: async () => ({ tokens: { idToken: { toString: () => 'token' } } }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const plantRow = { plant: '1030', points: [{ at: '2026-10-04T00:00:00Z', stock: 10 }], stockouts: [], lineStops: [], unitsShort: 0, sourceRefs: ['SAP:stock'] };

it('FR-SIM-03 live what-if edits the plan\'s own transfer option at the case plant; plan of record unchanged', async () => {
  const calls: { path: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    calls.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (path.endsWith('/whatif')) return new Response(JSON.stringify({ caseId: 'EXC-1', optionId: 'A', baseline: { 1030: plantRow }, projection: { 1030: plantRow }, checks: [{ checkId: 'V-07', passed: true, blocking: true, detail: 'ok' }], planOfRecord: { version: 3, unchanged: true } }));
    return new Response(JSON.stringify({ caseId: 'EXC-1', planVersion: 3, option: null, baseline: { 1030: plantRow }, projection: { 1030: plantRow } }));
  }));
  render(<QueryClientProvider client={new QueryClient()}><ProjectionPanel caseId="EXC-1" home="1030" choices={[{ id: 'A', label: 'A: STO', transfer: { qty: 600, fromPlant: '1020' } }, { id: 'B', label: 'B: Air' }]}/></QueryClientProvider>);
  fireEvent.change(await screen.findByLabelText('What-if quantity'), { target: { value: '400' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run what-if' }));
  expect(await screen.findByText(/remains unchanged/)).toBeVisible();
  expect(calls.find(call => call.path.endsWith('/whatif'))?.body).toEqual({ optionId: 'A', params: { qty: 400, fromPlant: '1020' } });
});
