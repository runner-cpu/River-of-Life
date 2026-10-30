import type { Inquiry } from '../content/inquiries';

export type InquiryPhase = 'initial' | 'observe' | 'evidence' | 'transfer' | 'complete';
export class InquirySession {
  phase: InquiryPhase = 'initial';
  readonly answers: Partial<Record<'initial' | 'evidence' | 'transfer', number>> = {};
  observation?: 'model' | 'text';
  constructor(readonly activity: Inquiry) {}

  answer(index: number) {
    const phase = this.phase;
    if (phase !== 'initial' && phase !== 'evidence' && phase !== 'transfer') return false;
    if (!Number.isInteger(index) || index < 0 || index >= this.activity[phase].options.length) return false;
    this.answers[phase] = index;
    this.phase = phase === 'initial' ? 'observe' : phase === 'evidence' ? 'transfer' : 'complete';
    return true;
  }

  observe(method: 'model' | 'text') {
    if (this.phase === 'observe') this.observation = method;
  }

  continueFromObservation() {
    if (this.phase !== 'observe' || !this.observation) return false;
    this.phase = 'evidence';
    return true;
  }
}
