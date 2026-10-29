import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PlanView } from './api/types.generated';
import { PlanOptions, confidence } from './plan-evidence';

const plan = {
  planVersion: 1,
  confidence: 0.8499,
  checks: [
    { checkId: 'V-01', optionId: 'A', passed: true, blocking: true, detail: 'Figures match' },
    { checkId: 'V-03', optionId: 'A', passed: true, blocking: true, detail: 'Arrival before need' },
    { checkId: 'V-01', optionId: 'B', passed: true, blocking: true, detail: 'Figures match' },
    { checkId: 'V-06', optionId: 'B', passed: false, blocking: true, detail: 'Supplier is PENDING' },
  ],
  plan: {
    chosen: ['A'], totalCostUsd: 4100, coverageUnits: 720, rationale: 'Transfer from 1020.',
    options: [
      { id: 'A', name: 'Stock transfer', coverageUnits: 720, costUsd: 4100, costSourceRef: 'ratecard:STO', arrival: '2026-11-01T10:00:00Z', rationale: 'A', actions: [{ type: 'CREATE_STO' }] },
      { id: 'B', name: 'Alternate supplier', coverageUnits: 720, costUsd: 9000, costSourceRef: 'ratecard:ALT', arrival: '2026-11-01T12:00:00Z', rationale: 'B', actions: [{ type: 'CREATE_PO' }] },
    ],
  },
} as unknown as PlanView;

describe('plan evidence display', () => {
  it('BR-18 confidence is truncated, never rounded up across the floor', () => {
    expect(confidence(0.8499)).toBe('0.849');
    expect(confidence(0.57)).toBe('0.57');
    expect(confidence(0.9095714285714286)).toBe('0.909');
  });
  it('FR-UI-07 folds passing check lists and keeps a list with a failed check open', () => {
    render(<PlanOptions caseId="EXC-2026-0001" plan={plan}/>);
    expect(screen.getByText('0.849')).toHaveAttribute('data-source-ref', 'api:/cases/EXC-2026-0001/plan/confidence');
    expect(screen.getByText('2/2')).toBeVisible();
    expect(screen.getByText('Arrival before need')).not.toBeVisible();
    expect(screen.getByText('1/2')).toBeVisible();
    expect(screen.getByText('Supplier is PENDING')).toBeVisible();
  });
});
