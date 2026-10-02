import { isCase, request } from './client';
import type { Case, ExtractedField, Signal } from './types.generated';
export type CaseDetail = { case: Case; signals: Signal[] };
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const date = (value: unknown) => text(value) && Number.isFinite(Date.parse(value));
const optionalText = (value: unknown) => value == null || typeof value === 'string';
const optionalBoolean = (value: unknown) => value === undefined || typeof value === 'boolean';
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
  return { case: result.case, signals: result.signals };
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
