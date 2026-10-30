import { learningSources } from './learning-sources';
import type { Source } from '../core/types';

export type InquiryQuestion = { prompt: string; options: string[]; correct: number; explanation: string };
export type Inquiry = {
  id: string; speciesId: string; title: string; skill: string; objective: string;
  initial: InquiryQuestion; observations: string[]; observeHint: string;
  evidence: InquiryQuestion; transfer: InquiryQuestion; source: Source;
};

export const inquiries: Inquiry[] = [
  {
    id: 'feathers-and-evidence', speciesId: 'archaeopteryx', title: '有羽毛，就和今天的鸟一样吗？', skill: '比较特征',
    objective: '用多个身体特征解释联系，区分化石证据与复原想象。',
    initial: { prompt: '看到始祖鸟的羽毛，你会怎样判断？', options: ['有羽毛，就与今天的鸟没有区别。', '还要一起比较牙齿、尾部与前肢。', '暂时不确定，想先看看证据。'], correct: 1,
      explanation: '羽毛是重要线索，但不能替代其他结构的比较。' },
    observations: ['始祖鸟化石记录了羽毛，也有牙齿、长骨尾和有爪前肢。', '这些特征的组合帮助研究者讨论鸟类演化，不能只按一个外观特征下结论。'],
    observeHint: '旋转化石展台，寻找羽毛印痕与尾部。看不清的细节请对照文字资料；扫描、复原和结构示意的含义不同。',
    evidence: { prompt: '哪条依据最能支持“需要比较多个特征”？', options: ['展台给它涂了接近现代鸟的颜色。', '它的中文名里有一个“鸟”字。', '化石同时记录羽毛、牙齿和长骨尾等特征。'], correct: 2,
      explanation: '化石特征可以作为比较材料；名字和展台配色不能代替形态证据。' },
    transfer: { prompt: '另一块化石也保存了羽毛，能据此断言它是所有现代鸟的直接祖先吗？', options: ['不能；还需要更多特征、年代与系统关系证据。', '可以；只要有羽毛就能确定直接祖先。', '可以；只要化石比现代鸟古老就行。'], correct: 0,
      explanation: '本题把比较方法用于新情境。相似特征提示研究方向，不自动证明直接祖先关系。' },
    source: learningSources.archaeopteryx,
  },
  {
    id: 'sea-and-family', speciesId: 'mosasaurus', title: '住在海里的“龙”，就是恐龙吗？', skill: '区分依据',
    objective: '区分生活环境、外形与亲缘分类的证据。',
    initial: { prompt: '沧龙体型巨大、生活在恐龙时代。它一定是恐龙吗？', options: ['是，生活年代相同就是同一类。', '暂时不确定，需要查看分类证据。', '不是；同一时代和环境不能确定亲缘分类。'], correct: 2,
      explanation: '年代与环境说明何时何地生活，不能单独确定亲缘关系。' },
    observations: ['沧龙是有鳞类海生爬行动物，不属于恐龙。', '研究者比较头骨等解剖特征；具体接近有鳞类中的哪一支，仍有讨论。'],
    observeHint: '观察复原模型的游泳形态，再读分类资料。外部形态有助理解生活方式，模型没有呈现的内部结构不能当作你亲眼观察到的证据。',
    evidence: { prompt: '判断亲缘分类时，哪条依据最有用？', options: ['头骨等解剖特征与其他有鳞类的比较。', '名字里含“龙”，而且身体很大。', '它与恐龙生活在同一个地质时期。'], correct: 0,
      explanation: '分类需要比较特征与系统关系。相近的年代、体型或生活环境不能替代这种比较。' },
    transfer: { prompt: '看到两种动物都有适合游泳的外形，下一步最合理的做法是？', options: ['直接认定它们是同一个类群。', '把游泳外形当作线索，再查其他结构与亲缘证据。', '根据谁更大来判断谁是祖先。'], correct: 1,
      explanation: '相似的生活方式可以产生相似外形；判断关系仍需更多证据。这是方法迁移题，不是对某个新物种的鉴定。' },
    source: learningSources.mosasaurus,
  },
  {
    id: 'fins-and-land', speciesId: 'tiktaalik', title: '登陆，是一夜之间长出四条腿吗？', skill: '理解过渡',
    objective: '用特征组合解释演化过渡，避免把复原模型当成完整证据。',
    initial: { prompt: '提塔利克鱼带有一些接近四足动物的结构，这意味着什么？', options: ['鱼在需要上岸时，一代之内长出了四条腿。', '不同特征可在演化过程中逐步形成组合。', '暂时不确定，想先查看资料。'], correct: 1,
      explanation: '过渡化石提供特征变化的线索，不表示个体因需要就立即改变身体。' },
    observations: ['提塔利克鱼保留鳍、鳞片等鱼类特征。', '其颈部、头骨、肋骨及部分附肢结构又与四足动物相似。'],
    observeHint: '先看身体与鳍的整体布局，再对照文字中的骨骼证据。当前展台为结构示意，未精确呈现内部骨骼，也不是原始化石扫描。',
    evidence: { prompt: '哪条证据最支持“逐步形成的特征组合”？', options: ['模型被放在岸边，所以它一定能像人一样行走。', '名字有“鱼”，所以它与四足动物毫无关系。', '它同时保留鳍与鳞片，又具有相似于四足动物的部分骨骼结构。'], correct: 2,
      explanation: '需要一起比较保留的特征与新出现的特征。展台位置和名称都不是这种变化的证据。' },
    transfer: { prompt: '如果另一块化石也兼有两组特征，最稳妥的结论是什么？', options: ['它必然是今天所有陆生脊椎动物的直接祖先。', '它因想上岸而主动改变了基因。', '它能帮助研究特征变化，但还需更多材料判断系统关系。'], correct: 2,
      explanation: '过渡特征提供研究线索；直接祖先关系和具体生活方式仍需独立证据。' },
    source: learningSources.tiktaalik,
  },
];
