import { request } from './client';

export type LabParameters = {
  exceptionType: 'SUPPLIER_DELAY' | 'QUANTITY_SHORTFALL' | 'CARRIER_DELAY';
  material: string;
  plant: '1010' | '1020' | '1030';
  daysLate: number;
  quantityShort: number;
  channel: 'EMAIL' | 'WHATSAPP' | 'CARRIER';
  language: 'EN' | 'ID' | 'DE';
  hostile: boolean;
};

export type LabRun = {
  runId: string;
  synthetic: true;
  deliveryMode: string;
  parameters: LabParameters;
  createdAt: string;
  status: string;
  outcome: string;
  caseId?: string;
  hostileBlocked?: boolean;
  verifiedAt?: string;
  timeToVerifiedSeconds?: number;
};

export const labRuns = (signal?: AbortSignal) => request<LabRun[]>('/lab/runs', undefined, signal);
export const labRun = (runId: string, signal?: AbortSignal) =>
  request<LabRun>(`/lab/runs/${encodeURIComponent(runId)}`, undefined, signal);
export const startLabRun = (parameters: LabParameters) => request<LabRun>('/lab/runs', parameters);
