import type { Source } from '../core/types';

// Scope records the passages checked; adding an institution does not certify a whole card.
export const learningSources: Record<string, Source> = {
  archaeopteryx: {
    title: 'What were the first birds like? — Natural History Museum',
    url: 'https://www.nhm.ac.uk/discover/what-were-the-first-birds-like.html',
    level: 'B', checked: '2026-10-30',
    scope: '“What did the earliest bird-like animals look like?”：羽毛、牙齿、长骨尾与有爪前肢；不覆盖本卡全部年代与尺寸。',
  },
  mosasaurus: {
    title: 'What is a mosasaur? — Natural History Museum',
    url: 'https://www.nhm.ac.uk/discover/what-is-a-mosasaur.html',
    level: 'B', checked: '2026-10-30',
    scope: '“Is a Mosasaurus a dinosaur?”：沧龙属于有鳞类海生爬行动物，分类依据含头骨特征；不覆盖本卡体长估值。',
  },
  tiktaalik: {
    title: 'Tiktaalik’s internal anatomy — University of Chicago',
    url: 'https://chronicle.uchicago.edu/081023/tiktaalik.shtml',
    level: 'B', checked: '2026-10-30',
    scope: '2008 年报道第 2—4 正文段：鳍、鳞片与颈部等特征组合；不证明它是人类的直接祖先。',
  },
};
