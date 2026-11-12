import { describe, expect, it } from 'vitest';
import { compareEnvironments, comparisonCSV } from '../src/core/lab-comparison';
import { populationCounts, populationSnapshot, frequencyChange } from '../src/core/population-view';

describe('aggregate population view', () => {
  it('rounds value one and preserves the total, including boundaries', () => {
    expect(populationCounts(0)).toEqual({ one: 0, zero: 100 });
    expect(populationCounts(1)).toEqual({ one: 100, zero: 0 });
    expect(populationCounts(.125)).toEqual({ one: 13, zero: 87 });
    expect(populationCounts(.5, 7)).toEqual({ one: 4, zero: 3 });
    for (const frequency of [NaN, Infinity, -.1, 1.1]) expect(() => populationCounts(frequency)).toThrow();
    for (const total of [0, -1, 1.5]) expect(() => populationCounts(.5, total)).toThrow();
  });
  it('matches every recorded generation without mutating results or CSV', () => {
    const result = compareEnvironments({ seed: 20261025, generations: 30, drought: .75, predation: .2 });
    const before = structuredClone(result), csv = comparisonCSV(result);
    for (const row of result.rows) {
      for (const group of populationSnapshot(result, row.generation).groups) {
        expect(group.current.one + group.current.zero).toBe(result.population);
        expect(group.current.one / result.population).toBeCloseTo(row[group.key], 10);
        expect(group.initial.one).toBe(Math.round(result.rows[0][group.key] * 100));
      }
    }
    expect(populationSnapshot(result, 0).groups[0].change).toContain('没有上一代');
    expect(populationSnapshot(result, 30).groups[1].current).not.toEqual(populationSnapshot(result, 0).groups[1].current);
    for (const generation of [-1, .5, 31, NaN]) expect(() => populationSnapshot(result, generation)).toThrow();
    expect(result).toEqual(before); expect(comparisonCSV(result)).toBe(csv);
  });
  it('expresses direction in percentage points and distinguishes generation zero', () => {
    expect(frequencyChange(.5)).toContain('没有上一代');
    expect(frequencyChange(.51, .5)).toContain('上升 1 个百分点');
    expect(frequencyChange(.48, .5)).toContain('下降 2 个百分点');
    expect(frequencyChange(.5, .5)).toContain('基本不变');
  });
});
