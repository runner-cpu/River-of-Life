import type { compareEnvironments } from './lab-comparison';

type Comparison = ReturnType<typeof compareEnvironments>;

/** Aggregate counts only: fixed positions never identify individuals across generations. */
export function populationCounts(frequency: number, population = 100) {
  if (!Number.isFinite(frequency) || frequency < 0 || frequency > 1
    || !Number.isSafeInteger(population) || population < 1) throw new Error('无效的种群频率或数量。');
  const one = Math.round(frequency * population);
  return { one, zero: population - one };
}

export function frequencyChange(current: number, previous?: number) {
  if (previous === undefined) return '第 0 代没有上一代可比较。';
  const difference = Math.round((current - previous) * 10000) / 100;
  return difference === 0 ? '与上一代相比基本不变（0 个百分点）。'
    : `与上一代相比${difference > 0 ? '上升' : '下降'} ${Math.abs(difference)} 个百分点。`;
}

export function populationSnapshot(result: Comparison, generation: number) {
  if (!Number.isInteger(generation) || generation < 0 || generation >= result.rows.length) {
    throw new Error('世代超出本次记录。');
  }
  const row = result.rows[generation];
  const previous = result.rows[generation - 1];
  return {
    generation: row.generation,
    groups: (['control', 'treatment'] as const).map(key => ({
      key,
      initial: populationCounts(result.rows[0][key], result.population),
      current: populationCounts(row[key], result.population),
      frequency: row[key],
      change: frequencyChange(row[key], previous?.[key]),
    })),
  };
}
