import { describe, expect, it } from 'vitest';
import { compareEnvironments, comparisonCSV } from '../src/core/lab-comparison';

describe('controlled learning experiment', () => {
  const settings = { seed:20261025, generations:30, drought:.75, predation:.2 };
  it('starts with the same population and reproduces both trajectories', () => {
    const a = compareEnvironments(settings), b = compareEnvironments(settings);
    expect(a).toEqual(b); expect(a.rows[0].control).toBe(a.rows[0].treatment);
    expect(a.rows).toHaveLength(31); expect(a.energyResiduals).toEqual({control:0,treatment:0});
    expect(a.rows.at(-1)!.treatment).toBeGreaterThan(a.rows.at(-1)!.control);
  });
  it('produces identical paths when both environments are identical', () => {
    const result = compareEnvironments({...settings,drought:0});
    expect(result.rows.every(row => row.control === row.treatment)).toBe(true);
    const csv = comparisonCSV(result); expect(csv.trim().split('\n')).toHaveLength(32);
    expect(csv).toContain('control_drought,treatment_drought,predation,mutation,population');
    expect(csv.split('\n')[1]).toContain(',20261025,0,0,0.2,0.003,100');
  });
  it('rejects invalid reproducibility parameters', () => {
    for (const change of [{seed:NaN},{seed:-1},{seed:4294967296},{generations:0},{generations:301},{drought:1.1},{predation:Infinity}]) {
      expect(() => compareEnvironments({...settings,...change})).toThrow();
    }
  });
});
