import { describe, expect, it } from 'vitest';
import { demoProjection, demoWhatIf } from './projection-demo';
import { referenceId, referenceTime } from './demo';

const hour = 3_600_000;
const at = (hours: number) => new Date(Date.parse(referenceTime) + hours * hour).toISOString();

describe('FR-SIM-01..03 synthetic reference projection', () => {
  it('matches hand-calculated stock-outs and donor cover', () => {
    const base = demoProjection(referenceId, 'C');
    const joint = demoProjection(referenceId);
    expect(base.baseline['1010'].stockouts[0]).toBe(at(6.2));
    expect(base.projection['1010'].stockouts[0]).toBe(at(18.2));
    expect(joint.projection['1010'].stockouts[0]).toBe(at(31));
    expect(joint.projection['1020'].stockouts[0]).toBe(at(48));
    expect(joint.projection['1010'].points).toHaveLength(100);
    expect(joint.projection['1010'].sourceRefs).toContain('ratecard:air-freight');
  });

  it('changes quantity in what-if while retaining plan version', () => {
    const result = demoWhatIf(referenceId, 'C', { qty: 400, fromPlant: '1020' });
    expect(result.projection['1010'].stockouts[0]).toBe(at(14.2));
    expect(result.planOfRecord).toEqual({ version: 1, unchanged: true });
    expect(result.checks).toEqual([]);
    expect(() => demoWhatIf(referenceId, 'C', { qty: 700 })).toThrow(/1 to 600/);
  });
});
