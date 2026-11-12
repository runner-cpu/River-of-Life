import { learningSources } from '../content/learning-sources';
import { inquiries } from '../content/inquiries';
import { compareInquiryRecords } from '../core/inquiry-comparison';
import { categories } from '../core/inquiry';
import { MAX_INQUIRY_FILE_BYTES, parseInquiryRecord, type InquiryRecord } from '../core/inquiry-record';
import { escape } from '../core/ui';

function recordColumn(record: InquiryRecord, title: string) {
  const activity = inquiries.find(a => a.id === record.inquiryId)!;
  const groups = Object.entries(categories).map(([key, label]) => {
    const cards = activity.cards.filter(card => record.classifications.some(c => c.cardId === card.id && c.category === key));
    return `<section class="inquiry-peer-category">
      <h6>${label}</h6>
      <ul>${cards.map(card => `<li>${escape(card.text)}
        <small>来源引用：${escape(learningSources[card.sourceRef].title)} · 核对范围：${escape(card.scope)}</small>
      </li>`).join('') || '<li>暂无证据卡</li>'}</ul>
    </section>`;
  }).join('');
  return `<section class="inquiry-peer-column">
    <h4>${title}</h4>
    <h5>起初的判断</h5><p>${escape(activity.initial.options[record.answers.initial])}</p>
    <h5>四区归类</h5>${groups}
    <h5>我的解释</h5><p class="inquiry-peer-explanation">${escape(record.explanation || '本次没有填写文字解释。')}</p>
    <h5>新情境解释</h5><p>${escape(activity.transfer.options[record.answers.transfer])}</p>
  </section>`;
}

/** File UI owns only a peer snapshot, never a session or a Progress callback. */
export function mountInquiryComparison(host: HTMLElement, getCurrent: () => InquiryRecord, memory: { peer?: InquiryRecord } = {}) {
  let request = 0;
  host.innerHTML = `<section class="inquiry-peer">
    <h3>判断交换：同伴记录只读比较</h3>
    <p>导出探究 JSON 文件交给同伴。只接受同一主题的完整记录；两方原文仅供讨论，不合并、不评分。本次比较关闭后不保留。</p>
    <label for="inquiry-peer-file">导入同伴 JSON 记录</label>
    <input id="inquiry-peer-file" type="file" accept=".json,application/json" aria-describedby="inquiry-peer-limit">
    <small id="inquiry-peer-limit">文件最多400000字节、100000字符；HTML可阅读打印，不能导入。</small>
    <p id="inquiry-peer-status" role="status" aria-live="polite"></p>
    <div id="inquiry-peer-result"></div>
  </section>`;
  const input = host.querySelector<HTMLInputElement>('input')!;
  const status = host.querySelector<HTMLElement>('#inquiry-peer-status')!;
  const result = host.querySelector<HTMLElement>('#inquiry-peer-result')!;
  const refresh = () => {
    if (!memory.peer) return;
    const comparison = compareInquiryRecords(getCurrent(), memory.peer);
    result.innerHTML = `<h3>两方记录</h3>
      <p>归类均相对于各自的起初判断。以下差异不表示谁正确。</p>
      <div class="inquiry-peer-columns">
        ${recordColumn(comparison.current, '我的当前记录')}${recordColumn(comparison.peer, '同伴记录')}
      </div>
      <section class="inquiry-peer-differences"><h4>具体差异</h4>
        <ul>${comparison.differences.map(text => `<li>${escape(text)}</li>`).join('') || '<li>判断、归类、解释与查看方式相同。</li>'}</ul>
      </section>`;
  };
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    const activeRequest = ++request;
    if (!file) return;
    status.textContent = '正在读取本地记录……';
    try {
      if (file.size > MAX_INQUIRY_FILE_BYTES) throw new Error('探究文件超过400000字节限制，未读取文件。');
      const text = await file.text();
      if (activeRequest !== request || !host.isConnected) return;
      const current = getCurrent();
      const candidate = parseInquiryRecord(text, current.inquiryId);
      // Finish validation/comparison before replacing the last accepted peer.
      compareInquiryRecords(current, candidate);
      memory.peer = candidate;
      refresh();
      status.textContent = '同伴记录已导入，仅在本次窗口中只读显示。';
    } catch (error) {
      if (activeRequest !== request || !host.isConnected) return;
      status.textContent = `${error instanceof Error ? error.message : '无法读取探究文件。'} 当前活动与此前有效的同伴记录均保留。`;
    } finally {
      if (activeRequest === request) input.value = '';
    }
  });
  refresh();
  return { refresh };
}
