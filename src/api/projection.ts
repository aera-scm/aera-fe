import { apiBase, demoMode, request } from './client';
import { demoProjection, demoWhatIf } from './projection-demo';

export interface ProjectionPoint { at: string; stock: number }
export interface LineStop { start: string; end: string | null; ordersAffected: string[]; unitsShort: number }
export interface PlantProjection {
  plant: string;
  points: ProjectionPoint[];
  stockouts: string[];
  lineStops: LineStop[];
  unitsShort: number;
  sourceRefs: string[];
}
export interface ProjectionResponse {
  caseId: string;
  planVersion: number;
  option: string | null;
  baseline: Record<string, PlantProjection>;
  projection: Record<string, PlantProjection>;
}
export interface Check { checkId: string; passed: boolean; blocking: boolean; detail: string }
export interface WhatIfResponse {
  caseId: string;
  optionId: string;
  projection: Record<string, PlantProjection>;
  baseline: Record<string, PlantProjection>;
  checks: Check[];
  planOfRecord: { version: number; unchanged: boolean };
}

function validPlant(value: unknown): value is PlantProjection {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<PlantProjection>;
  return typeof row.plant === 'string' && Array.isArray(row.points)
    && row.points.every(point => typeof point.at === 'string' && Number.isFinite(point.stock))
    && Array.isArray(row.stockouts) && Array.isArray(row.lineStops)
    && Array.isArray(row.sourceRefs) && row.sourceRefs.every(ref => typeof ref === 'string');
}
function validProjections(value: unknown): value is Record<string, PlantProjection> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(validPlant);
}

export async function projection(caseId: string, option?: string, signal?: AbortSignal): Promise<ProjectionResponse> {
  if (demoMode) return demoProjection(caseId, option);
  if (!apiBase) throw new Error('Projection API unavailable.');
  const query = option ? `?option=${encodeURIComponent(option)}` : '';
  const result = await request<ProjectionResponse>(`/cases/${encodeURIComponent(caseId)}/projection${query}`, undefined, signal);
  if (result.caseId !== caseId || !validProjections(result.baseline) || !validProjections(result.projection)) {
    throw new Error('Projection response is not compatible with this console.');
  }
  return result;
}

export async function whatIf(caseId: string, optionId: string, params: Record<string, unknown>): Promise<WhatIfResponse> {
  if (demoMode) return demoWhatIf(caseId, optionId, params);
  const result = await request<WhatIfResponse>(`/cases/${encodeURIComponent(caseId)}/whatif`, { optionId, params });
  if (result.caseId !== caseId || result.optionId !== optionId || result.planOfRecord?.unchanged !== true
    || !validProjections(result.baseline) || !validProjections(result.projection) || !Array.isArray(result.checks)) {
    throw new Error('What-if response is not compatible with this console.');
  }
  return result;
}
