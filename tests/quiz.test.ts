import { describe, expect, it } from 'vitest';
import { questions } from '../src/content/questions';
import { species } from '../src/content/species';
import { quizRound, timelineRound } from '../src/core/quiz';
import { quizFeedbackSources } from '../src/modes/quiz';
import { GameStore } from '../src/core/store';

const options = { kind: 'quick', chapter: 1, unlockedChapters: [1], answered: [], mistakes: [], day: '2026-11-25' };
describe('quiz coverage without changing answer identity', () => {
  it('selects one question per species, prioritizes unattempted fields on later rounds and preserves rewards', () => {
    const store = new GameStore(species, questions, { persist: false });
    const first = quizRound(questions, options);
    expect(new Set(first.map(q => q.speciesId)).size).toBe(first.length);
    expect(first.length).toBe(6);
    first.forEach(q => { expect(questions.find(original => original.id === q.id)).toBe(q); expect(store.answer(q.id, q.correct).points).toBe(10); });
    const second = quizRound(questions, { ...options, answered: store.state.answered });
    expect(second.every(q => !first.includes(q))).toBe(true);
    expect(new Set(second.map(q => q.speciesId)).size).toBe(second.length);
    first.forEach(q => expect(store.answer(q.id, q.correct).points).toBe(0));
  });
  it('keeps daily selection deterministic by date regardless of progress and filters locked chapters', () => {
    const first = quizRound(questions, { ...options, kind: 'daily' });
    expect(first).toHaveLength(5); expect(first.every(q => q.chapter === 1)).toBe(true);
    expect(new Set(first.map(q => q.speciesId)).size).toBe(5);
    expect(quizRound([...questions].reverse(), { ...options, kind: 'daily', answered: first.map(q => q.id), seen: first.map(q => q.id) })).toEqual(first);
  });
  it('rotates multiple mistakes for a species without omitting them permanently', () => {
    const mistakes = questions.filter(q => q.chapter === 1).slice(0, 3).map(q => q.id);
    const first = quizRound(questions, { ...options, kind: 'mistakes', mistakes });
    expect(first).toHaveLength(1);
    const second = quizRound(questions, { ...options, kind: 'mistakes', mistakes, seen: first.map(q => q.id) });
    expect(second[0].id).not.toBe(first[0].id);
    expect(quizRound(questions, { ...options, kind: 'mistakes' })).toEqual([]);
  });
  it('links every declared source scope, names the exact card field, and escapes rendered text', () => {
    const q = questions.find(q => q.speciesId === 'archaeopteryx' && q.field === 'fact')!;
    const s = species.find(s => s.id === q.speciesId)!;
    const html = quizFeedbackSources(q, s);
    expect(html).toContain('值得留意'); expect(html).toContain(s.name);
    s.sources.forEach(source => { expect(html).toContain(source.url.replaceAll('&', '&amp;')); if (source.scope) expect(html).toContain(source.scope); });
    expect(html).toContain('尚未逐字段记载核对范围');
    const hostile = { ...s, name: '<script>x</script>', sources: [{ ...s.sources[0], title: '<img src=x>', scope: '<b>scope</b>', url: 'https://example.org/?x="&y=1' }] };
    const escaped = quizFeedbackSources(q, hostile);
    expect(escaped).not.toContain('<script>'); expect(escaped).not.toContain('<img'); expect(escaped).toContain('&lt;b&gt;scope&lt;/b&gt;'); expect(escaped).toContain('&quot;&amp;y=1');
  });
});
describe('timeline chapter coverage', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('includes current unlocked chapter %i with distinct approximate ages', chapter => {
    const unlocked = Array.from({ length: chapter }, (_, i) => i + 1);
    const round = timelineRound(species, unlocked, chapter);
    expect(round.some(s => s.chapter === chapter)).toBe(true);
    expect(round.every(s => unlocked.includes(s.chapter))).toBe(true);
    expect(round.length).toBeGreaterThanOrEqual(2); expect(round.length).toBeLessThanOrEqual(5);
    round.forEach((s, i) => round.slice(i + 1).forEach(other => expect(Math.abs(s.startMya - other.startMya)).toBeGreaterThan(.1)));
    if (chapter > 1) expect(new Set(round.map(s => s.chapter)).size).toBeGreaterThan(1);
  });
});
