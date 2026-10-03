// Test fixture in the shape GET /cases/{id} returns for a routed and partly executed plan.
import type { ExecutionView, PlanView, RouteView } from './types.generated';
export const planHash = 'a'.repeat(64);
export function planEvidence(caseId: string, deadlineAt = new Date(Date.now() + 72 * 60_000).toISOString()): { plan: PlanView; route: RouteView; execution: ExecutionView[] } {
  const at = '2026-11-01T08:00:00Z';
  const plan: PlanView = {
    plan: {
      caseId, planVersion: 1, chosen: ['C', 'A'], totalCostUsd: 42300, coverageUnits: 1240, rationale: 'Move stock now and fly the remainder.',
      options: [
        { id: 'A', name: 'Air freight for the remainder', actions: [{ type: 'BOOK_AIR_FREIGHT', supplierId: '1000234', poNumber: '4500000101', poItem: '10', qty: 640, arrival: '2026-11-02T01:00:00Z' }], coverageUnits: 640, arrival: '2026-11-02T01:00:00Z', costUsd: 38200, costSourceRef: 'ratecard:AIR-1', figures: [{ name: 'airFreightCost', value: 38200, unit: 'USD', sourceRef: 'ratecard:AIR-1', readAt: null }], rationale: 'Air freight covers 640 PC.' },
        { id: 'B', name: 'Alternate supplier order', actions: [{ type: 'CREATE_PO_ALTERNATE', supplierId: '2000111', material: 'LIVE-PART', plant: '1030', qty: 1240, deliveryDate: '2026-11-03' }], coverageUnits: 1240, arrival: '2026-11-03T08:00:00Z', costUsd: 10000, costSourceRef: 'ratecard:ALT-1', figures: [], rationale: 'Supplier 2000111 could deliver.' },
        { id: 'C', name: 'Move stock from plant 1020', actions: [{ type: 'CREATE_STO', fromPlant: '1020', toPlant: '1030', material: 'LIVE-PART', qty: 600, deliveryDate: '2026-11-01' }], coverageUnits: 600, arrival: '2026-11-01T13:00:00Z', costUsd: 4100, costSourceRef: 'ratecard:STO-1', figures: [{ name: 'freeStock1020', value: 600, unit: 'PC', sourceRef: 'SAP:stock/1020', readAt: at }], rationale: 'Plant 1020 keeps its cover.' },
      ],
    },
    confidence: 0.91, proposedAt: at, verifiedAt: at, planVersionHash: planHash,
    automatedReasoning: { status: 'CONSISTENT', findings: ['SATISFIABLE'] },
    checks: [
      { checkId: 'V-06', passed: false, blocking: true, optionId: 'B', detail: 'Alternate supplier must be APPROVED: supplier 2000111 is PENDING' },
      { checkId: 'V-01', passed: true, blocking: true, optionId: 'C', detail: 'Figures and recalculated values match fresh sources' },
      { checkId: 'V-13', passed: false, blocking: false, optionId: 'A', detail: 'Grounding score below 0.7 is flagged: 0.66' },
      { checkId: 'V-09', passed: true, blocking: true, optionId: null, detail: 'Cost must be lower than protected revenue' },
    ],
  };
  const part = { confidence: 0.91, sampled: false, reminded: false, expired: false, decision: null, comment: null, decidedAt: null };
  const route: RouteView = {
    planVersion: 1, planVersionHash: planHash, tier: 2, reason: null, routedAt: at,
    parts: [
      { ...part, planPartId: 'part-sto', options: ['C'], tier: 1, costUsd: 4100, approverId: null, backupApproverId: null, deadlineAt: null, reminderAt: null, undoSummary: [{ optionId: 'C', actionType: 'CREATE_STO', reversible: true, undo: 'Set the deletion indicator on the STO item before goods issue.' }] },
      { ...part, planPartId: 'part-air', options: ['A'], tier: 2, costUsd: 38200, approverId: 'approver@meridian-motors.example', backupApproverId: 'backup.approver@meridian-motors.example', deadlineAt, reminderAt: at, undoSummary: [{ optionId: 'A', actionType: 'BOOK_AIR_FREIGHT', reversible: false, undo: 'Not reversible once booked; the freight cost stays.' }] },
    ],
  };
  const execution: ExecutionView[] = [{
    planPartId: 'part-sto', status: 'SUCCEEDED',
    steps: [{ index: 2, actionType: 'CREATE_STO', target: '1020>1030:LIVE-PART', status: 'SUCCEEDED', sapDocument: '4500000777', sourceRef: 'SAP:API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder(4500000777)', undoType: 'DELETE_STO_ITEM', irreversible: false }],
    milestones: [{ type: 'UNDO_SAVED', ts: at }, { type: 'EXECUTION_COMPLETED', ts: at }],
  }];
  return { plan, route, execution };
}
