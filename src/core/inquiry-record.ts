import { inquiries } from '../content/inquiries';
import { learningSources } from '../content/learning-sources';
import { categories, type EvidenceCategory, type InquirySession } from './inquiry';

export interface InquiryRecord {
  type: 'life-inquiry-record';
  version: 1;
  inquiryId: string;
  phase: 'complete';
  exportedAt: string;
  answers: { initial: number; evidence: number | null; transfer: number };
  observation: 'model' | 'text';
  classifications: { cardId: string; category: EvidenceCategory; sourceRef: string; scope: string }[];
  explanation: string;
}

// UTF-8 can require up to four bytes per character; cap bytes before File.text().
export const MAX_INQUIRY_FILE_BYTES = 400_000;

function validTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

/** Independent activity protocol: never pass this data to the Progress importer. */
export function validateInquiryRecord(value: unknown, inquiryId?: string): InquiryRecord {
  if (!value || typeof value !== 'object') throw new Error('探究记录必须为对象。');
  const r = value as InquiryRecord;
  if (r.type !== 'life-inquiry-record' || r.version !== 1) throw new Error('探究记录类型或版本不支持。');
  const activity = inquiries.find(a => a.id === r.inquiryId);
  if (!activity || (inquiryId && r.inquiryId !== inquiryId)) throw new Error('探究主题不一致。');
  if (r.phase !== 'complete' || !['model', 'text'].includes(r.observation)) throw new Error('探究记录尚未完成或查看方式无效。');
  if (!validTimestamp(r.exportedAt)) throw new Error('导出时间无效，请使用有效的UTC ISO时间。');
  for (const key of ['initial', 'evidence', 'transfer'] as const) {
    const answer = r.answers?.[key];
    if (key === 'evidence' && answer === null) continue;
    if (!Number.isInteger(answer) || answer! < 0 || answer! >= activity[key].options.length) throw new Error('回答选项超出范围。');
  }
  if (typeof r.explanation !== 'string' || r.explanation.length > 1200) throw new Error('解释长度超出1200字符。');
  if (!Array.isArray(r.classifications) || r.classifications.length !== activity.cards.length) throw new Error('证据归类不完整。');
  const seen = new Set<string>();
  for (const item of r.classifications) {
    const card = activity.cards.find(c => c.id === item?.cardId);
    if (!card || seen.has(item.cardId)) throw new Error('证据卡片未知或重复。');
    if ((typeof item.category !== 'string' || !Object.hasOwn(categories, item.category))) throw new Error('证据归类无效。');
    if (item.sourceRef !== card.sourceRef || !Object.hasOwn(learningSources, item.sourceRef) || item.scope !== card.scope) throw new Error('证据来源或核对范围不一致。');
    seen.add(item.cardId);
  }
  return structuredClone(r);
}

export function inquiryRecord(session: InquirySession, explanation = session.explanation): InquiryRecord {
  return validateInquiryRecord({
    type: 'life-inquiry-record', version: 1, inquiryId: session.activity.id,
    phase: session.phase, exportedAt: new Date().toISOString(),
    answers: { initial: session.answers.initial, evidence: session.answers.evidence ?? null, transfer: session.answers.transfer },
    observation: session.observation, explanation,
    classifications: session.activity.cards.map(card => ({ cardId: card.id, category: session.classifications[card.id], sourceRef: card.sourceRef, scope: card.scope })),
  });
}

export function serializeInquiryRecord(session: InquirySession, explanation = session.explanation) {
  return JSON.stringify(inquiryRecord(session, explanation), null, 2);
}

export function parseInquiryRecord(json: string, inquiryId?: string) {
  if (json.length > 100_000) throw new Error('探究文件超过100000字符限制。');
  if (json.trimStart().startsWith('<')) throw new Error('HTML记录可阅读打印，不能作为探究JSON导入。');
  let value: unknown;
  try { value = JSON.parse(json); } catch { throw new Error('探究文件不是有效JSON。'); }
  return validateInquiryRecord(value, inquiryId);
}
