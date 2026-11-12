import { describe, expect, it, vi } from 'vitest';
import { exportedInquiry, ReproductionBehavior } from '../src/core/inquiry-badges';
import { InquirySession } from '../src/core/inquiry';
import { inquiries } from '../src/content/inquiries';
import { GameStore, validateProgress } from '../src/core/store';
import { species } from '../src/content/species';
import { questions } from '../src/content/questions';
describe('local behavior badges', () => {
  it('requires completed local export with reserved judgment, never formatting alone', () => {
    const session = new InquirySession(inquiries[0]), award = vi.fn();
    session.classifications[inquiries[0].cards[0].id] = 'more-information';
    exportedInquiry(session, award); expect(award).not.toHaveBeenCalled();
    session.phase = 'complete'; exportedInquiry(session, award);
    expect(award).toHaveBeenCalledWith('inquiry-reserved-judgment');
    delete session.classifications[inquiries[0].cards[0].id]; award.mockClear();
    exportedInquiry(session, award); expect(award).not.toHaveBeenCalled();
  });
  it('requires a completed changed-seed run and explicit nonempty note for that run', () => {
    const behavior = new ReproductionBehavior(), award = vi.fn();
    const first = behavior.completed(1); behavior.saveNote(first, 'first', award); expect(award).not.toHaveBeenCalled();
    const same = behavior.completed(1); behavior.saveNote(same, 'same', award); expect(award).not.toHaveBeenCalled();
    const rerun = behavior.completed(2);
    expect(behavior.saveNote(first, 'stale', award)).toBe(false);
    expect(behavior.saveNote(rerun, '  ', award)).toBe(false); expect(award).not.toHaveBeenCalled();
    behavior.saveNote(rerun, ' observation ', award); expect(behavior.savedNote(rerun)).toBe('observation'); expect(award).toHaveBeenCalledWith('inquiry-reproduction');
    behavior.completed(3); expect(behavior.savedNote(rerun)).toBeUndefined();
  });
  it('writes only one badge and timestamp, zero points; preview stores cannot award', () => {
    const store = new GameStore(species, questions), before = structuredClone(store.state);
    expect(store.inquiryBadge('inquiry-reproduction')).toBe(true);
    const once = store.export(); expect(store.inquiryBadge('inquiry-reproduction')).toBe(false); expect(store.export()).toBe(once);
    expect({...store.state, badges: [], updatedAt: before.updatedAt}).toEqual(before);
    const preview = new GameStore(species, questions, {persist:false});
    expect(preview.inquiryBadge('inquiry-reproduction')).toBe(false); expect(preview.state.badges).toEqual([]);
  });
  it('roundtrips v2, migrates validated v1 without reserved ID awards or prose, rejects future and invalid ledger', () => {
    const store = new GameStore(species, questions, {persist:false}); store.observe(species[0].id);
    const legacy = {...store.state, version:1, badges:['legacy','inquiry-reproduction','inquiry-reserved-judgment'], explanation:'private'};
    const migrated = validateProgress(legacy, species, questions);
    expect(migrated.version).toBe(2); expect(migrated.badges).toEqual(['legacy']); expect(migrated.updatedAt).toBe(legacy.updatedAt);
    expect(migrated.points).toBe(legacy.points); expect(migrated).not.toHaveProperty('explanation');
    migrated.badges.push('inquiry-reproduction'); expect(validateProgress(migrated,species,questions)).toEqual(migrated);
    expect(()=>validateProgress({...legacy,points:999},species,questions)).toThrow();
    expect(()=>validateProgress({...legacy,version:3},species,questions)).toThrow();
  });
});
