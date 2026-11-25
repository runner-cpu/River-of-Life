import { describe, expect, it } from 'vitest';
import { inquiries } from '../src/content/inquiries';
import { InquirySession, classificationReferenceText } from '../src/core/inquiry';
import { inquiryGraph } from '../src/modes/inquiry-graph';
import { inquiryReport } from '../src/modes/inquiry';
import { compareInquiryRecords } from '../src/core/inquiry-comparison';
import { GameStore } from '../src/core/store';
import { species } from '../src/content/species';
import { questions } from '../src/content/questions';
import { inquiryRecord, parseInquiryRecord, serializeInquiryRecord, validateInquiryRecord } from '../src/core/inquiry-record';

function complete(index = 0) {
  const s = new InquirySession(inquiries[index]);
  s.answer(0); s.observe('text'); s.continueFromObservation();
  s.activity.cards.forEach(card => s.classify(card.id, 'more-information'));
  s.showGraph(); s.continueFromGraph(); s.answer(1); s.explanation = '<script>只是文字</script>';
  return s;
}
describe('independent inquiry record', () => {
  it.each([0, 1, 2])('round trips complete topic %i without fabricating legacy evidence', index => {
    const s = complete(index), r = parseInquiryRecord(serializeInquiryRecord(s), s.activity.id);
    expect(r.answers.evidence).toBeNull(); expect(r.explanation).toBe(s.explanation);
    expect(r.classifications).toHaveLength(s.activity.cards.length);
    expect(r.classifications[0].scope).toBe(s.activity.cards[0].scope);
    r.classifications[0].scope = 'changed'; expect(s.activity.cards[0].scope).not.toBe('changed');
  });
  it('rejects incomplete, wrong protocol, wrong topic and malformed JSON', () => {
    expect(() => inquiryRecord(new InquirySession(inquiries[0]))).toThrow();
    expect(() => parseInquiryRecord('{')).toThrow('JSON');
    expect(() => parseInquiryRecord('<!doctype html>')).toThrow('HTML');
    expect(() => parseInquiryRecord(' '.repeat(100001))).toThrow('限制');
    const r = inquiryRecord(complete());
    expect(() => validateInquiryRecord({ ...r, type: 'life-save' })).toThrow('类型');
    expect(() => validateInquiryRecord({ ...r, version: 2 })).toThrow('版本');
    expect(() => validateInquiryRecord(r, inquiries[1].id)).toThrow('主题');
  });
  it('rejects duplicate cards, unknown cards, categories, source substitutions and invalid answers', () => {
    const base = inquiryRecord(complete());
    const invalid = [
      { ...base, classifications: [base.classifications[0], base.classifications[0]] },
      { ...base, classifications: [] },
      { ...base, answers: { ...base.answers, initial: 99 } },
      { ...base, explanation: 'a'.repeat(1201) },
      ...[{ cardId: 'unknown' }, { category: 'correct' }, { category: ['support'] }, { sourceRef: 'other' }, { scope: 'other' }].map(change => ({ ...base, classifications: [{ ...base.classifications[0], ...change }, base.classifications[1]] })),
    ];
    invalid.forEach(r => expect(() => validateInquiryRecord(r)).toThrow());
  });
});

it('rejects impossible calendar dates and accepts emitted canonical UTC timestamps', () => {
  const r = inquiryRecord(complete());
  for (const exportedAt of ['2026-02-30T12:00:00.000Z', '2026-13-01T00:00:00.000Z', '2026-11-12T25:00:00.000Z', '2026-11-12', '2026-11-12T12:00:00Z']) {
    expect(() => validateInquiryRecord({ ...r, exportedAt })).toThrow('时间');
  }
  expect(validateInquiryRecord({ ...r, exportedAt: '2024-02-29T12:00:00.000Z' }).exportedAt).toContain('02-29');
  expect(() => validateInquiryRecord({ ...r, version: 0 })).toThrow('版本');
  expect(() => validateInquiryRecord({ ...r, classifications: [null, null] })).toThrow('卡片');
});

describe('explicit uncertain claim references in unchanged v1 records', () => {
  it('registers the stable topic IDs and original uncertainty answer indices', () => {
    expect(inquiries.map(a => [a.id, a.uncertainClaim.id, a.uncertainClaim.answerIndex])).toEqual([
      ['feathers-and-evidence', 'feathers-multiple-features-v1', 2],
      ['sea-and-family', 'sea-classification-evidence-v1', 1],
      ['fins-and-land', 'fins-feature-combination-v1', 2],
    ]);
  });
  it.each(inquiries)('roundtrips the uncertain and both definite routes for $id without personal progress writes', activity => {
    const store = new GameStore(species, questions, { persist: false }), before = store.export();
    for (let answer = 0; answer < activity.initial.options.length; answer++) {
      const session = new InquirySession(activity);
      session.answer(answer); session.observe('text'); session.continueFromObservation();
      activity.cards.forEach(card => session.classify(card.id, 'support'));
      session.showGraph(); session.continueFromGraph(); session.answer(activity.transfer.correct);
      const record = parseInquiryRecord(serializeInquiryRecord(session));
      expect(record.type).toBe('life-inquiry-record'); expect(record.version).toBe(1);
      expect(record.answers).toEqual({ initial: answer, evidence: null, transfer: activity.transfer.correct });
      expect(record.classifications.every(card => card.category === 'support')).toBe(true);
      if (answer === activity.uncertainClaim.answerIndex) {
        expect(record.classificationReference).toEqual({ kind: 'activity-claim', claimId: activity.uncertainClaim.id });
        for (const html of [inquiryGraph(session), inquiryReport(session, '')]) {
          expect(html).toContain('支持归类参照');
          expect(html).not.toContain('支持我的判断'); expect(html).not.toContain('反对我的判断');
        }
        expect(inquiryGraph(session)).toContain('反对归类参照');
        expect(inquiryGraph(session)).toContain(activity.uncertainClaim.proposition);
        expect(inquiryGraph(session)).toContain(activity.initial.options[answer]);
        expect(inquiryReport(session, '')).toContain(activity.uncertainClaim.proposition);
        const legacy = structuredClone(record); delete legacy.classificationReference;
        expect(parseInquiryRecord(JSON.stringify(legacy))).not.toHaveProperty('classificationReference');
        expect(classificationReferenceText(activity, answer, legacy.classificationReference)).toBe('旧记录未记载归类参照');
        const comparison = compareInquiryRecords(record, legacy).differences.join('');
        expect(comparison).toContain('同伴旧记录未记载归类参照');
        expect(comparison).toContain('无法确定双方归类参照是否一致');
        expect(comparison).not.toContain('归类参照不同');
        expect(compareInquiryRecords(legacy, legacy).differences.join('')).toContain('无法核对所检验的命题');
      } else {
        expect(record).not.toHaveProperty('classificationReference');
        expect(session.classificationProposition).toBe(activity.initial.options[answer]);
      }
      expect(store.export()).toBe(before);
    }
  });
  it.each(inquiries)('rejects untrusted, mismatched, and wrong-answer references for $id', activity => {
    const session = new InquirySession(activity);
    session.answer(activity.uncertainClaim.answerIndex); session.observe('text'); session.continueFromObservation();
    activity.cards.forEach(card => session.classify(card.id, 'support'));
    session.showGraph(); session.continueFromGraph(); session.answer(0);
    const record = inquiryRecord(session);
    for (const reference of [null, {}, { kind: 'other', claimId: activity.uncertainClaim.id }, { kind: 'activity-claim', claimId: 'unknown' }, { kind: 'activity-claim', claimId: inquiries.find(a => a.id !== activity.id)!.uncertainClaim.id }]) {
      expect(() => validateInquiryRecord({ ...record, classificationReference: reference })).toThrow('参照');
    }
    expect(() => validateInquiryRecord({ ...record, answers: { ...record.answers, initial: activity.initial.correct } })).toThrow('参照');
  });
  it('escapes the same proposition in graph and HTML report', () => {
    const activity = structuredClone(inquiries[0]); activity.uncertainClaim.proposition = '<script>claim</script>';
    const session = new InquirySession(activity);
    session.answer(activity.uncertainClaim.answerIndex); session.observe('text'); session.continueFromObservation();
    activity.cards.forEach(card => session.classify(card.id, 'support'));
    session.showGraph(); session.continueFromGraph(); session.answer(0);
    for (const html of [inquiryGraph(session), inquiryReport(session, '')]) {
      expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;claim&lt;/script&gt;');
    }
  });
});
