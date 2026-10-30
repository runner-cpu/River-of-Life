import type { Chapter, Species, Question } from '../core/types';
import type { GameStore } from '../core/store';
import { escape, icon, toast } from '../core/ui';
import { seeded } from '../core/lab';
import { specimenArt } from '../scene/creatures';

export function mountQuiz(container: HTMLElement, chapter: Chapter, species: Species[], questions: Question[], store: GameStore, onSpecimen: (s: Species) => void) {
  let kind = 'quick', index = 0, correct = 0, answered = false;
  let deck: Question[] = []; let sorting: Species[] = []; let sortingDone = false;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  function resetDeck() {
    index = 0; correct = 0; answered = false;
    const eligible = questions.filter(q => store.state.unlockedChapters.includes(q.chapter));
    if (kind === 'daily') { const random = seeded(Number(today.replace(/\D/g, ''))); deck = [...eligible].sort((a, b) => a.id.localeCompare(b.id)); for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; } deck = deck.slice(0, 5); }
    else if (kind === 'mistakes') deck = eligible.filter(q => store.state.mistakes.includes(q.id));
    else deck = questions.filter(q => q.chapter === chapter.id).sort((a, b) => Number(store.state.answered.includes(a.id)) - Number(store.state.answered.includes(b.id)));
  }
  function render() {
    container.innerHTML = `<div class="section-heading"><div><span class="eyebrow">A LITTLE CURIOSITY GOES A LONG WAY</span><h1>每个答案，都让生命更清晰。</h1><p>不必急着答对。一次好奇，一次纠错，都是向前的一步。</p></div><div class="stat-pill">${icon('CheckCheck', 20)} 曾答对 <strong id="quiz-correct-count">${store.state.answered.length}</strong> 道题</div></div><div class="mode-tabs" role="tablist" aria-label="知识挑战类型">${[['quick', '快问快答', 'Lightbulb'], ['timeline', '时间轴排序', 'GitBranch'], ['match', '生命连线', 'Workflow'], ['daily', '每日挑战', 'CalendarDays'], ['mistakes', '我的错题', 'BookOpenCheck']].map(([id, title, glyph]) => `<button role="tab" id="quiz-tab-${id}" aria-controls="quiz-content" tabindex="${kind === id ? 0 : -1}" aria-selected="${kind === id}" data-kind="${id}" class="${kind === id ? 'active' : ''}">${icon(glyph, 17)}${title}</button>`).join('')}</div><div id="quiz-content" role="tabpanel" aria-labelledby="quiz-tab-${kind}"></div>`;
    container.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(button => button.addEventListener('click', () => { kind = button.dataset.kind!; resetDeck(); render(); container.querySelector<HTMLElement>(`[data-kind="${kind}"]`)?.focus(); }));
    container.querySelector('.mode-tabs')!.addEventListener('keydown',event=>{
      const key=(event as KeyboardEvent).key, tabs=Array.from(container.querySelectorAll<HTMLButtonElement>('[data-kind]'));
      const index=tabs.findIndex(tab=>tab===document.activeElement);
      if(index<0 || !['ArrowLeft','ArrowRight','Home','End'].includes(key))return;
      event.preventDefault();tabs[key==='Home'?0:key==='End'?tabs.length-1:(index+(key==='ArrowRight'?1:-1)+tabs.length)%tabs.length].click();
    });
    if (kind === 'timeline') renderTimeline(); else if (kind === 'match') renderMatch(); else renderQuestion();
  }
  function renderQuestion() {
    const host = container.querySelector('#quiz-content')!;
    if (!deck.length) { host.innerHTML = `<div class="empty-state">${icon('BookOpenCheck', 48)}<h2>这里还是一张干净的书签。</h2><p>答错的题目会收进这里，随时回来重新理解。</p></div>`; return; }
    if (index >= deck.length) {
      host.innerHTML = `<div class="quiz-complete">${icon('Award', 52)}<span class="eyebrow">EXPLORATION COMPLETE</span><h2>本轮练习完成，回看你的发现。</h2><p>这一轮答对 ${correct} / ${deck.length} 题。每一个看过的解释，都算一次新的发现。</p><button class="btn primary" id="quiz-restart">再探索一轮 ${icon('RotateCcw', 17)}</button>${kind === 'daily' ? `<button class="btn" id="share-score">${icon('Copy', 17)} 复制成绩码</button>` : ''}</div>`;
      host.querySelector('#quiz-restart')!.addEventListener('click', () => { resetDeck(); renderQuestion(); const heading=host.querySelector<HTMLElement>('h2');if(heading){heading.tabIndex=-1;heading.focus();} });
      host.querySelector('#share-score')?.addEventListener('click', () => { void navigator.clipboard.writeText(`生命长河 ${today} · ${correct}/${deck.length} · 学习挑战（本地自报成绩）`).then(() => toast('成绩码已复制'), () => toast('浏览器未允许复制，请手动记录成绩。')); }); return;
    }
    const q = deck[index], s = species.find(s => s.id === q.speciesId)!;
    host.innerHTML = `<div class="quiz-layout"><section class="question-card"><div class="question-meta"><span>${kind === 'daily' ? `${today} · 每日五题` : kind === 'mistakes' ? '温故知新' : escape(chapter.name)}</span><span>${String(index + 1).padStart(2, '0')} / ${String(deck.length).padStart(2, '0')}</span></div><div class="progress-track"><i style="width:${index / deck.length * 100}%"></i></div><h2>${escape(q.prompt)}</h2><div class="answers">${q.options.map((option, i) => `<button data-answer="${i}"><span>${String.fromCharCode(65 + i)}</span>${escape(option)}${icon('ChevronRight', 17)}</button>`).join('')}</div><div id="answer-feedback" aria-live="polite"></div></section><aside class="quiz-specimen">${specimenArt(s)}<span class="eyebrow">THE STORY BEHIND THE QUESTION</span><h2>${escape(s.name)}</h2><i>${escape(s.latin)}</i><p>答案就藏在它的生命档案里。先观察、再思考，也是一种探索方式。</p><button class="text-btn" id="quiz-card">打开知识卡 ${icon('ArrowUpRight', 16)}</button><div class="reward-note">${icon('Sparkles', 17)} 每题首次答对 +10 演化点</div></aside></div>`;
    host.querySelector('#quiz-card')!.addEventListener('click', () => onSpecimen(s));
    host.querySelectorAll<HTMLButtonElement>('[data-answer]').forEach(button => button.addEventListener('click', () => {
      if (answered) return; answered = true;
      const selected = Number(button.dataset.answer), result = store.answer(q.id, selected); if (result.correct) correct++;
      host.querySelectorAll<HTMLButtonElement>('[data-answer]').forEach((b, i) => { b.disabled = true; if (i === q.correct) {b.classList.add('correct');b.insertAdjacentHTML('beforeend','<small class="answer-state">本题答案</small>');} else if (i === selected) {b.classList.add('incorrect');b.insertAdjacentHTML('beforeend','<small class="answer-state">你的选择</small>');} });
      host.querySelector('#answer-feedback')!.innerHTML = `<div class="feedback ${result.correct ? 'is-correct' : 'is-incorrect'}"><strong id="quiz-feedback-heading" tabindex="-1" aria-describedby="quiz-explanation">${icon(result.correct ? 'CircleCheck' : 'BookOpen', 20)}${result.correct ? `发现正确答案${result.points ? ' · +10 演化点' : ' · 本题已获奖励'}` : '换个角度，就能看见答案'}</strong><p id="quiz-explanation">${escape(q.explanation)}</p><small>依据：${escape(s.name)}的知识卡 · ${escape(s.sources[0]?.title || '')}</small></div><button class="btn primary next-question" id="next-question">${index + 1 === deck.length ? '查看本轮发现' : '继续探索'} ${icon('ArrowRight', 17)}</button>`;
      container.querySelector('#quiz-correct-count')!.textContent=String(store.state.answered.length);
      host.querySelector<HTMLElement>('#quiz-feedback-heading')!.focus({preventScroll:true});
      host.querySelector('#answer-feedback')!.scrollIntoView({block:'nearest',behavior:'instant'});
      host.querySelector('#next-question')!.addEventListener('click', () => { index++; answered = false; renderQuestion(); const heading=host.querySelector<HTMLElement>('h2');if(heading){heading.tabIndex=-1;heading.focus();} });
    }));
  }
  function renderTimeline() {
    const host = container.querySelector('#quiz-content')!;
    if (!sorting.length) sorting = [...species.filter(s => store.state.unlockedChapters.includes(s.chapter))].sort((a, b) => b.startMya - a.startMya).filter((s, i, a) => !i || Math.abs(s.startMya - a[i - 1].startMya) > .1).slice(0, 5).reverse();
    host.innerHTML = `<section class="timeline-challenge"><span class="eyebrow">DEEP TIME / 深时思维</span><h2>谁先来到这个世界？</h2><p>用箭头移动卡片，按照最早出现的年代，从古老到年轻排列。</p><div class="sort-list">${sorting.map((s, i) => `<div class="sort-item"><span class="sort-number">${i + 1}</span>${specimenArt(s)}<div><strong>${escape(s.name)}</strong><span>${sortingDone ? `约 ${s.startMya} 百万年前` : escape(s.latin)}</span></div><button class="icon-btn" data-move="${i},-1" aria-label="${escape(s.name)}向前移动" ${i === 0 ? 'disabled' : ''}>${icon('ArrowUp', 18)}</button><button class="icon-btn" data-move="${i},1" aria-label="${escape(s.name)}向后移动" ${i === sorting.length - 1 ? 'disabled' : ''}>${icon('ArrowDown', 18)}</button></div>`).join('')}</div><div id="sort-feedback" aria-live="polite"></div><button class="btn primary" id="check-order">核对时间顺序 ${icon('Check', 17)}</button><p class="muted">排序练习帮助理解深时；演化点由带知识来源的快问快答结算。</p></section>`;
    host.querySelectorAll<HTMLButtonElement>('[data-move]').forEach(b => b.addEventListener('click', () => { const [i, delta] = b.dataset.move!.split(',').map(Number); [sorting[i], sorting[i + delta]] = [sorting[i + delta], sorting[i]]; renderTimeline(); const position=i+delta;host.querySelector<HTMLButtonElement>(`[data-move="${position},${position===0?1:position===sorting.length-1?-1:delta}"]`)?.focus(); }));
    host.querySelector('#check-order')!.addEventListener('click', () => { const passed = sorting.every((s, i) => !i || sorting[i - 1].startMya >= s.startMya); if (passed) { sortingDone = true; store.badge('深时观察者'); renderTimeline(); } host.querySelector('#sort-feedback')!.innerHTML = `<p class="feedback ${passed ? 'is-correct' : 'is-incorrect'}">${passed ? '顺序正确！已获得「深时观察者」徽章。' : '还有相邻的生命放反了。提示：蓝细菌比大型多细胞生命更早，出现年代数值越大，时间越古老。'}</p>`; });
  }
  function renderMatch() {
    const host = container.querySelector('#quiz-content')!, selection = species.filter(s => s.chapter === chapter.id).slice(0, 4);
    const choices = [...new Set(selection.map(s => s.diet))];
    host.innerHTML = `<section class="timeline-challenge"><span class="eyebrow">LIFE CONNECTIONS / 生命连线</span><h2>它们靠什么获得能量？</h2><p>把每位远古居民与知识卡中记载的营养方式相连。</p><div class="match-list">${selection.map(s => `<label>${specimenArt(s)}<strong>${escape(s.name)}</strong><select aria-label="${escape(s.name)}的营养方式" data-match="${s.id}"><option value="">选择一种方式</option>${choices.map(diet => `<option>${escape(diet)}</option>`).join('')}</select></label>`).join('')}</div><button class="btn primary" id="check-match">核对生命连线 ${icon('Check', 17)}</button><div id="match-feedback" aria-live="polite"></div></section>`;
    host.querySelector('#check-match')!.addEventListener('click', () => { let passed = true; const corrections: string[] = []; host.querySelectorAll<HTMLSelectElement>('[data-match]').forEach(select => { const s = selection.find(s => s.id === select.dataset.match)!; const correct = select.value === s.diet; select.classList.toggle('incorrect', !correct); passed &&= correct; if (!correct) corrections.push(`${s.name}：${s.diet}`); }); if (passed) store.badge('生命连线师'); host.querySelector('#match-feedback')!.innerHTML = `<div class="feedback ${passed ? 'is-correct' : 'is-incorrect'}">${passed ? '全部连线正确！已获得「生命连线师」徽章。' : `再观察一下：${escape(corrections.join('；'))}。`}</div>`; });
  }
  resetDeck(); render(); return () => {};
}
