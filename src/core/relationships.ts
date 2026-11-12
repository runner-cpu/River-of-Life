export type TimeRange = { startMya: number; endMya: number };
export function timeRange(items: readonly TimeRange[]): TimeRange {
  if (!items.length) return { startMya: 0, endMya: 0 };
  return { startMya: Math.max(...items.map(i => i.startMya)), endMya: Math.min(...items.map(i => i.endMya)) };
}
/** log(1 + MYA) keeps the present finite; older ages appear on the left. */
export function timePosition(age: number, range: TimeRange): number {
  const span = Math.log1p(range.startMya) - Math.log1p(range.endMya);
  return span ? (Math.log1p(range.startMya) - Math.log1p(age)) / span : .5;
}
export function toggleEpoch(expanded: ReadonlySet<number>, id: number): Set<number> {
  const next = new Set(expanded); if (next.has(id)) next.delete(id); else next.add(id); return next;
}
export function timeReferences(epochs: readonly TimeRange[]): string[] {
  const total = timeRange(epochs), first = epochs[0];
  if (!first || total.startMya === total.endMya) return [];
  const duration = total.startMya - total.endMya;
  return [`全部纪元范围跨越约 ${duration.toLocaleString('zh-CN')} 百万年。`, `首个纪元跨越约 ${(first.startMya - first.endMya).toLocaleString('zh-CN')} 百万年，占全部纪元跨度约 ${Math.round((first.startMya - first.endMya) / duration * 100)}%。`];
}
