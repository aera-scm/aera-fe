import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { demoCases } from './demo';
const auth = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: auth.session }));
const row = { ...demoCases[0], caseId: 'EXC-2026-1101', figures: [] };
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
  expect(await caseDetail(row.caseId, controller.signal)).toEqual({ case: row, signals: [signal] });
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

