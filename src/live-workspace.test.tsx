import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Workspace } from './pages';
import type { Case, Signal } from './api/types.generated';
import type { Role } from './api/client';
import { planEvidence, planHash } from './api/plan.fixture';
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
let evidence: ReturnType<typeof planEvidence> | null;
let conflictHash: string;
let query: QueryClient;
let decide: ReturnType<typeof vi.fn<(value: 'APPROVED' | 'REJECTED' | null) => void>>;
function posts() { return vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST'); }
beforeEach(() => {
  row = structuredClone(initial); signal = structuredClone(initialSignal); postStatus = 200; evidence = null; conflictHash = 'c'.repeat(64);
  decide = vi.fn<(value: 'APPROVED' | 'REJECTED' | null) => void>();
  auth.session.mockResolvedValue({ tokens: { idToken: { toString: () => 'test-session' } } });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (init?.method === 'POST') {
      if (postStatus === 409 && path.endsWith('/approval')) return new Response(JSON.stringify({ title: 'Decision refused', status: 409, currentPlanVersion: 1, currentPlanVersionHash: conflictHash }), { status: 409 });
      if (postStatus !== 200) return new Response('{}', { status: postStatus });
      if (path.endsWith('/approval')) return new Response(JSON.stringify({ decision: JSON.parse(init.body as string).decision, planPartId: 'part-air', caseId: id }));
      if (path.endsWith('/confirm')) {
        signal.fields![0] = { ...signal.fields![0], value: JSON.parse(init.body as string).value, status: 'CONFIRMED', confirmedBy: 'user:server-planner' };
        return new Response(JSON.stringify(signal.fields![0]));
      }
      if (path.endsWith('/runs')) return new Response(JSON.stringify({ runId: 'server-run' }), { status: 202 });
      if (path.endsWith('/rollback')) return new Response(JSON.stringify({ rollback: 'server-workflow' }), { status: 202 });
    }
    if (path === `/cases/${id}`) return new Response(JSON.stringify({ case: row, signals: [signal], ...(evidence ?? { plan: null, route: null, execution: [] }) }));
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
function routed(status: Case['status'] = 'AWAITING_APPROVAL', deadlineAt?: string) {
  row.status = status; row.stage = 'APPROVE'; row.planVersion = 1; row.tier = 2; evidence = planEvidence(id, deadlineAt);
}
function caseReads() { return vi.mocked(fetch).mock.calls.filter(([url, init]) => init?.method === 'GET' && new URL(String(url)).pathname === `/cases/${id}`).length; }
it('FR-UI-07 shows option cards with sourced figures, check reasons and the chosen plan', async () => {
  routed(); mount('options');
  expect(await screen.findByRole('heading', { name: 'C · Move stock from plant 1020' })).toBeVisible();
  expect(screen.getByText('Blocked · V-06')).toBeVisible();
  expect(screen.getByText('Alternate supplier must be APPROVED: supplier 2000111 is PENDING')).toBeVisible();
  expect(screen.getByText('600 PC')).toHaveAttribute('data-source-ref', 'SAP:stock/1020');
  expect(screen.getByText('4,100 USD')).toHaveAttribute('data-source-ref', 'ratecard:STO-1');
  expect(screen.getByText('Chosen plan: C + A')).toBeVisible();
  expect(screen.getByText('600 units')).toHaveAttribute('data-source-ref', `api:/cases/${id}/plan/options/C/coverageUnits`);
  expect(screen.getByText('2026-11-01T13:00:00Z')).toHaveAttribute('data-source-ref', `api:/cases/${id}/plan/options/C/arrival`);
  expect(screen.getAllByText('1240 units').map(item => item.getAttribute('data-source-ref'))).toEqual([`api:/cases/${id}/plan/coverageUnits`, `api:/cases/${id}/plan/options/B/coverageUnits`]);
  expect(screen.getByText('0.91')).toHaveAttribute('data-source-ref', `api:/cases/${id}/plan/confidence`);
  expect(screen.getByText(/consistent/i)).toBeVisible();
  expect(posts()).toHaveLength(0);
});
it('FR-UI-07 says so when no plan is recorded, with no approval controls', async () => {
  row.status = 'AWAITING_APPROVAL'; row.stage = 'APPROVE';
  mount('approve', 'approver', true);
  expect(await screen.findByText('No route is recorded for the current plan version.')).toBeVisible();
  expect(screen.queryByRole('button', { name: /approve|reject/i })).not.toBeInTheDocument();
  cleanup(); query.clear(); mount('options');
  expect(await screen.findByText('No plan is recorded for the current plan version.')).toBeVisible();
  expect(posts()).toHaveLength(0); expect(decide).not.toHaveBeenCalled();
});
it('FR-RTE-02 FR-RTE-08 approval shows both parts, cost, RaR, checks, sources, undo and time left', async () => {
  routed(); mount('approve', 'approver', true);
  expect(await screen.findByText('Tier 1 · executes without approval')).toBeVisible();
  expect(screen.getByText('Tier 2 · awaiting approval')).toBeVisible();
  expect(screen.getAllByText('38,200 USD')[0]).toHaveAttribute('data-source-ref', 'ratecard:AIR-1');
  expect(screen.getByText('125 USD')).toHaveAttribute('data-source-ref', `api:/cases/${id}/case/rarUsd`);
  expect(screen.getAllByText('No blocking check failed on this part')).toHaveLength(2);
  expect(screen.getByText('Not reversible once booked; the freight cost stays.')).toBeVisible();
  expect(screen.getByText(/1 h 1[12] min left/)).toBeVisible();
  expect(screen.getByText('approver@meridian-motors.example')).toBeVisible();
});
it('FR-UI-08 approve needs an explicit confirm and posts only decision, comment and hash', async () => {
  routed(); mount('approve', 'approver', true);
  fireEvent.click(await screen.findByRole('button', { name: 'Review & approve' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Confirm approval' }));
  expect(dialog.getByText('Not reversible once booked; the freight cost stays.')).toBeVisible();
  expect(dialog.getByText('38,200 USD')).toHaveAttribute('data-source-ref', 'ratecard:AIR-1');
  expect(dialog.getByText('125 USD')).toHaveAttribute('data-source-ref', `api:/cases/${id}/case/rarUsd`);
  const submit = dialog.getByRole('button', { name: 'Approve plan part' });
  expect(submit).toBeDisabled();
  fireEvent.click(dialog.getByRole('checkbox'));
  fireEvent.click(submit); fireEvent.click(submit);
  await waitFor(() => expect(posts()).toHaveLength(1));
  expect(posts()[0][0]).toBe(`https://api.example.test/cases/${id}/approval`);
  expect(JSON.parse(posts()[0][1]?.body as string)).toEqual({ decision: 'APPROVED', comment: '', planVersionHash: planHash });
  expect(await screen.findByText('Decision recorded. Follow refreshed server state and trace for the outcome.')).toBeVisible();
  expect(decide).not.toHaveBeenCalled();
});
it('FR-RTE-03 rejection requires a reason', async () => {
  routed(); mount('approve', 'approver', true);
  fireEvent.click(await screen.findByRole('button', { name: 'Reject plan' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Confirm rejection' }));
  fireEvent.click(dialog.getByRole('checkbox'));
  const submit = dialog.getByRole('button', { name: 'Reject plan part' });
  expect(submit).toBeDisabled();
  fireEvent.change(dialog.getByLabelText('Reason (required)'), { target: { value: 'Too costly' } });
  fireEvent.click(submit);
  await waitFor(() => expect(posts()).toHaveLength(1));
  expect(JSON.parse(posts()[0][1]?.body as string)).toEqual({ decision: 'REJECTED', comment: 'Too costly', planVersionHash: planHash });
});
it('FR-RTE-07 an expired part cannot be decided and says so', async () => {
  routed('AWAITING_APPROVAL', '2026-11-01T09:00:00Z'); evidence!.route.parts![1].expired = true;
  mount('approve', 'approver', true);
  expect(await screen.findByText('Deadline passed; re-verification required')).toBeVisible();
  expect(screen.queryByText(/moved to the backup/)).not.toBeInTheDocument();
  expect(screen.queryByText('Assigned approver')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Review & approve' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Reject plan' })).toBeDisabled();
});
it('only an approver can decide; the server still decides', async () => {
  routed(); mount('approve', 'planner');
  expect(await screen.findByRole('button', { name: 'Review & approve' })).toBeDisabled();
  expect(posts()).toHaveLength(0);
});
it('AT-16 a stale approval refreshes and shows the current plan', async () => {
  routed(); postStatus = 409; mount('approve', 'approver', true);
  fireEvent.click(await screen.findByRole('button', { name: 'Review & approve' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Confirm approval' }));
  fireEvent.click(dialog.getByRole('checkbox'));
  const before = caseReads();
  fireEvent.click(dialog.getByRole('button', { name: 'Approve plan part' }));
  expect(await screen.findByText('The plan changed. The current plan is shown; review it before deciding.')).toBeVisible();
  await waitFor(() => expect(caseReads()).toBeGreaterThan(before));
});
it('AT-16 a refusal of the current plan says the decision was refused, not that the plan changed', async () => {
  routed(); postStatus = 409; conflictHash = planHash; mount('approve', 'approver', true);
  fireEvent.click(await screen.findByRole('button', { name: 'Review & approve' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Confirm approval' }));
  fireEvent.click(dialog.getByRole('checkbox'));
  fireEvent.click(dialog.getByRole('button', { name: 'Approve plan part' }));
  expect(await screen.findByText('The decision was refused. The refreshed case shows the current state.')).toBeVisible();
  expect(screen.queryByText(/The plan changed/)).not.toBeInTheDocument();
});
it('FR-UI-10 execute view lists steps, SAP documents, undo and milestones', async () => {
  routed('MONITORING'); mount('execute', 'approver');
  expect(await screen.findByText('4500000777')).toHaveAttribute('data-source-ref', 'SAP:API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder(4500000777)');
  expect(screen.getByText('Undo: DELETE_STO_ITEM')).toBeVisible();
  expect(screen.getByText('undo saved')).toBeVisible();
  expect(screen.getByText('execution completed')).toBeVisible();
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
