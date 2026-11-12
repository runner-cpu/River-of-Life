import { describe, expect, it } from 'vitest';
import { InquirySession } from '../src/core/inquiry';
import { inquiries } from '../src/content/inquiries';
import { inquiryReport } from '../src/modes/inquiry';

describe('evidence inquiry session', () => {
  it('requires an initial answer and an observation before evidence can be recorded', () => {
    const session = new InquirySession(inquiries[0]);
    expect(session.answer(-1)).toBe(false); expect(session.answer(.5)).toBe(false); expect(session.answer(3)).toBe(false);
    session.observe('text'); expect(session.continueFromObservation()).toBe(false);
    expect(session.answer(0)).toBe(true); expect(session.phase).toBe('observe');
    expect(session.answer(2)).toBe(false); expect(session.continueFromObservation()).toBe(false);
    session.observe('text'); expect(session.continueFromObservation()).toBe(true); expect(session.phase).toBe('evidence');
  });
  it.each(inquiries)('records incorrect attempts without blocking completion: $id', activity => {
    const session = new InquirySession(activity);
    session.answer((activity.initial.correct+1)%3); session.observe('model'); session.continueFromObservation();
    activity.cards.forEach(card => session.classify(card.id, 'oppose')); session.showGraph(); session.continueFromGraph(); session.answer((activity.transfer.correct+1)%3);
    expect(session.phase).toBe('complete'); expect(session.answer(0)).toBe(false);
    expect(Object.keys(session.answers)).toHaveLength(2);
    expect(inquiryReport(session,'仍需要更多证据')).toContain('尚不一致');
  });
  it('does not export unfinished work or executable learner input', () => {
    const session = new InquirySession(inquiries[0]);
    expect(() => inquiryReport(session,'')).toThrow();
    session.answer(1); session.observe('text'); session.continueFromObservation(); session.activity.cards.forEach(card => session.classify(card.id, 'support')); session.showGraph(); session.continueFromGraph(); session.answer(0);
    const html = inquiryReport(session,'<script>alert(1)</script>');
    expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('未作自动评分'); expect(html).toContain(inquiries[0].source.url);
  });
});

 it('guards incomplete classification, invalid cards, and revision while preserving explanation', () => {
   const s = new InquirySession(inquiries[0]);
   expect(s.classify(s.activity.cards[0].id, 'support')).toBe(false);
   s.answer(0); s.observe('text'); s.continueFromObservation();
   expect(s.answer(0)).toBe(false); expect(s.showGraph()).toBe(false);
   expect(s.classify('unknown', 'support')).toBe(false);
   expect(s.classify(s.activity.cards[0].id, 'toString' as never)).toBe(false);
   s.activity.cards.forEach(card => s.classify(card.id, 'more-information'));
   expect(s.showGraph()).toBe(true); s.explanation = '保留解释';
   expect(s.classify(s.activity.cards[0].id, 'support')).toBe(false);
   expect(s.revise()).toBe(true); expect(s.explanation).toBe('保留解释');
 });
