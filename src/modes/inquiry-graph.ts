import { learningSources } from '../content/learning-sources';
import { categories, type InquirySession } from '../core/inquiry';
import { escape } from '../core/ui';

/** Read-only rendering: links express only the learner's classifications. */
export function inquiryGraph(session: InquirySession) {
  const labels = Object.entries(categories);
  return `
    <section class="inquiry-graph">
      <h2 tabindex="-1" id="inquiry-graph-title">我的证据关系图</h2>
      <p>连线只呈现你的归类，不判定对错。虚线表示需要更多信息。</p>
      <svg class="inquiry-graph-wide" viewBox="0 0 640 260" role="img" aria-label="四个证据归类区连接起初判断；详细内容见下方文字列表">
        ${labels.map(([key, label], index) => `
          <path d="M 210 ${40 + index * 60} L 430 130" fill="none" stroke="currentColor" ${key === 'more-information' ? 'stroke-dasharray="6 5"' : ''}/>
          <rect x="5" y="${20 + index * 60}" width="205" height="40" rx="8"/>
          <text x="15" y="${46 + index * 60}">${label} (${session.activity.cards.filter(card => session.classifications[card.id] === key).length})</text>
        `).join('')}
        <rect x="430" y="105" width="200" height="50" rx="8"/>
        <text x="445" y="136">我的起初判断（见下文）</text>
      </svg>
      <svg class="inquiry-graph-narrow" viewBox="0 0 270 310" role="img" aria-label="四个归类区连接下方起初判断；详细内容见文字列表">
        ${labels.map(([key, label], index) => `
          <path d="M 220 ${28 + index * 52} L 250 ${28 + index * 52} L 250 260 L 135 260" fill="none" stroke="currentColor" ${key === 'more-information' ? 'stroke-dasharray="6 5"' : ''}/>
          <rect x="5" y="${8 + index * 52}" width="215" height="40" rx="8"/>
          <text x="15" y="${34 + index * 52}">${label} (${session.activity.cards.filter(card => session.classifications[card.id] === key).length})</text>
        `).join('')}
        <rect x="5" y="240" width="215" height="50" rx="8"/>
        <text x="15" y="271">我的起初判断（见下文）</text>
      </svg>
      <p><strong>起初的判断：</strong>${escape(session.activity.initial.options[session.answers.initial!])}</p>
      <div class="inquiry-graph-text">
        ${labels.map(([key, label]) => `<section><h3>${label}</h3><ul>${session.activity.cards.filter(card => session.classifications[card.id] === key).map(card => `<li>${escape(card.text)}<details><summary>来源与核对范围</summary><a href="${escape(learningSources[card.sourceRef].url)}" target="_blank" rel="noopener noreferrer">${escape(learningSources[card.sourceRef].title)}</a><p>${escape(card.scope)}</p></details></li>`).join('') || '<li>暂无证据卡</li>'}</ul></section>`).join('')}
      </div>
    </section>`;
}
