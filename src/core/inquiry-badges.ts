import type { InquirySession } from './inquiry';
import type { InquiryBadgeId } from '../content/inquiry-badges';
export type InquiryBadgeCallback = (id: InquiryBadgeId) => void;
// Called only after a local download request succeeded, never when formatting/importing.
export function exportedInquiry(session: InquirySession, award?: InquiryBadgeCallback) {
  if (session.phase === 'complete' && Object.values(session.classifications).includes('more-information')) award?.('inquiry-reserved-judgment');
}
// Keeps run identity and eligibility in this temporary session; no notes enter Progress.
export class ReproductionBehavior {
  private previousSeed?: number;
  private run = 0;
  private eligible = false;
  private note?: Readonly<{ run: number; text: string }>;
  completed(seed: number) {
    this.note = undefined;
    this.eligible = this.previousSeed !== undefined && this.previousSeed !== seed;
    this.previousSeed = seed;
    return ++this.run;
  }
  saveNote(run: number, note: string, award?: InquiryBadgeCallback) {
    if (run !== this.run || !note.trim()) return false;
    this.note = Object.freeze({run, text: note.trim()});
    if (this.eligible) award?.('inquiry-reproduction');
    return true;
  }
  savedNote(run: number) { return this.note?.run === run ? this.note.text : undefined; }
}
