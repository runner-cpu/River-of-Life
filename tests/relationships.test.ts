import { describe, expect, it } from 'vitest';
import { relationships } from '../src/content/relationships';
import { timePosition, timeRange, timeReferences, toggleEpoch } from '../src/core/relationships';
import { chapters } from '../src/content/chapters';
import { species } from '../src/content/species';
describe('relationships', () => {
 it('derives all eight chapters and 48 unique published archives from their original records', () => { expect(relationships.map(g => g.chapter)).toEqual(chapters); const cards = relationships.flatMap(g => g.species); expect(cards).toHaveLength(48); expect(new Set(cards.map(s => s.id)).size).toBe(48); cards.forEach(s => expect(species).toContain(s)); });
 it('includes cross-chapter archive ages in the visible range', () => { const items = relationships.flatMap(g => [g.chapter, ...g.species]); const range = timeRange(items); items.forEach(s => { expect(timePosition(s.startMya, range)).toBeGreaterThanOrEqual(0); expect(timePosition(s.endMya, range)).toBeLessThanOrEqual(1); }); expect(range).toEqual({startMya:Math.max(...items.map(s=>s.startMya)),endMya:Math.min(...items.map(s=>s.endMya))}); });
 it('compresses time monotonically and anchors endpoints and present', () => { const r={startMya:3500,endMya:0}; expect(timePosition(3500,r)).toBe(0); expect(timePosition(0,r)).toBe(1); expect(timePosition(500,r)).toBeLessThan(timePosition(100,r)); expect(timePosition(100,r)).not.toBe(100/3500); expect(timePosition(2,{startMya:2,endMya:2})).toBe(.5); expect(timeRange([])).toEqual({startMya:0,endMya:0}); });
 it('toggles independently without changing the input set', () => { const original=new Set([1]); const next=toggleEpoch(original,2); expect([...original]).toEqual([1]); expect([...next]).toEqual([1,2]); expect([...toggleEpoch(next,1)]).toEqual([2]); });
 it('calculates both reference sentences from supplied ages', () => { expect(timeReferences([{startMya:100,endMya:60},{startMya:60,endMya:0}])).toEqual(['全部纪元范围跨越约 100 百万年。','首个纪元跨越约 40 百万年，占全部纪元跨度约 40%。']); expect(timeReferences([])).toEqual([]); });
});
