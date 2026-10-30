import type { Species } from '../core/types';
import { species } from '../content/species';
import { escape, icon } from '../core/ui';

type GuideField = 'definition' | 'taxonomy' | 'period' | 'sizeLabel' | 'diet' | 'habitat' | 'fact' | 'misconception' | 'extinction';
type Topic = {
  id: string;
  label: string;
  question: string;
  prompts: readonly string[];
  fields: readonly GuideField[];
};
const topics: readonly Topic[] = [
  { id: 'overview', label: '认识它', question: '它是什么？', prompts: ['是什么', '它是什么', '介绍', '介绍一下', '基本介绍', '认识它', '什么类群', '它属于什么类群', '分类', '分类是什么'], fields: ['definition', 'taxonomy'] },
  { id: 'time', label: '生活年代', question: '它生活在什么年代？', prompts: ['年代', '生活年代', '生活在什么年代', '它生活在什么年代', '什么时期', '生活在什么时候', '它生活在什么时候', '什么时候出现'], fields: ['period'] },
  { id: 'size', label: '代表尺寸', question: '它有多大？', prompts: ['大小', '尺寸', '代表尺寸', '体型', '多大', '它有多大', '有多大', '多长', '它有多长', '有多高', '它有多高', '翼展多少'], fields: ['sizeLabel'] },
  { id: 'diet', label: '食性营养', question: '它吃什么？', prompts: ['食性', '营养', '吃什么', '它吃什么', '如何获取营养', '它如何获取营养'], fields: ['diet'] },
  { id: 'habitat', label: '栖息环境', question: '它生活在哪里？', prompts: ['栖息地', '环境', '住哪里', '它住哪里', '生活在哪里', '它生活在哪里', '栖息环境'], fields: ['habitat'] },
  { id: 'fact', label: '有趣发现', question: '有什么有趣的发现？', prompts: ['发现', '有趣发现', '有什么有趣的发现', '有趣的发现', '有什么特点', '它有什么特点', '趣闻'], fields: ['fact'] },
  { id: 'misconception', label: '常见误解', question: '它有哪些常见误解？', prompts: ['误解', '常见误解', '有哪些常见误解', '它有哪些常见误解', '容易误解什么', '换个角度', '换一个角度'], fields: ['misconception'] },
  { id: 'later', label: '它的后来', question: '它后来怎么样了？', prompts: ['后来', '它的后来', '后来怎么样了', '它后来怎么样了', '灭绝', '灭绝原因', '为什么灭绝', '它为什么灭绝', '什么时候灭绝', '它什么时候灭绝', '现在还存在吗', '它现在还存在吗'], fields: ['extinction'] },
];
const fieldLabels: Record<GuideField, string> = {
  definition: '基本定义', taxonomy: '类群范围', period: '生活年代', sizeLabel: '代表尺寸', diet: '食性 / 营养',
  habitat: '栖息地', fact: '有趣发现', misconception: '常见误解', extinction: '它的后来',
};

// Each published card contributes eight deterministic rules. Answers quote card fields;
// this local lookup never calls a language model or fetches an external source.
export const guideRules = species.flatMap(card => topics.map(topic => ({
  speciesId: card.id,
  topicId: topic.id,
  prompts: topic.prompts,
  excerpts: topic.fields.map(field => ({ field, label: fieldLabels[field], text: card[field] })),
  sources: card.sources,
})));

function normalize(value: string) {
  return value.toLocaleLowerCase().replace(/[\s，。！？、：；,.!?:;“”"'（）()]/g, '');
}

export function answerGuide(card: Species, question: string) {
  // Exact supported phrasings prevent a keyword from answering an unrelated question,
  // such as treating a question about interspecies combat as a size comparison.
  let query = normalize(question);
  if (!query || query.length > 140) return undefined;
  for (const name of [card.name, card.latin, card.id]) query = query.split(normalize(name)).join('');
  query = query.replace(/^(请问|请|我想知道|告诉我)/, '').replace(/(呢|吗|呀)$/, '');
  return guideRules.find(rule => rule.speciesId === card.id && rule.prompts.some(prompt => normalize(prompt).replace(/(呢|吗|呀)$/, '') === query));
}

export function guideMarkup(card: Species) {
  return `<details class="darwin-guide">
    <summary>${icon('MessageCircle', 16)} 达尔文导览 <span>本地规则</span></summary>
    <p class="guide-intro">从${escape(card.name)}的知识卡找答案。仅依据本卡内容回答，离线可用。</p>
    <div class="guide-topics" aria-label="导览建议问题">${topics.map(topic => `<button type="button" class="btn small" data-guide-topic="${topic.id}">${topic.label}</button>`).join('')}</div>
    <form class="guide-form"><label for="darwin-question">问问这张知识卡</label><div><input id="darwin-question" name="question" type="text" maxlength="140" autocomplete="off" placeholder="例如：它吃什么？" aria-describedby="darwin-guide-hint"><button class="btn small" type="submit">查找答案</button></div></form>
    <p id="darwin-guide-hint" class="guide-hint">可问上方 8 个主题；超出卡片的信息会提示暂无答案。导览以卡片文字与原有参考来源为准。</p>
    <div class="guide-answer" role="status" aria-live="polite" aria-atomic="true"></div>
  </details>`;
}

export function mountGuide(container: HTMLElement, card: Species): () => void {
  const events = new AbortController();
  const input = container.querySelector<HTMLInputElement>('input')!;
  const answer = container.querySelector<HTMLElement>('.guide-answer')!;
  const show = (question: string) => {
    const rule = answerGuide(card, question);
    if (!rule) {
      answer.innerHTML = '<p>这张知识卡没有足够信息回答这个问题。试试上方的建议主题；关于其他物种的问题，请打开对应档案。</p>';
      return;
    }
    answer.innerHTML = `<p class="guide-answer-title">${escape(card.name)} · 卡片原文</p>${rule.excerpts.map(excerpt => `<p><strong>${escape(excerpt.label)}</strong><q>${escape(excerpt.text)}</q></p>`).join('')}
      <details class="guide-references"><summary>卡片参考来源 · ${rule.sources.length} 条</summary>${rule.sources.map((source, index) => `<a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">[${index + 1}] ${escape(source.title)}</a><small>${escape(source.level)} 级 · 核对于 ${escape(source.checked)}</small>`).join('')}<small>沿用整张卡片的参考来源；不表示逐句对应已获额外核验。</small></details>`;
  };
  container.querySelector('form')!.addEventListener('submit', event => { event.preventDefault(); show(input.value); }, { signal: events.signal });
  container.querySelectorAll<HTMLButtonElement>('[data-guide-topic]').forEach(button => {
    button.addEventListener('click', () => {
      const topic = topics.find(entry => entry.id === button.dataset.guideTopic)!;
      input.value = topic.question;
      show(topic.question);
    }, { signal: events.signal });
  });
  show(topics[0].question);
  return () => { events.abort(); input.value = ''; answer.replaceChildren(); };
}
