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
    session.answer((activity.evidence.correct+1)%3); session.answer((activity.transfer.correct+1)%3);
    expect(session.phase).toBe('complete'); expect(session.answer(0)).toBe(false);
    expect(Object.keys(session.answers)).toHaveLength(3);
    expect(inquiryReport(session,'仍需要更多证据')).toContain('尚不一致');
  });
  it('does not export unfinished work or executable learner input', () => {
    const session = new InquirySession(inquiries[0]);
    expect(() => inquiryReport(session,'')).toThrow();
    session.answer(1); session.observe('text'); session.continueFromObservation(); session.answer(2); session.answer(0);
    const html = inquiryReport(session,'<script>alert(1)</script>');
    expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('未作自动评分'); expect(html).toContain(inquiries[0].source.url);
  });
});
