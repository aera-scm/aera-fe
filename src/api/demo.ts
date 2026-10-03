import type { Case, Figure, TraceEvent } from './types.generated';

// Explicit synthetic reference scenario, SRD 6.6.3. Never used as a live fallback.
export const referenceId = 'EXC-2026-0914';
export const referenceTime = '2026-09-14T01:00:00Z';
export const source = {
  stock: "SAP:API_MATERIAL_STOCK_SRV/A_MatlStkInAcctMod('MAT-48219')",
  po: "SAP:API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder('4500001234')",
  demand: 'SAP:API_SALES_ORDER_SRV/A_SalesOrderItem',
  seed: 'demo:SRD-6.6.3/reference-scenario',
};
export const figures: Figure[] = [
  { name: 'Revenue at risk', value: 4720000, unit: 'USD', sourceRef: source.demand },
  { name: 'Time to stock-out', value: 6.2, unit: 'hours', sourceRef: source.stock },
  { name: 'Available stock', value: 310, unit: 'units', sourceRef: source.stock },
  { name: 'Daily message intake', value: 214, sourceRef: source.seed },
  { name: 'Actionable exceptions', value: 6, sourceRef: source.seed },
];
export const demoCases: Case[] = [
  { caseId: referenceId, type: 'SUPPLIER_DELAY', material: 'MAT-48219', materialDescription: 'Brake caliper housing', plant: '1010', poNumber: '4500001234', status: 'AWAITING_APPROVAL', tier: 2, priorityScore: 14160000, rarUsd: 4720000, stockoutAt: '2026-09-14T07:12:00Z', daysLate: 9, planVersion: 1, figures, createdAt: referenceTime, updatedAt: referenceTime, stage: 'APPROVE' },
  ...(['MAT-51002', 'MAT-33871', 'MAT-20114'] as const).map((material, i): Case => ({
    caseId: `EXC-2026-${String(915 + i).padStart(4, '0')}`, material,
    materialDescription: ['Material availability review', 'Carrier arrival review', 'Supplier schedule review'][i],
    type: (['QUANTITY_SHORTFALL', 'CARRIER_DELAY', 'SUPPLIER_DELAY'] as const)[i],
    plant: i === 1 ? '1020' : '1010', status: 'RECEIVED', stage: 'SIGNAL',
    createdAt: referenceTime, updatedAt: referenceTime, figures: [],
  })),
];
export const optionCards = [
  { id: 'C', name: 'Move stock from Karawang', type: 'Inter-plant transfer', units: 600, cost: 4100, hours: 5, reversible: true, sourceRef: 'ratecard:sto-1020-1010', text: 'Use available stock at plant 1020 to bridge the immediate shortage.', blocked: false },
  { id: 'A', name: 'Expedite the ready shipment', type: 'Air freight', units: 640, cost: 38200, hours: 17, reversible: false, sourceRef: 'ratecard:air-freight', text: 'Bring the ready partial shipment forward while the balance travels by sea.', blocked: false },
  { id: 'B', name: 'Source from Halim Presisi', type: 'Alternate supplier', units: 800, cost: 51900, hours: null, reversible: false, sourceRef: 'ratecard:alternate-supplier', text: 'Supplier compliance is UNDER_REVIEW. This option is blocked by V-06.', blocked: true },
];
export const demoTrace: TraceEvent[] = [
  { caseId: referenceId, eventId: '01K00000000000000000000001', kind: 'SYSTEM', detail: 'Email and photo attached to the purchase order.', data: { title: 'Supplier signal received' }, ts: referenceTime },
  { caseId: referenceId, eventId: '01K00000000000000000000002', kind: 'GUARD', detail: 'Supplier identity matched against master data.', data: { title: 'Sender verified' }, ts: referenceTime },
  { caseId: referenceId, eventId: '01K00000000000000000000003', kind: 'TOOL_RESULT', detail: 'Source: SAP Mirror reference scenario.', data: { title: 'Stock and demand compared' }, ts: referenceTime },
  { caseId: referenceId, eventId: '01K00000000000000000000004', kind: 'CHECK', detail: 'V-06 · compliance status is UNDER_REVIEW.', data: { title: 'Alternate supplier blocked' }, ts: referenceTime },
  { caseId: referenceId, eventId: '01K00000000000000000000005', kind: 'AGENT', detail: 'Transfer first, then air freight. Human approval is required for air freight.', data: { title: 'Combined resolution proposed' }, ts: referenceTime },
];
