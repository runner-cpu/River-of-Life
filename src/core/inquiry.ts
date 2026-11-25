import type { Inquiry } from '../content/inquiries';

export const categories = { support: '支持归类参照', irrelevant: '与归类参照无关', oppose: '反对归类参照', 'more-information': '需要更多信息' } as const;
export type ClassificationReference = { kind: 'activity-claim'; claimId: string };

/** Missing references on historical uncertain records never acquire a new meaning. */
export function classificationReferenceText(activity: Inquiry, initial: number, reference?: ClassificationReference): string {
  if (initial !== activity.uncertainClaim.answerIndex) return activity.initial.options[initial];
  return reference?.kind === 'activity-claim' && reference.claimId === activity.uncertainClaim.id
    ? activity.uncertainClaim.proposition
    : '旧记录未记载归类参照';
}

export type EvidenceCategory = keyof typeof categories;
export type InquiryPhase = 'initial' | 'observe' | 'evidence' | 'graph' | 'transfer' | 'complete';
export class InquirySession {
  phase: InquiryPhase = 'initial';
  readonly answers: Partial<Record<'initial' | 'evidence' | 'transfer', number>> = {};
  readonly classifications: Record<string, EvidenceCategory> = {};
  explanation = '';
  get classificationReference(): ClassificationReference | undefined {
    return this.answers.initial === this.activity.uncertainClaim.answerIndex
      ? { kind: 'activity-claim', claimId: this.activity.uncertainClaim.id } : undefined;
  }
  get classificationProposition() {
    return classificationReferenceText(this.activity, this.answers.initial!, this.classificationReference);
  }
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
