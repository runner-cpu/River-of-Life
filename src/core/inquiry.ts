import type { Inquiry } from '../content/inquiries';

export const categories = { support: '支持我的判断', irrelevant: '与判断无关', oppose: '反对我的判断', 'more-information': '需要更多信息' } as const;
export type EvidenceCategory = keyof typeof categories;
export type InquiryPhase = 'initial' | 'observe' | 'evidence' | 'graph' | 'transfer' | 'complete';
export class InquirySession {
  phase: InquiryPhase = 'initial';
  readonly answers: Partial<Record<'initial' | 'evidence' | 'transfer', number>> = {};
  readonly classifications: Record<string, EvidenceCategory> = {};
  explanation = '';
  classify(cardId: string, category: EvidenceCategory) {
    if (this.phase !== 'evidence' || !this.activity.cards.some(card => card.id === cardId) || (typeof category !== 'string' || !Object.hasOwn(categories, category))) return false;
    this.classifications[cardId] = category;
    return true;
  }
  showGraph() {
    if (this.phase !== 'evidence' || !this.activity.cards.every(card => this.classifications[card.id])) return false;
    this.phase = 'graph';
    return true;
  }
  revise() {
    if (!['graph', 'complete'].includes(this.phase)) return false;
    this.phase = 'evidence';
    return true;
  }
  continueFromGraph() {
    if (this.phase !== 'graph') return false;
    this.phase = 'transfer';
    return true;
  }
  observation?: 'model' | 'text';
  constructor(readonly activity: Inquiry) {}

  answer(index: number) {
    const phase = this.phase;
    if (phase !== 'initial' && phase !== 'transfer') return false;
    if (!Number.isInteger(index) || index < 0 || index >= this.activity[phase].options.length) return false;
    this.answers[phase] = index;
    this.phase = phase === 'initial' ? 'observe' : 'complete';
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
