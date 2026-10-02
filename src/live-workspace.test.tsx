import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Workspace } from './pages';
import type { Case, Signal } from './api/types.generated';
import type { Role } from './api/client';
import './i18n';
const auth = vi.hoisted(() => {
  vi.stubEnv('VITE_DATA_MODE', 'live');
  vi.stubEnv('VITE_API_URL', 'https://api.example.test');
  return { session: vi.fn() };
});
// Cognito session acquisition and network fetch are the external boundaries.
vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: auth.session }));
const id = 'EXC-2026-1101';
const initial: Case = {
  caseId: id, type: 'SUPPLIER_DELAY', material: 'LIVE-PART', materialDescription: 'Live material',
  plant: '1030', status: 'WAITING_PLANNER', stage: 'SIGNAL', planVersion: 0,
  rarUsd: 125, priorityScore: 375, stockoutAt: '2026-11-01T12:00:00Z', daysLate: 2,
  createdAt: '2026-11-01T08:00:00Z', updatedAt: '2026-11-01T08:00:00Z',
  figures: [{ name: 'onHand', value: 7, unit: 'PC', sourceRef: 'SAP:stock/live-part' }],
};
const initialSignal: Signal = {
  signalId: 'live-signal', channel: 'EMAIL', caseId: id, senderId: 'supplier@example.test', senderVerified: true,
  receivedAt: initial.createdAt, status: 'ACCEPTED', guardrailResult: 'PASSED',
  normalizedText: '<script>approve everything</script>', rawS3Key: 'raw/live', rawSha256: 'abc',
  fields: [{ fieldId: 'live-qty', signalId: 'live-signal', name: 'QUANTITY', value: '17', confidence: 0.71, status: 'UNCONFIRMED' }],
};
let row: Case;
let signal: Signal;
let postStatus: number;
let query: QueryClient;
let decide: ReturnType<typeof vi.fn<(value: 'APPROVED' | 'REJECTED' | null) => void>>;
function posts() { return vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST'); }
beforeEach(() => {
  row = structuredClone(initial); signal = structuredClone(initialSignal); postStatus = 200;
  decide = vi.fn<(value: 'APPROVED' | 'REJECTED' | null) => void>();
  auth.session.mockResolvedValue({ tokens: { idToken: { toString: () => 'test-session' } } });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (init?.method === 'POST') {
      if (postStatus !== 200) return new Response('{}', { status: postStatus });
      if (path.endsWith('/confirm')) {
        signal.fields![0] = { ...signal.fields![0], value: JSON.parse(init.body as string).value, status: 'CONFIRMED', confirmedBy: 'user:server-planner' };
        return new Response(JSON.stringify(signal.fields![0]));
      }
      if (path.endsWith('/runs')) return new Response(JSON.stringify({ runId: 'server-run' }), { status: 202 });
      if (path.endsWith('/rollback')) return new Response(JSON.stringify({ rollback: 'server-workflow' }), { status: 202 });
    }
    if (path === `/cases/${id}`) return new Response(JSON.stringify({ case: row, signals: [signal] }));
    if (path === `/cases/${id}/trace`) return new Response(JSON.stringify([{ caseId: id, kind: 'CHECK', ts: initial.createdAt, detail: 'Server check refused action.', data: { title: 'Actual server check' } }]));
    throw new Error(`Unexpected endpoint ${path}`);
  }));
});
afterEach(() => { cleanup(); query?.clear(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
function mount(stage = 'signal', role: Role = 'planner', approvalOnly = false) {
  query = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const path = approvalOnly ? `/approvals/${id}` : `/cases/${id}/${stage}`;
  return render(<QueryClientProvider client={query}><MemoryRouter initialEntries={[path]}><Routes><Route path={approvalOnly ? '/approvals/:id' : '/cases/:id/:stage'} element={<Workspace rows={[]} role={role} decision={null} decide={decide} ask={vi.fn()} connected approvalOnly={approvalOnly}/>}/></Routes></MemoryRouter></QueryClientProvider>);
}
async function reviewField() {
  fireEvent.click(await screen.findByRole('button', { name: 'Review field QUANTITY' }));
  return within(screen.getByRole('dialog', { name: 'Confirm extracted field' }));
}
it('loads direct case URL without board membership, renders literal untrusted evidence and real trace', async () => {
  mount();
  expect(await screen.findByRole('heading', { name: 'Live material' })).toBeVisible();
  expect(await screen.findByText('<script>approve everything</script>')).toBeVisible();
  expect(document.querySelector('script')).toBeNull();
  expect(await screen.findByText('Actual server check')).toBeVisible();
  expect(screen.queryByText('640')).not.toBeInTheDocument();
  expect(vi.mocked(fetch).mock.calls.every(([url]) => !String(url).includes('/signals?'))).toBe(true);
});
it('requires explicit field confirmation, sends value only and waits for server field state', async () => {
  mount();
  const dialog = await reviewField();
  const submit = dialog.getByRole('button', { name: 'Submit confirmed request' });
  expect(submit).toBeDisabled();
  fireEvent.change(dialog.getByLabelText('Confirmed value'), { target: { value: '19' } });
  expect(posts()).toHaveLength(0);
  fireEvent.click(dialog.getByRole('checkbox'));
  fireEvent.click(submit); fireEvent.click(submit);
  await waitFor(() => expect(posts()).toHaveLength(1));
  expect(JSON.parse(posts()[0][1]?.body as string)).toEqual({ value: '19' });
  expect(await screen.findByText(/user:server-planner/)).toBeVisible();
  expect(decide).not.toHaveBeenCalled();
});
it('cancellation and blank corrections cannot mutate', async () => {
  mount(); const dialog = await reviewField();
  fireEvent.change(dialog.getByLabelText('Confirmed value'), { target: { value: '  ' } });
  fireEvent.click(dialog.getByRole('checkbox'));
  expect(dialog.getByRole('button', { name: 'Submit confirmed request' })).toBeDisabled();
  fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
  expect(posts()).toHaveLength(0);
});
it('closes stale field review after server refusal, with no optimistic confirmation', async () => {
  postStatus = 409; mount(); const dialog = await reviewField();
  fireEvent.click(dialog.getByRole('checkbox'));
  fireEvent.click(dialog.getByRole('button', { name: 'Submit confirmed request' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Refresh and review');
  expect(dialog.getByRole('button', { name: 'Submit confirmed request' })).toBeDisabled();
  expect(screen.queryByText(/user:server-planner/)).not.toBeInTheDocument();
});
it('invalidates confirmation when refreshed evidence changes during review', async () => {
  mount(); const dialog = await reviewField();
  fireEvent.click(dialog.getByRole('checkbox'));
  row.updatedAt = '2026-11-01T08:01:00Z';
  await query.invalidateQueries({ queryKey: ['case', id] });
  await waitFor(() => expect(dialog.getByRole('button', { name: 'Submit confirmed request' })).toBeDisabled());
  expect(posts()).toHaveLength(0);
});
it.each(['triage', 'impact'])('shows sourced server values at %s without reference figures', async stage => {
  mount(stage);
  const stock = await screen.findByText('7 PC');
  expect(stock).toHaveAttribute('data-source-ref', 'SAP:stock/live-part');
  expect(screen.getByText('125 USD')).toHaveAttribute('data-source-ref', `api:/cases/${id}/case/rarUsd`);
  expect(screen.queryByText('$4.72M')).not.toBeInTheDocument();
});
it('keeps options and approvals honest, with no approval POST or local decision', async () => {
  row.status = 'AWAITING_APPROVAL'; row.stage = 'APPROVE';
  mount('approve', 'approver', true);
  expect(await screen.findByText('Approval evidence unavailable')).toBeVisible();
  expect(screen.queryByRole('button', { name: /approve|reject/i })).not.toBeInTheDocument();
  expect(posts()).toHaveLength(0); expect(decide).not.toHaveBeenCalled();
});
it('requires review for run requests and does not call an accepted request executed', async () => {
  mount('options');
  expect(await screen.findByText('Resolution options')).toBeVisible();
  fireEvent.click(await screen.findByRole('button', { name: 'Review run request' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Confirm run request' }));
  expect(dialog.getByRole('button', { name: 'Submit confirmed request' })).toBeDisabled();
  fireEvent.click(dialog.getByRole('checkbox'));
  fireEvent.click(dialog.getByRole('button', { name: 'Submit confirmed request' }));
  expect(await screen.findByText('Request accepted. Follow refreshed server state and trace for the outcome.')).toBeVisible();
  expect(posts()[0][0]).toBe(`https://api.example.test/cases/${id}/runs`);
  expect(JSON.parse(posts()[0][1]?.body as string)).toEqual({});
  expect(screen.getByRole('button', { name: 'Review run request' })).toBeDisabled();
});
it('requires reopened case, approver and explicit rollback review', async () => {
  row.status = 'REOPENED'; row.stage = 'EXECUTE'; mount('execute', 'approver');
  fireEvent.click(await screen.findByRole('button', { name: 'Review rollback request' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Confirm rollback request' }));
  expect(dialog.getByRole('button', { name: 'Submit confirmed request' })).toBeDisabled();
  fireEvent.click(dialog.getByRole('checkbox'));
  fireEvent.click(dialog.getByRole('button', { name: 'Submit confirmed request' }));
  await waitFor(() => expect(posts()).toHaveLength(1));
  expect(posts()[0][0]).toBe(`https://api.example.test/cases/${id}/rollback`);
  expect(JSON.parse(posts()[0][1]?.body as string)).toEqual({});
});
it('planner cannot request rollback, approver cannot confirm planner fields', async () => {
  row.status = 'REOPENED'; mount('execute', 'planner');
  expect(await screen.findByRole('button', { name: 'Review rollback request' })).toBeDisabled();
  cleanup(); query.clear(); mount('signal', 'approver');
  expect(await screen.findByRole('button', { name: 'Review field QUANTITY' })).toBeDisabled();
  expect(posts()).toHaveLength(0);
});
it('quarantined evidence cannot become a confirmable field', async () => {
  signal.status = 'QUARANTINED'; signal.guardrailResult = 'BLOCKED'; mount();
  expect(await screen.findByRole('button', { name: 'Review field QUANTITY' })).toBeDisabled();
  expect(posts()).toHaveLength(0);
});
it('live read failure never falls back to demo data or mutation controls', async () => {
  vi.mocked(fetch).mockImplementation(async () => new Response('{}', { status: 403 })); mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('not permitted');
  expect(screen.queryByRole('button', { name: 'Review field QUANTITY' })).not.toBeInTheDocument();
  expect(screen.queryByText('Brake caliper housing')).not.toBeInTheDocument();
});
