import { fetchAuthSession } from 'aws-amplify/auth';
import type { Case, TraceEvent } from './types.generated';
import { demoCases, demoTrace } from './demo';

export const demoMode = import.meta.env.VITE_DATA_MODE === undefined || import.meta.env.VITE_DATA_MODE === 'demo';
export type Role = 'planner' | 'approver' | 'admin';
export const apiBase = import.meta.env.VITE_API_URL ?? '';

export async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  return requestMethod<T>(body === undefined ? 'GET' : 'POST', path, body, signal);
}

export async function requestPut<T>(path: string, body: unknown): Promise<T> {
  return requestMethod<T>('PUT', path, body);
}

async function requestMethod<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  if (!apiBase || !apiBase.startsWith('https://')) throw new Error('The live API is not configured. Please contact your administrator.');
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) throw new Error('Please sign in again.');
  const response = await fetch(`${apiBase.replace(/\/$/, '')}${path}`, {
    method, signal,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    // Server bodies may contain untrusted data. Report status without echoing them.
    if (response.status === 409 || response.status === 412) throw new ApiError(response.status, 'This case changed. Refresh and review the latest plan before continuing.', await conflict(response));
    if (response.status === 403) throw new ApiError(403, 'Your role is not permitted to perform this action.');
    throw new ApiError(response.status, `The request could not be completed (${response.status}). Please retry.`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

/** Error with the HTTP status and, for a refused approval, only the current plan identity (AT-16). */
export class ApiError extends Error {
  readonly currentPlanVersion?: number;
  readonly currentPlanVersionHash?: string;
  readonly reason?: RefusalReason;
  constructor(readonly status: number, message: string, current: { currentPlanVersion?: number; currentPlanVersionHash?: string; reason?: RefusalReason } = {}) {
    super(message);
    this.currentPlanVersion = current.currentPlanVersion;
    this.currentPlanVersionHash = current.currentPlanVersionHash;
    this.reason = current.reason;
  }
}
export type RefusalReason = 'KILL_SWITCH' | 'ALREADY_DECIDED';
const REFUSALS: Record<string, RefusalReason> = {
  'kill switch enabled or unavailable': 'KILL_SWITCH',
  'approval already decided': 'ALREADY_DECIDED',
};
async function conflict(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  if (!body || typeof body !== 'object') return {};
  const { currentPlanVersion: version, currentPlanVersionHash: hash, detail } = body as Record<string, unknown>;
  return {
    currentPlanVersion: Number.isInteger(version) ? version as number : undefined,
    currentPlanVersionHash: typeof hash === 'string' && /^[0-9a-f]{64}$/.test(hash) ? hash : undefined,
    // Only exact, server-authored reasons are recognised; any other text is never shown.
    reason: typeof detail === 'string' ? REFUSALS[detail] : undefined,
  };
}
export function isCase(value: unknown): value is Case {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<Case>;
  const numeric = [row.rarUsd, row.priorityScore, row.confidence, row.daysLate];
  return typeof row.caseId === 'string' && /^EXC-\d{4}-\d{4,}$/.test(row.caseId)
    && typeof row.material === 'string' && typeof row.plant === 'string'
    && typeof row.status === 'string'
    && ['SIGNAL', 'TRIAGE', 'IMPACT', 'OPTIONS', 'APPROVE', 'EXECUTE'].includes(row.stage ?? '')
    && numeric.every(item => item == null || typeof item === 'number' && Number.isFinite(item))
    && (row.tier == null || [1, 2, 3].includes(row.tier))
    && (row.figures === undefined || Array.isArray(row.figures) && row.figures.every(figure =>
      figure && typeof figure.name === 'string' && typeof figure.sourceRef === 'string' &&
      (typeof figure.value === 'string' || typeof figure.value === 'number' && Number.isFinite(figure.value))))
    && (row.materialDescription == null || typeof row.materialDescription === 'string')
    && (row.poNumber == null || typeof row.poNumber === 'string');
}
export async function cases(signal?: AbortSignal): Promise<Case[]> {
  if (demoMode) return structuredClone(demoCases);
  const result = await request<unknown>('/cases', undefined, signal);
  if (!Array.isArray(result) || !result.every(isCase)) throw new Error('The case response is not compatible with this console.');
  return result;
}
export async function trace(caseId: string, signal?: AbortSignal): Promise<TraceEvent[]> {
  if (demoMode) return caseId === demoCases[0].caseId ? structuredClone(demoTrace) : [];
  const result = await request<unknown>(`/cases/${encodeURIComponent(caseId)}/trace`, undefined, signal);
  if (!Array.isArray(result) || !result.every(item => isTraceEvent(item, caseId))) throw new Error('The trace response is not compatible with this console.');
  return result as TraceEvent[];
}

export function isTraceEvent(value: unknown, caseId: string): value is TraceEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<TraceEvent>;
  return event.caseId === caseId
    && ['AGENT', 'TOOL_CALL', 'TOOL_RESULT', 'CHECK', 'GUARD', 'SYSTEM'].includes(event.kind ?? '')
    && typeof event.ts === 'string' && Number.isFinite(Date.parse(event.ts))
    && (event.eventId === undefined || typeof event.eventId === 'string')
    && (event.detail == null || typeof event.detail === 'string')
    && (event.data === undefined || event.data !== null && typeof event.data === 'object' && !Array.isArray(event.data));
}

export function traceTitle(event: TraceEvent): string {
  return typeof event.data?.title === 'string' ? event.data.title : event.kind.replaceAll('_', ' ').toLowerCase();
}
