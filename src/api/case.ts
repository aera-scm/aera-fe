import { isCase, request } from './client';
import type { Case, CheckResult, ExecutionView, ExtractedField, Figure, Option, PlanPartView, PlanView, RouteView, Signal } from './types.generated';
export type CaseDetail = { case: Case; signals: Signal[]; plan: PlanView | null; route: RouteView | null; execution: ExecutionView[] };
export type ApprovalDecision = { decision: 'APPROVED' | 'REJECTED'; comment: string; planVersionHash: string };
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const date = (value: unknown) => text(value) && Number.isFinite(Date.parse(value));
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const optionalText = (value: unknown) => value == null || typeof value === 'string';
const optionalDate = (value: unknown) => value == null || date(value);
const optionalNumber = (value: unknown) => value == null || number(value);
const optionalBoolean = (value: unknown) => value === undefined || typeof value === 'boolean';
const list = <T>(value: unknown, item: (entry: unknown) => entry is T): value is T[] => Array.isArray(value) && value.every(item);
const hash = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const journal = ['READY', 'PENDING', 'SUCCEEDED', 'REJECTED', 'UNDONE'];
function isField(value: unknown, signalId: string): value is ExtractedField {
  return object(value) && text(value.fieldId) && value.signalId === signalId
    && ['PO_NUMBER', 'MATERIAL', 'QUANTITY', 'DELIVERY_DATE', 'PRICE', 'TRACKING_NUMBER', 'CARRIER_STATUS', 'ETA', 'PO_ITEM'].includes(String(value.name))
    && typeof value.value === 'string' && typeof value.confidence === 'number'
    && Number.isFinite(value.confidence) && value.confidence >= 0 && value.confidence <= 1
    && ['CONFIRMED', 'UNCONFIRMED', 'SAP_MATCHED'].includes(String(value.status))
    && optionalText(value.confirmedBy);
}
function isSignal(value: unknown, caseId: string): value is Signal {
  return object(value) && text(value.signalId) && value.caseId === caseId
    && ['EMAIL', 'WHATSAPP', 'CARRIER', 'MANUAL', 'AGENT', 'LAB'].includes(String(value.channel))
    && typeof value.senderId === 'string' && date(value.receivedAt)
    && optionalBoolean(value.senderVerified) && optionalText(value.normalizedText)
    && optionalText(value.quarantineReason) && optionalText(value.language)
    && (value.status === undefined || ['RECEIVED', 'ACCEPTED', 'QUARANTINED'].includes(String(value.status)))
    && (value.guardrailResult === undefined || ['NOT_SCANNED', 'PASSED', 'BLOCKED'].includes(String(value.guardrailResult)))
    && (value.attachments === undefined || Array.isArray(value.attachments) && value.attachments.every(text))
    && (value.fields === undefined || Array.isArray(value.fields) && value.fields.every(field => isField(field, String(value.signalId))));
}
// FR-IMP-03: every figure the console shows carries its source reference.
const isFigure = (value: unknown): value is Figure => object(value) && text(value.name) && text(value.sourceRef)
  && (typeof value.value === 'string' || number(value.value)) && optionalText(value.unit) && optionalDate(value.readAt);
const isOption = (value: unknown): value is Option => object(value) && /^[A-Z]$/.test(String(value.id)) && text(value.name)
  && Array.isArray(value.actions) && value.actions.length > 0 && value.actions.every(action => object(action) && text(action.type))
  && number(value.coverageUnits) && date(value.arrival) && number(value.costUsd) && text(value.costSourceRef)
  && (value.figures === undefined || list(value.figures, isFigure)) && typeof value.rationale === 'string';
function isPlan(value: unknown, row: Case): value is PlanView {
  if (!object(value) || !object(value.plan)) return false;
  const plan = value.plan;
  if (plan.caseId !== row.caseId || plan.planVersion !== row.planVersion || !list(plan.options, isOption)) return false;
  const ids = plan.options.map(option => option.id);
  const isCheck = (check: unknown): check is CheckResult => object(check) && /^V-\d{2}$/.test(String(check.checkId))
    && typeof check.passed === 'boolean' && typeof check.blocking === 'boolean' && typeof check.detail === 'string'
    && (check.optionId == null || ids.includes(String(check.optionId)));
  return Array.isArray(plan.chosen) && plan.chosen.length > 0 && plan.chosen.every(choice => ids.includes(String(choice)))
    && number(plan.totalCostUsd) && number(plan.coverageUnits) && typeof plan.rationale === 'string'
    && optionalNumber(value.confidence) && (value.checks === undefined || list(value.checks, isCheck))
    && date(value.proposedAt) && optionalDate(value.verifiedAt) && (value.planVersionHash == null || hash(value.planVersionHash))
    && (value.automatedReasoning == null || object(value.automatedReasoning) && text(value.automatedReasoning.status)
      && (value.automatedReasoning.findings === undefined || list(value.automatedReasoning.findings, (finding): finding is string => typeof finding === 'string')));
}
function isRoute(value: unknown, row: Case, plan: PlanView): value is RouteView {
  const ids = plan.plan.options.map(option => option.id);
  const isPart = (part: unknown): part is PlanPartView => object(part) && text(part.planPartId)
    && Array.isArray(part.options) && part.options.length > 0 && part.options.every(option => ids.includes(String(option)))
    && [1, 2, 3].includes(Number(part.tier)) && number(part.costUsd) && optionalNumber(part.confidence)
    && optionalText(part.approverId) && optionalText(part.backupApproverId) && optionalDate(part.deadlineAt) && optionalDate(part.reminderAt)
    && optionalBoolean(part.sampled) && optionalBoolean(part.reminded) && optionalBoolean(part.expired)
    && (part.decision == null || ['APPROVED', 'REJECTED'].includes(String(part.decision))) && optionalText(part.comment) && optionalDate(part.decidedAt)
    && (part.undoSummary === undefined || list(part.undoSummary, (step): step is NonNullable<PlanPartView['undoSummary']>[number] => object(step)
      && ids.includes(String(step.optionId)) && text(step.actionType) && typeof step.reversible === 'boolean' && text(step.undo)));
  return object(value) && value.planVersion === row.planVersion && hash(value.planVersionHash) && value.planVersionHash === plan.planVersionHash
    && [1, 2, 3].includes(Number(value.tier)) && optionalText(value.reason) && date(value.routedAt)
    && (value.parts === undefined || list(value.parts, isPart));
}
function isExecution(value: unknown, route: RouteView): value is ExecutionView {
  const parts = (route.parts ?? []).map(part => part.planPartId);
  return object(value) && parts.includes(String(value.planPartId)) && journal.includes(String(value.status))
    && (value.steps === undefined || Array.isArray(value.steps) && value.steps.every(step => object(step)
      && Number.isInteger(step.index) && text(step.actionType) && text(step.target)
      && (step.status == null || journal.includes(String(step.status))) && optionalText(step.sapDocument) && optionalText(step.sourceRef)
      && optionalText(step.undoType) && optionalBoolean(step.irreversible)))
    && (value.milestones === undefined || Array.isArray(value.milestones) && value.milestones.every(milestone => object(milestone) && text(milestone.type) && date(milestone.ts)));
}
export async function caseDetail(caseId: string, signal?: AbortSignal): Promise<CaseDetail> {
  const result = await request<unknown>(`/cases/${encodeURIComponent(caseId)}`, undefined, signal);
  if (!object(result) || !isCase(result.case) || result.case.caseId !== caseId
    || !date(result.case.updatedAt) || !date(result.case.createdAt)
    || !optionalText(result.case.activeRunId) || (result.case.stockoutAt != null && !date(result.case.stockoutAt))
    || (result.case.planVersion !== undefined && (!Number.isInteger(result.case.planVersion) || result.case.planVersion < 0))
    || result.case.figures?.some(figure => !text(figure.sourceRef) || !optionalText(figure.unit) || (figure.readAt != null && !date(figure.readAt)))
    || !Array.isArray(result.signals) || !result.signals.every(item => isSignal(item, caseId))) {
    throw new Error('The case detail response is not compatible with this console.');
  }
  const row = result.case;
  const plan = result.plan ?? null;
  const route = result.route ?? null;
  const execution = result.execution ?? [];
  // A route or execution is only meaningful for the plan it was made for (FR-RTE-03).
  if ((plan !== null && !isPlan(plan, row)) || (route !== null && (plan === null || !isRoute(route, row, plan)))
    || !Array.isArray(execution) || (execution.length > 0 && (route === null || !execution.every(item => isExecution(item, route))))) {
    throw new Error('The case detail response is not compatible with this console.');
  }
  return { case: row, signals: result.signals, plan, route, execution };
}
export function confirmField(caseId: string, fieldId: string, value: string) {
  return request<unknown>(`/cases/${encodeURIComponent(caseId)}/fields/${encodeURIComponent(fieldId)}/confirm`, { value });
}
export function startRun(caseId: string) {
  return request<unknown>(`/cases/${encodeURIComponent(caseId)}/runs`, {});
}
export function rollbackCase(caseId: string) {
  return request<unknown>(`/cases/${encodeURIComponent(caseId)}/rollback`, {});
}
export function decideApproval(caseId: string, { decision, comment, planVersionHash }: ApprovalDecision) {
  return request<unknown>(`/cases/${encodeURIComponent(caseId)}/approval`, { decision, comment, planVersionHash });
}
