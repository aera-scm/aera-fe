import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Approvals } from './pages';
import type { Case } from './api/types.generated';
import { planEvidence } from './api/plan.fixture';
import './i18n';
const auth = vi.hoisted(() => {
  vi.stubEnv('VITE_DATA_MODE', 'live');
  vi.stubEnv('VITE_API_URL', 'https://api.example.test');
  return { session: vi.fn() };
});
vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: auth.session }));
const id = 'EXC-2026-1101';
const row: Case = {
  caseId: id, type: 'SUPPLIER_DELAY', material: 'LIVE-PART', materialDescription: 'Live material',
  plant: '1030', status: 'AWAITING_APPROVAL', stage: 'APPROVE', planVersion: 1, tier: 2,
  rarUsd: 125, createdAt: '2026-11-01T08:00:00Z', updatedAt: '2026-11-01T08:00:00Z', figures: [],
};
let query: QueryClient;
beforeEach(() => {
  auth.session.mockResolvedValue({ tokens: { idToken: { toString: () => 'test-session' } } });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ case: row, signals: [], ...planEvidence(id) }))));
});
afterEach(() => { cleanup(); query?.clear(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('FR-RTE-07 a live approval tile shows the sourced amount, the time left and the assigned approver', async () => {
  query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={query}><MemoryRouter><Approvals rows={[row]} canApprove/></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByText('38,200 USD')).toHaveAttribute('data-source-ref', 'ratecard:AIR-1');
  expect(screen.getByText(/1 h 1[12] min left/)).toBeVisible();
  expect(screen.getByText('approver@meridian-motors.example')).toBeVisible();
  expect(vi.mocked(fetch).mock.calls.every(([, init]) => (init?.method ?? 'GET') === 'GET')).toBe(true);
});
it('FR-RTE-07 an expired part names no approver on its tile', async () => {
  const evidence = planEvidence(id, '2026-11-01T09:00:00Z');
  evidence.route.parts![1].expired = true;
  vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({ case: row, signals: [], ...evidence })));
  query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={query}><MemoryRouter><Approvals rows={[row]} canApprove/></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByText('Deadline passed; re-verification required')).toBeVisible();
  expect(screen.queryByText('approver@meridian-motors.example')).not.toBeInTheDocument();
});
