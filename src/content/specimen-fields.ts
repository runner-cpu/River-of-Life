import type { Question } from '../core/types';

/** Labels shared by the opened knowledge card and the questions that cite it. */
export const specimenFieldLabels = {
  definition: '生命档案', fact: '一个有趣的发现', misconception: '换一个角度认识它',
  diet: '食性 / 营养', habitat: '栖息地', period: '生活年代',
} as const satisfies Record<Question['field'], string>;
