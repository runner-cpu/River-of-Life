import { describe, expect, it } from 'vitest';
import { inquiries } from '../src/content/inquiries';
import { InquirySession } from '../src/core/inquiry';
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
