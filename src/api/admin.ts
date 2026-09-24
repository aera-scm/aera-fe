import { request, requestPut } from './client';

export type RateEntry = {
  entryId: string;
  actionType: string;
  fromPlant?: string;
  toPlant?: string;
  supplierId?: string;
  lane?: string;
  unitCostUsd: number;
  fixedCostUsd: number;
  leadTimeHours: number;
  validFrom: string;
  validTo: string;
};

export type ApproverLimit = {
  userId: string;
  role: 'approver';
  plant: string;
  limitUsd: number;
  validFrom: string;
  validTo: string;
};

export type Settings = {
  config: Record<string, string | number>;
  rateCard: RateEntry[];
  approverLimits: ApproverLimit[];
};

export const settings = (signal?: AbortSignal) => request<Settings>('/admin/settings', undefined, signal);
export const setThreshold = (key: string, value: number) =>
  requestPut(`/admin/config/${encodeURIComponent(key)}`, { value });
export const setRate = (entry: RateEntry) =>
  requestPut(`/admin/rate-card/${encodeURIComponent(entry.entryId)}`, entry);
export const setApprover = (entry: ApproverLimit) =>
  requestPut(`/admin/approvers/${encodeURIComponent(entry.userId)}`, entry);
export const setKillSwitch = (on: boolean) => request('/admin/killswitch', { on });
export const resetEnvironment = (confirm: string) => request('/admin/reset', { confirm });
