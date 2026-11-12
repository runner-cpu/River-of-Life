import { mountInquiryComparison } from './inquiry-comparison';
import { learningSources } from '../content/learning-sources';
import { inquiryRecord, serializeInquiryRecord, type InquiryRecord } from '../core/inquiry-record';
import { inquiryGraph } from './inquiry-graph';
import { inquiries } from '../content/inquiries';
import { categories, InquirySession, type EvidenceCategory } from '../core/inquiry';
import type { Species } from '../core/types';
import { download, escape, icon, modal, toast } from '../core/ui';
import { inquiryArt } from '../scene/inquiry-art';

export function inquiryReport(session: InquirySession, explanation: string) {
  if (session.phase !== 'complete') throw new Error('请先完成本次探究。');
  const a = session.activity;
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>生命长河 · 探究记录</title><style>body{max-width:780px;margin:40px auto;padding:24px;font:16px/1.9 system-ui;color:#203d37}h1{font-size:28px}section{border-top:1px solid #ccd5cb;margin-top:24px;padding-top:16px}p{white-space:pre-wrap}small{color:#52644f}@media print{body{margin:0;padding:0}}</style><h1>${escape(a.title)}</h1><p>学习目标：${escape(a.objective)}</p><small>课堂活动临时记录 · 不含姓名／账号 · 不写入个人图鉴。此记录不是标准化测验，也不能单独证明教学成效。</small>${(['initial','evidence','transfer'] as const).map((key,index) => `<section><h2>${['起初的判断','证据选择','新情境解释'][index]}</h2><p>${escape(a[key].prompt)}</p><p>本次选择：${escape(session.answers[key] === undefined ? '未记录' : a[key].options[session.answers[key]!])}</p>${key !== 'initial' && session.answers[key] !== undefined ? `<p>与本活动参考解释${session.answers[key] === a[key].correct ? '一致' : '尚不一致'}。</p>` : ''}<p>参考解释：${escape(a[key].explanation)}</p></section>`).join('')}<section><h2>证据归类（独立新增栏目）</h2>${a.cards.map(card => `<p>${escape(card.text)}：${escape(categories[session.classifications[card.id]])}<br>来源引用：${escape(card.sourceRef)}<br>核对范围：${escape(card.scope)}</p>`).join('')}</section><section><h2>我的解释</h2><p>${escape(explanation.trim() || '本次没有填写文字解释。')}</p><small>文字解释由学习者填写，未作自动评分；请由教师核对“观点—证据—理由”是否连贯。</small></section><section><h2>证据来源与边界</h2><p>${escape(a.observations.join('\n'))}</p><a href="${escape(a.source.url)}">[${a.source.level}] ${escape(a.source.title)}</a><p>核对范围：${escape(a.source.scope)}</p><p>查看方式：${session.observation === 'model' ? '打开过三维档案' : '使用文字证据'}。模型配色、姿态和舞台位置不能替代化石证据。</p></section></html>`;
}

export function openInquiry(species: Species[], onSpecimen: (specimen: Species) => void) {
  const { dialog, close } = modal('用证据，重新认识生命', '<div id="inquiry-content"></div>', true);
  dialog.classList.add('inquiry-dialog');
  const host = dialog.querySelector<HTMLElement>('#inquiry-content')!;
  let session: InquirySession | undefined;
  let peerMemory: { peer?: InquiryRecord } = {};
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (!session || !dialog.isConnected) return;
    event.preventDefault(); event.returnValue = '';
  };
  window.addEventListener('beforeunload', beforeUnload);
  dialog.addEventListener('close', () => window.removeEventListener('beforeunload', beforeUnload), { once: true });
  const focusHeading = () => host.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  function choose() {
    session = undefined;
    peerMemory = {};
    host.innerHTML = `<div class="inquiry-intro"><span class="eyebrow">一段约 3 分钟的证据探究</span><h2 tabindex="-1">先有一个判断，再找支持它的证据。</h2><p>看见结构、对照资料，把得到的解释用到一个新问题。适合小学高年级与初中课堂试用，实际难度待教学试测。</p></div><div class="inquiry-topics">${inquiries.map(a => { const s = species.find(item => item.id === a.speciesId)!; return `<button class="inquiry-topic" data-inquiry="${a.id}"><div>${inquiryArt(s.id)}</div><span>${escape(a.skill)}</span><h3>${escape(a.title)}</h3><p>${escape(a.objective)}</p><b>开始探究 ${icon('ArrowRight',16)}</b></button>`; }).join('')}</div><p class="inquiry-boundary">课堂活动使用临时记录，不改变个人图鉴。完成后可导出本次选择和解释；关闭窗口后记录不会保留。</p>`;
    host.querySelectorAll<HTMLButtonElement>('[data-inquiry]').forEach(button => button.addEventListener('click', () => {
      session = new InquirySession(inquiries.find(a => a.id === button.dataset.inquiry)!); render();
    }));
    focusHeading();
  }
  function render() {
    if (!session) return;
    const state = session, a = state.activity;
    const phaseIndex = ['initial','observe','evidence','graph','transfer','complete'].indexOf(state.phase);
    host.innerHTML = `<div class="inquiry-top"><button class="text-btn" id="inquiry-choose">${icon('ArrowLeft',15)} 选择其他主题</button><span>${escape(a.skill)} · ${phaseIndex + 1} / 6</span></div><ol class="inquiry-steps" aria-label="探究进度">${['作出判断','观察与查证','归类证据','关系反馈','迁移解释','留下记录'].map((title,index) => `<li ${index === phaseIndex ? 'aria-current="step"' : ''} class="${index <= phaseIndex ? 'reached' : ''}"><span>${index+1}</span>${title}</li>`).join('')}</ol><p class="inquiry-boundary">本次活动仅临时保存；关闭或刷新前请导出记录。</p><div id="inquiry-step"></div>`;
    host.querySelector('#inquiry-choose')!.addEventListener('click', choose);
    const step = host.querySelector<HTMLElement>('#inquiry-step')!;
    if (state.phase === 'observe') {
      step.innerHTML = `<div class="inquiry-observe"><div><span class="eyebrow">模型帮助观察，资料提供依据</span><h2 tabindex="-1">现在，让证据进入讨论。</h2><p>${escape(a.observeHint)}</p><button class="btn primary" id="inquiry-model">${icon('Rotate3d',18)} 打开三维档案</button></div><section class="inquiry-evidence"><h3>对照这两条记录</h3><ul>${a.observations.map(text => `<li>${escape(text)}</li>`).join('')}</ul><a href="${escape(a.source.url)}" target="_blank" rel="noopener noreferrer">[${a.source.level}] ${escape(a.source.title)} ${icon('ArrowUpRight',14)}</a><small>${escape(a.source.scope)}</small></section></div><div class="inquiry-actions"><button class="btn" id="inquiry-text">我已对照文字证据</button><button class="btn primary" id="inquiry-continue" ${state.observation ? '' : 'disabled'}>进入证据判断 ${icon('ArrowRight',16)}</button><p role="status" id="inquiry-observed">${state.observation ? '已记录查看方式，可以继续。' : '可打开三维档案，也可直接对照文字证据完成活动。'}</p></div>`;
      const observed = (method: 'model' | 'text') => {
        state.observe(method); step.querySelector<HTMLButtonElement>('#inquiry-continue')!.disabled = false;
        step.querySelector('#inquiry-observed')!.textContent = method === 'model' ? '已打开三维档案；返回后可继续判断。' : '已选择文字证据，可以继续判断。';
      };
      step.querySelector('#inquiry-model')!.addEventListener('click', () => { observed('model'); onSpecimen(species.find(s => s.id === a.speciesId)!); });
      step.querySelector('#inquiry-text')!.addEventListener('click', () => observed('text'));
      step.querySelector('#inquiry-continue')!.addEventListener('click', () => { if (state.continueFromObservation()) render(); });
    } else if (state.phase === 'evidence') {
      step.innerHTML = `
        <h2 tabindex="-1">证据卡片归类</h2>
        <p>相对于你的起初判断：${escape(a.initial.options[state.answers.initial!])}</p>
        <p>可用每张卡片的目标按钮，或在桌面拖入归类区。所有卡片归类后可查看关系图，不自动判对错。</p>
        <div class="inquiry-card-list">
          ${a.cards.map(card => `
            <article class="inquiry-card" draggable="true" data-card="${card.id}">
              <h3>${escape(card.text)}</h3>
              <details><summary>来源与核对范围</summary>
                <a href="${escape(learningSources[card.sourceRef].url)}" target="_blank" rel="noopener noreferrer">${escape(learningSources[card.sourceRef].title)}</a>
                <p>${escape(card.scope)}</p>
              </details>
              <p class="card-status" role="status">${state.classifications[card.id] ? categories[state.classifications[card.id]] : '待归类'}</p>
              <div class="inquiry-category-buttons" role="group" aria-label="为证据选择归类">
                ${Object.entries(categories).map(([key, label]) => `<button class="btn" data-category="${key}" aria-pressed="${state.classifications[card.id] === key}">${label}</button>`).join('')}
              </div>
            </article>
          `).join('')}
        </div>
        <div class="inquiry-drop-zones">${Object.entries(categories).map(([key, label]) => `<section data-drop-category="${key}"><h3>${label}</h3><p class="zone-count"></p></section>`).join('')}</div>
        <p id="classification-status" role="status"></p>
        <button class="btn primary" id="inquiry-show-graph">查看关系图</button>`;
      const update = () => {
        step.querySelectorAll<HTMLElement>('[data-card]').forEach(card => {
          const selected = state.classifications[card.dataset.card!];
          card.querySelector('.card-status')!.textContent = selected ? categories[selected] : '待归类';
          card.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === selected)));
        });
        step.querySelectorAll<HTMLElement>('[data-drop-category]').forEach(zone => {
          zone.querySelector('.zone-count')!.textContent = a.cards.filter(card => state.classifications[card.id] === zone.dataset.dropCategory).map(card => card.text).join('；') || '暂无证据卡';
        });
        const pending = a.cards.filter(card => !state.classifications[card.id]).length;
        step.querySelector('#classification-status')!.textContent = pending ? `还有 ${pending} 张证据卡待归类。` : '所有证据卡已归类，可以查看关系图。';
        step.querySelector<HTMLButtonElement>('#inquiry-show-graph')!.disabled = pending > 0;
      };
      step.querySelectorAll<HTMLElement>('[data-card]').forEach(card => {
        card.addEventListener('dragstart', event => (event as DragEvent).dataTransfer?.setData('text/plain', card.dataset.card!));
        card.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(button => button.addEventListener('click', () => {
          state.classify(card.dataset.card!, button.dataset.category as EvidenceCategory); update();
        }));
      });
      step.querySelectorAll<HTMLElement>('[data-drop-category]').forEach(zone => {
        zone.addEventListener('dragover', event => event.preventDefault());
        zone.addEventListener('drop', event => {
          event.preventDefault();
          state.classify((event as DragEvent).dataTransfer?.getData('text/plain') || '', zone.dataset.dropCategory as EvidenceCategory); update();
        });
      });
      step.querySelector('#inquiry-show-graph')!.addEventListener('click', () => { if (state.showGraph()) render(); });
      update();
    } else if (state.phase === 'graph') {
      step.innerHTML = `${inquiryGraph(state)}
        <label for="inquiry-explanation">自我解释：我的观点是……依据是……</label>
        <textarea id="inquiry-explanation" maxlength="1200" rows="4">${escape(state.explanation)}</textarea>
        <output id="inquiry-character-count" aria-label="已输入字数">${state.explanation.length} / 1200</output>
        <div class="inquiry-actions">
          <button class="btn" id="inquiry-revise">返回修改归类</button>
          <button class="btn primary" id="inquiry-transfer">尝试新问题</button>
        </div>`;
      step.querySelector<HTMLTextAreaElement>('#inquiry-explanation')!.addEventListener('input', event => {
        state.explanation = (event.target as HTMLTextAreaElement).value;
        step.querySelector('#inquiry-character-count')!.textContent = `${state.explanation.length} / 1200`;
      });
      step.querySelector('#inquiry-revise')!.addEventListener('click', () => { state.revise(); render(); });
      step.querySelector('#inquiry-transfer')!.addEventListener('click', () => { state.continueFromGraph(); render(); });
    } else if (state.phase === 'complete') {
      step.innerHTML = `<div class="inquiry-result"><span class="eyebrow">从答案，走向解释</span><h2 tabindex="-1">把观点和证据连起来。</h2><p>这次选择是一次练习记录。答对选择题不等于已经掌握，请尝试用自己的话解释。</p><div class="inquiry-review">${(['initial','evidence','transfer'] as const).map((key,index) => `<section><h3>${['起初的判断','证据选择','新情境解释'][index]}</h3><p>${escape(state.answers[key] === undefined ? '未记录' : a[key].options[state.answers[key]!])}</p><small>${state.answers[key] === undefined ? '旧版单选依据未记录，不作一致性判断。' : key === 'initial' ? '回看最初想法，允许自己修改。' : state.answers[key] === a[key].correct ? '与本活动参考解释一致。' : '这条解释还需要调整。'}</small><p class="inquiry-rationale">${escape(a[key].explanation)}</p></section>`).join('')}</div>${inquiryGraph(state)}<button class="btn" id="inquiry-revise">返回修改归类</button><label for="inquiry-explanation">我的观点是……依据是……这条证据能说明……</label><textarea id="inquiry-explanation" maxlength="1200" rows="4" aria-describedby="inquiry-writing-hint" placeholder="请勿填写姓名或联系方式。用自己的话写下一条解释。">${escape(state.explanation)}</textarea><div class="inquiry-writing-footer"><span id="inquiry-writing-hint">可先口头说明，再写下你的理由。</span><output id="inquiry-character-count" aria-label="已输入字数">${state.explanation.length} / 1200</output></div><p class="inquiry-boundary">文字解释不会自动评分。导出后可由教师讨论与反馈；本次记录不用于计算“学习提升率”。</p><p class="inquiry-boundary">HTML可打开打印，保留原栏目并新增归类记录；JSON为独立探究文件，包含判断、归类、解释与来源。</p><div class="inquiry-actions"><button class="btn primary" id="inquiry-export">${icon('FileDown',17)} 导出我的探究记录</button><button class="btn" id="inquiry-export-json">导出探究 JSON 文件</button><button class="btn" id="inquiry-finish">完成本次探究</button></div></div>`;
      step.querySelector('#inquiry-revise')!.addEventListener('click', () => { state.revise(); render(); });
      const peerHost = document.createElement('div');
      step.querySelector('.inquiry-result')!.append(peerHost);
      const comparison = mountInquiryComparison(peerHost, () => inquiryRecord(state), peerMemory);
      step.querySelector('#inquiry-export-json')!.addEventListener('click', () => { download(`生命长河-${a.id}-探究记录.json`, serializeInquiryRecord(state), 'application/json'); });
      step.querySelector<HTMLTextAreaElement>('#inquiry-explanation')!.addEventListener('input', event => {
        state.explanation = (event.target as HTMLTextAreaElement).value;
        comparison.refresh();
        step.querySelector('#inquiry-character-count')!.textContent = `${(event.target as HTMLTextAreaElement).value.length} / 1200`;
      });
      step.querySelector('#inquiry-export')!.addEventListener('click', () => {
        download(`生命长河-${a.id}-探究记录.html`, inquiryReport(state,step.querySelector<HTMLTextAreaElement>('#inquiry-explanation')!.value),'text/html;charset=utf-8'); toast('探究记录已导出，可用浏览器打开或打印。');
      });
      step.querySelector('#inquiry-finish')!.addEventListener('click',close);
    } else {
      const question = a[state.phase];
      step.innerHTML = `<form class="inquiry-question"><span class="eyebrow">${state.phase === 'initial' ? '先记录想法，暂不揭晓解释' : '把方法带到一个新情境'}</span><h2 tabindex="-1">${escape(question.prompt)}</h2><fieldset><legend class="sr-only">选择一个回答</legend>${question.options.map((option,index) => `<label><input type="radio" name="inquiry-answer" value="${index}" required><span><b>${String.fromCharCode(65+index)}</b>${escape(option)}</span></label>`).join('')}</fieldset><button class="btn primary" type="submit">${state.phase === 'initial' ? '记录判断，开始观察' : '查看本次探究记录'} ${icon('ArrowRight',16)}</button></form>`;
      step.querySelector('form')!.addEventListener('submit', event => {
        event.preventDefault(); const selected = step.querySelector<HTMLInputElement>('input:checked');
        if (selected && state.answer(Number(selected.value))) render();
      });
    }
    dialog.querySelector('.modal-body')!.scrollTop = 0; focusHeading();
  }
  choose();
  return { dialog, close };
}
