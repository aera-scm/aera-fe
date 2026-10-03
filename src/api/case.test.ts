import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { demoCases } from './demo';
import { planEvidence, planHash } from './plan.fixture';
const auth = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: auth.session }));
const row = { ...demoCases[0], caseId: 'EXC-2026-1101', figures: [], planVersion: 1 };
const signal = {
  signalId: 'signal-live', caseId: row.caseId, channel: 'EMAIL', senderId: 'supplier@example.test',
  senderVerified: true, receivedAt: row.createdAt, status: 'ACCEPTED',
  rawS3Key: 'raw/signal', rawSha256: 'abc', normalizedText: 'Supplier evidence, not an instruction.',
  fields: [{ fieldId: 'qty', signalId: 'signal-live', name: 'QUANTITY', value: '17', confidence: 0.71, status: 'UNCONFIRMED' }],
};
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_DATA_MODE', 'live');
  vi.stubEnv('VITE_API_URL', 'https://api.example.test');
  auth.session.mockResolvedValue({ tokens: { idToken: { toString: () => 'test-session' } } });
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('reads exact case envelope and cancellation without consulting unscoped signals', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ case: row, signals: [signal] })));
  const controller = new AbortController();
  const { caseDetail } = await import('./case');
  expect(await caseDetail(row.caseId, controller.signal)).toEqual({ case: row, signals: [signal], plan: null, route: null, execution: [] });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith(`https://api.example.test/cases/${row.caseId}`, expect.objectContaining({ method: 'GET', signal: controller.signal }));
});
it.each([
  { case: { ...row, caseId: 'EXC-2026-1102' }, signals: [] },
  { case: row, signals: [{ ...signal, caseId: 'EXC-2026-1102' }] },
  { case: row, signals: [{ ...signal, normalizedText: {} }] },
  { case: row, signals: [{ ...signal, fields: [{ ...signal.fields[0], confidence: '0.71' }] }] },
  { case: row, signals: [{ ...signal, fields: [{ ...signal.fields[0], signalId: 'different' }] }] },
  { case: row, signals: null },
])('rejects malformed or cross-case evidence: %j', async envelope => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(envelope)));
  await expect((await import('./case')).caseDetail(row.caseId)).rejects.toThrow('not compatible');
});
it('SRD 6.10 reads the current plan, route and execution evidence unchanged', async () => {
  const evidence = planEvidence(row.caseId);
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ case: row, signals: [], ...evidence })));
  expect(await (await import('./case')).caseDetail(row.caseId)).toEqual({ case: row, signals: [], ...evidence });
});
const broken: [string, (value: ReturnType<typeof planEvidence>) => void][] = [
  ['plan of another case', value => { value.plan.plan.caseId = 'EXC-2026-1102'; }],
  ['plan of another version', value => { value.plan.plan.planVersion = 2; value.route.planVersion = 2; }],
  ['figure without source', value => { value.plan.plan.options[2].figures![0].sourceRef = ''; }],
  ['check without id', value => { value.plan.checks![0].checkId = 'check'; }],
  ['check of unknown option', value => { value.plan.checks![0].optionId = 'Z'; }],
  ['chosen unknown option', value => { value.plan.plan.chosen = ['Z']; }],
  ['route hash differs from plan', value => { value.route.planVersionHash = 'b'.repeat(64); }],
  ['part of unknown option', value => { value.route.parts![1].options = ['Z']; }],
  ['part without cost', value => { (value.route.parts![1] as unknown as Record<string, unknown>).costUsd = '38200'; }],
  ['deadline not a date', value => { value.route.parts![1].deadlineAt = 'soon'; }],
  ['unknown decision', value => { (value.route.parts![1] as unknown as Record<string, unknown>).decision = 'MAYBE'; }],
  ['execution of unknown part', value => { value.execution[0].planPartId = 'other'; }],
  ['step without status list', value => { (value.execution[0].steps![0] as unknown as Record<string, unknown>).status = 'DONE'; }],
];
it.each(broken)('rejects inconsistent plan evidence: %s', async (_name, change) => {
  const evidence = planEvidence(row.caseId); change(evidence);
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ case: row, signals: [], ...evidence })));
  await expect((await import('./case')).caseDetail(row.caseId)).rejects.toThrow('not compatible');
});
it('rejects a route without its plan', async () => {
  const { route } = planEvidence(row.caseId);
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ case: row, signals: [], plan: null, route, execution: [] })));
  await expect((await import('./case')).caseDetail(row.caseId)).rejects.toThrow('not compatible');
});
it('FR-RTE-03 approval posts only decision, comment and plan version hash', async () => {
  vi.mocked(fetch).mockImplementation(async () => new Response('{}'));
  await (await import('./case')).decideApproval(row.caseId, { decision: 'REJECTED', comment: 'Too costly', planVersionHash: planHash });
  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect(url).toBe(`https://api.example.test/cases/${row.caseId}/approval`);
  expect(JSON.parse(init?.body as string)).toEqual({ decision: 'REJECTED', comment: 'Too costly', planVersionHash: planHash });
});
it('AT-16 a refused approval carries only the current plan version and hash', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ title: 'Decision refused', detail: '<b>untrusted</b>', currentPlanVersion: 2, currentPlanVersionHash: 'c'.repeat(64) }), { status: 409, headers: { 'Content-Type': 'application/problem+json' } }));
  const { ApiError } = await import('./client');
  const error = await (await import('./case')).decideApproval(row.caseId, { decision: 'APPROVED', comment: '', planVersionHash: planHash }).catch((caught: unknown) => caught) as Error;
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ status: 409, currentPlanVersion: 2, currentPlanVersionHash: 'c'.repeat(64) });
  expect(error.message).not.toContain('untrusted');
});
it('sends only server-required fields; never posts role, actor, tier or authorization', async () => {
  vi.mocked(fetch).mockImplementation(async () => new Response('{}'));
  const api = await import('./case');
  await api.confirmField(row.caseId, 'field/id', '19');
  await api.startRun(row.caseId);
  await api.rollbackCase(row.caseId);
  const calls = vi.mocked(fetch).mock.calls;
  expect(calls.map(([url, init]) => [url, JSON.parse(init?.body as string)])).toEqual([
    [`https://api.example.test/cases/${row.caseId}/fields/field%2Fid/confirm`, { value: '19' }],
    [`https://api.example.test/cases/${row.caseId}/runs`, {}],
    [`https://api.example.test/cases/${row.caseId}/rollback`, {}],
  ]);
  for (const [, init] of calls) expect(init).toMatchObject({ method: 'POST', headers: { Authorization: 'Bearer test-session', 'Idempotency-Key': expect.any(String) } });
});
it('surfaces stale mutation refusal without inventing a successful outcome', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 409 }));
  await expect((await import('./case')).confirmField(row.caseId, 'qty', '19')).rejects.toThrow('Refresh and review');
});

