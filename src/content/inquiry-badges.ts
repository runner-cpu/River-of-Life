export const inquiryBadges = {
  'inquiry-reserved-judgment': '保留判断：你记录了一次保留判断',
  'inquiry-reproduction': '复现意识：你记录了一次换种子重跑与备注',
} as const;
export type InquiryBadgeId = keyof typeof inquiryBadges;
export const isInquiryBadge = (id: string): id is InquiryBadgeId => Object.hasOwn(inquiryBadges, id);
export const badgeLabel = (id: string) => isInquiryBadge(id) ? inquiryBadges[id] : id;
