import { demoMode, request } from './client';

export type Measure = {
  value: number | string | null;
  unit: string;
  sourceRef: string;
  sampleSize: number;
};

export type Kpis = {
  basis: string;
  asOf: string;
  caseCount: Measure;
  revenueProtected: Measure;
  resolutionMedian: Measure;
  resolutionP95: Measure;
  touchlessRate: Measure;
  approvalsRequested: Measure;
  approvalsAvoided: Measure;
  blockedSignals: Measure;
  costPerCase: Measure;
  optimiserSavings: Measure;
  tierDistribution: Record<string, Measure>;
};

export async function metrics(signal?: AbortSignal): Promise<Kpis | null> {
  if (demoMode) return null;
  const result = await request<{ kpis?: Kpis }>('/metrics', undefined, signal);
  if (!result.kpis || typeof result.kpis.basis !== 'string') {
    throw new Error('The metrics response is not compatible with this console.');
  }
  return result.kpis;
}
