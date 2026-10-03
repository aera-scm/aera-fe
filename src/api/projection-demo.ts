import { referenceId, referenceTime, source } from './demo';
import type { PlantProjection, ProjectionResponse, WhatIfResponse } from './projection';

const hour = 3_600_000;
const start = Date.parse(referenceTime);
const end = start + 30 * 24 * hour;
const orders = [
  { id: '1000100', at: start },
  { id: '1000101', at: start + 8 * hour },
  { id: '1000102', at: start + 16 * hour },
  { id: '1000103', at: start + 24 * hour },
  { id: '1000104', at: start + 220 * hour },
];
type Movement = { at: number; qty: number };

function sample(initial: number, rate: number, movements: Movement[], plant: string, refs: string[]): PlantProjection {
  const events = [...movements].sort((a, b) => a.at - b.at);
  const stockouts: string[] = [];
  const windows: { start: number; end: number | null }[] = [];
  let stock = initial;
  let cursor = start;
  let stopped: number | null = stock <= 0 ? start : null;
  if (stopped !== null) stockouts.push(new Date(stopped).toISOString());
  for (const event of [...events, { at: end, qty: 0 }]) {
    if (stock > 0 && rate > 0 && stock / rate * hour <= event.at - cursor) {
      const zero = cursor + stock / rate * hour;
      stockouts.push(new Date(zero).toISOString());
      stopped = zero;
      stock = 0;
    } else {
      stock = Math.max(0, stock - rate * (event.at - cursor) / hour);
    }
    cursor = event.at;
    stock = Math.max(0, stock + event.qty);
    if (stock > 0 && stopped !== null) { windows.push({ start: stopped, end: cursor }); stopped = null; }
  }
  if (stopped !== null) windows.push({ start: stopped, end: null });
  function at(moment: number): number {
    let available = initial;
    let previous = start;
    for (const event of events) {
      if (event.at > moment) break;
      available = Math.max(0, available - rate * (event.at - previous) / hour) + event.qty;
      previous = event.at;
    }
    return Math.max(0, available - rate * (moment - previous) / hour);
  }
  const samples = Array.from({ length: 73 }, (_, i) => start + i * hour);
  samples.push(...Array.from({ length: 27 }, (_, i) => start + (i + 4) * 24 * hour));
  const lineStops = windows.map(window => ({
    start: new Date(window.start).toISOString(),
    end: window.end === null ? null : new Date(window.end).toISOString(),
    ordersAffected: plant === '1010' ? orders.filter(order => order.at >= window.start && order.at < (window.end ?? end)).map(order => order.id) : [],
    unitsShort: rate * ((window.end ?? end) - window.start) / hour,
  }));
  return {
    plant,
    points: samples.map(moment => ({ at: new Date(moment).toISOString(), stock: at(moment) })),
    stockouts,
    lineStops,
    unitsShort: lineStops.reduce((total, window) => total + window.unitsShort, 0),
    sourceRefs: refs,
  };
}

function make(sto = 0, air = 0): Record<string, PlantProjection> {
  const recipientMoves: Movement[] = [];
  if (sto) recipientMoves.push({ at: start + 5 * hour, qty: sto });
  if (air) recipientMoves.push({ at: start + 17 * hour, qty: air });
  recipientMoves.push({ at: start + 9 * 24 * hour, qty: 1600 - air });
  const refs = [source.stock, source.po, source.seed, 'SAP:API_PRODUCTION_ORDER_2_SRV/A_ProductionOrderComponent_2'];
  const result: Record<string, PlantProjection> = {
    '1010': sample(310, 50, recipientMoves, '1010', refs.concat(sto ? ['ratecard:sto-1020-1010'] : [], air ? ['ratecard:air-freight'] : [])),
  };
  if (sto) result['1020'] = sample(1080, 10, [{ at: start, qty: -sto }], '1020', [source.stock, source.seed, 'ratecard:sto-1020-1010']);
  return result;
}

export function demoProjection(caseId: string, option?: string): ProjectionResponse {
  if (caseId !== referenceId) throw new Error('Synthetic projection exists for reference case only.');
  if (option && !['C', 'A'].includes(option)) throw new Error('Projection exists for option C or A only.');
  return {
    caseId, planVersion: 1, option: option ?? 'plan', baseline: make(),
    projection: option === 'C' ? make(600) : option === 'A' ? make(0, 640) : make(600, 640),
  };
}

export function demoWhatIf(caseId: string, optionId: string, params: Record<string, unknown>): WhatIfResponse {
  if (caseId !== referenceId || optionId !== 'C') throw new Error('Synthetic what-if supports the reference transfer only.');
  const qty = params.qty;
  if (typeof qty !== 'number' || !Number.isInteger(qty) || qty <= 0 || qty > 600) {
    throw new Error('Enter a whole transfer quantity from 1 to 600 units.');
  }
  if (params.fromPlant !== undefined && params.fromPlant !== '1020') {
    throw new Error('Synthetic donor stock is available at plant 1020 only.');
  }
  return {
    caseId, optionId, baseline: make(), projection: make(qty), checks: [],
    planOfRecord: { version: 1, unchanged: true },
  };
}
