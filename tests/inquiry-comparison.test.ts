import { describe, expect, it } from 'vitest';
import { inquiries } from '../src/content/inquiries';
import { InquirySession } from '../src/core/inquiry';
import { inquiryRecord } from '../src/core/inquiry-record';
import { compareInquiryRecords } from '../src/core/inquiry-comparison';

function record() {
  const s = new InquirySession(inquiries[0]);
  s.answer(0); s.observe('text'); s.continueFromObservation();
  s.activity.cards.forEach(c => s.classify(c.id, 'support'));
  s.showGraph(); s.continueFromGraph(); s.answer(0);
  return inquiryRecord(s);
}
describe('read-only inquiry comparisons', () => {
  it('reports matching records and returns detached snapshots', () => {
    const current = record(), peer = structuredClone(current), before = JSON.stringify([current, peer]);
    const result = compareInquiryRecords(current, peer);
    expect(result.differences).toEqual([]);
    result.current.explanation = 'edited'; result.peer.classifications[0].category = 'oppose';
    expect(JSON.stringify([current, peer])).toBe(before);
  });
  it('describes concrete answer/card differences and preserves executable-looking text', () => {
    const current = record(), peer = structuredClone(current);
    peer.answers.initial = 1; peer.answers.transfer = 1; peer.answers.evidence = 0;
    peer.classifications[0].category = 'more-information';
    peer.explanation = '<img src=x onerror=alert(1)>'; peer.observation = 'model';
    const before = JSON.stringify([current, peer]);
    const result = compareInquiryRecords(current, peer);
    expect(result.differences).toHaveLength(7);
    expect(result.differences.join('')).toContain('证据 1');
    expect(result.differences.join('')).toContain('需要更多信息');
    expect(result.peer.explanation).toBe(peer.explanation);
    expect(JSON.stringify([current, peer])).toBe(before);
  });
  it('validates both snapshots before comparison', () => {
    const current = record();
    expect(() => compareInquiryRecords(current, { ...current, inquiryId: inquiries[1].id })).toThrow();
    expect(() => compareInquiryRecords({ ...current, phase: 'graph' } as never, current)).toThrow();
  });
});


it.each(['mine', 'peer', 'both'] as const)('describes %s missing provenance without concluding references differ', side => {
  const known = record();
  known.answers.initial = inquiries[0].uncertainClaim.answerIndex;
  known.classificationReference = { kind: 'activity-claim', claimId: inquiries[0].uncertainClaim.id };
  const legacy = structuredClone(known); delete legacy.classificationReference;
  const current = side === 'mine' || side === 'both' ? legacy : known;
  const peer = side === 'peer' || side === 'both' ? legacy : known;
  const text = compareInquiryRecords(current, peer).differences.join('');
  expect(text).toContain(side === 'both' ? '双方旧记录未记载归类参照' : side === 'mine' ? '我的旧记录未记载归类参照' : '同伴旧记录未记载归类参照');
  expect(text).toContain('无法确定双方归类参照是否一致');
  expect(text).toContain('相同归类标签不能证明理由相同');
  expect(text).not.toContain('归类参照不同');
});

it('compares only known reference identities and preserves the equal-label reasoning caveat', () => {
  const current = record(), peer = structuredClone(current);
  peer.answers.initial = 1;
  expect(compareInquiryRecords(current, peer).differences.join('')).toContain('归类参照不同');
  expect(compareInquiryRecords(current, peer).differences.join('')).toContain('即使归类标签相同，也不能据此推断理由相同');
  expect(compareInquiryRecords(current, current).differences).toEqual([]);
});
