import { inquiries } from '../content/inquiries';
import { categories, classificationReferenceText } from './inquiry';
import { validateInquiryRecord, type InquiryRecord } from './inquiry-record';

export interface InquiryComparison {
  current: InquiryRecord;
  peer: InquiryRecord;
  differences: string[];
}

/** Detached, validated snapshots only. No session mutation or progression hooks. */
export function compareInquiryRecords(current: InquiryRecord, peer: InquiryRecord): InquiryComparison {
  const own = validateInquiryRecord(current);
  const other = validateInquiryRecord(peer, own.inquiryId);
  const activity = inquiries.find(a => a.id === own.inquiryId)!;
  const differences: string[] = [];
  for (const key of ['initial', 'evidence', 'transfer'] as const) {
    if (own.answers[key] === other.answers[key]) continue;
    const label = { initial: '起初的判断', evidence: '旧版证据选择', transfer: '新情境解释' }[key];
    const answer = (record: InquiryRecord) => record.answers[key] === null ? '未记录' : activity[key].options[record.answers[key]!];
    differences.push(`${label}：我选择“${answer(own)}”；同伴选择“${answer(other)}”。`);
  }
  const ownReference = classificationReferenceText(activity, own.answers.initial, own.classificationReference);
  const peerReference = classificationReferenceText(activity, other.answers.initial, other.classificationReference);
  if (ownReference !== peerReference) differences.push(`归类参照不同：我的参照“${ownReference}”；同伴的参照“${peerReference}”。即使归类标签相同，也不能据此推断理由相同。`);
  else if (ownReference === '旧记录未记载归类参照') differences.push('双方旧记录未记载归类参照，无法核对所检验的命题；相同归类标签不能证明理由相同。');
  activity.cards.forEach((card, index) => {
    const a = own.classifications.find(c => c.cardId === card.id)!;
    const b = other.classifications.find(c => c.cardId === card.id)!;
    if (a.category !== b.category) differences.push(`证据 ${index + 1}（${card.text}）：我归为“${categories[a.category]}”；同伴归为“${categories[b.category]}”。`);
  });
  if (own.explanation !== other.explanation) differences.push('文字解释不同，请对照两方原文讨论观点、证据与理由。');
  if (own.observation !== other.observation) differences.push(`查看方式不同：我使用${own.observation === 'model' ? '三维档案' : '文字证据'}；同伴使用${other.observation === 'model' ? '三维档案' : '文字证据'}。`);
  return { current: own, peer: other, differences };
}
