import { badgeLabel } from './content/inquiry-badges';
import './styles.css';
import './readability.css';
import './learning.css';
import './polish.css';
import { mountRelationships } from './modes/relationships';
import { openHelp } from './modes/help';
import { openInquiry } from './modes/inquiry';
import { setupMobileNavigation } from './core/navigation';
import { species as allSpecies } from './content/species';
import { chapters } from './content/chapters';
import { questions } from './content/questions';
import type { Chapter, Mode, Species } from './core/types';
import { GameStore } from './core/store';
import { $, ambient, download, escape, icon, modal, toast } from './core/ui';
import { LifeScene } from './scene/life-scene';
import { specimenArt } from './scene/creatures';
import { showSpecimen } from './modes/specimen';
import { mountDig } from './modes/dig';
import { mountQuiz } from './modes/quiz';
import { mountLab } from './modes/lab-view';
import { prepareOffline } from './core/offline';
import { showEpochEvent, type EpochEvent, type EpochPurpose } from './modes/epoch-event';
import { openClassroomExhibit } from './modes/classroom';

const species = allSpecies.filter(s => s.status === 'published' && s.sources.length > 0 && s.sources.every(source => source.url.startsWith('https://') && source.level !== 'D'));
const store = new GameStore(species, questions);
const nav: { id: Mode; label: string; en: string; icon: string }[] = [
  { id: 'journey', label: '演化之旅', en: 'Journey', icon: 'Orbit' },
  { id: 'relationships', label: '纪元关系', en: 'Relationships', icon: 'Orbit' },
  { id: 'codex', label: '物种图鉴', en: 'Collection', icon: 'BookOpen' },
  { id: 'dig', label: '化石挖掘', en: 'Excavation', icon: 'Pickaxe' },
  { id: 'quiz', label: '知识挑战', en: 'Challenge', icon: 'Lightbulb' },
  { id: 'lab', label: '演化实验室', en: 'Laboratory', icon: 'FlaskConical' },
];
let mode: Mode = 'journey', scene: LifeScene | undefined, cleanup: (() => void) | undefined;
let codexFilter = 'all', codexSearch = '', codexChapter = 0, paused = false;
let demoTimer: ReturnType<typeof setInterval> | undefined, demoClose: (() => void) | undefined, demoActive = false;
let epochEvent: EpochEvent | undefined;
let specimenClose: (() => void) | undefined;
let closeNavigation: (restoreFocus?: boolean) => void = () => {};
let workerRegistration: Promise<ServiceWorkerRegistration | undefined> | undefined;
function registerOfflineWorker() {
  return workerRegistration = navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => undefined);
}

function shell() {
  $('#app').innerHTML = `<a class="skip-link" href="#main-content">跳到主要内容</a><aside class="sidebar" aria-label="主导航"><a class="brand" href="#journey" aria-label="生命长河首页"><div class="brand-mark">${icon('Dna', 31)}</div><div><strong>生命长河</strong><span>RIVER OF LIFE</span></div></a><div class="sidebar-intro">一场跨越 38 亿年的相遇</div><div class="nav-caption">开启你的探索</div><nav>${nav.map(item => `<button data-mode="${item.id}" class="nav-item ${mode === item.id ? 'active' : ''}">${icon(item.icon, 21)}<span>${item.label}</span>${item.id === 'codex' ? '<small id="nav-collected">0</small>' : ''}<i></i></button>`).join('')}</nav><div class="sidebar-journey"><span class="eyebrow">YOUR FIELD JOURNAL</span><div class="journal-icon">${icon('Sprout', 28)}</div><h3>好奇心，是旅程的起点。</h3><p>每一次发现，都让生命的故事更完整。</p><div class="collection-progress"><span>我的生命收藏</span><b id="sidebar-count">0 / 48</b></div><div class="progress-track"><i id="sidebar-progress"></i></div><button class="text-btn" id="my-collection">翻开我的图鉴 ${icon('ArrowUpRight', 15)}</button></div><div class="sidebar-bottom"><button id="help">${icon('BookOpen', 18)} 使用指南</button><button id="classroom">${icon('Presentation', 18)} 课堂模式</button><button id="settings">${icon('Settings2', 18)} 探索设置</button><div class="offline-label"><span class="status-dot"></span><span id="offline-label">本地保存 · 无需注册</span></div></div></aside><div class="app-body"><header class="topbar"><div class="breadcrumb"><button class="mobile-menu icon-btn" aria-label="打开导航">${icon('Menu')}</button><span>线上自然博物馆</span><span class="crumb-slash">/</span><strong id="breadcrumb-current">演化之旅</strong></div><div class="topbar-actions"><button class="icon-btn" id="search" aria-label="搜索物种">${icon('Search', 19)}</button><button class="points-pill" id="points-info" title="演化点记录已完成的学习活动"><span>${icon('Sparkles', 17)}</span><strong id="points">0</strong><span>演化点</span></button><button class="avatar" id="profile" aria-label="查看探索者记录">${icon('Leaf', 19)}</button></div></header><main id="main-content" tabindex="-1"></main><footer class="footer"><span>每一种生命，都值得被认识。</span><button id="about">关于作品与来源 ${icon('ArrowUpRight', 12)}</button></footer></div><div class="toast-region" id="toasts" aria-live="polite" aria-atomic="false"></div><div id="demo-overlay"></div>`;
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.mode as Mode)));
  $('#my-collection').addEventListener('click', () => { codexFilter = 'collected'; navigate('codex'); });
  $('#help').addEventListener('click', () => openHelp({ onJourney: () => navigate('journey'), onRelationships: () => navigate('relationships'), onInquiry: () => showInquiry(), onClassroom: showClassroom, onLab: () => navigate('lab'), onSettings: showSettings }));
  $('#settings').addEventListener('click', showSettings); $('#classroom').addEventListener('click', showClassroom); $('#profile').addEventListener('click', showProfile); $('#about').addEventListener('click', showAbout);
  $('#search').addEventListener('click', () => { navigate('codex'); $('#codex-search').focus(); });
  $('#points-info').addEventListener('click', () => modal('学习，让旅程向前', `<p class="definition">演化点只来自实际学习。没有挂机收益，也不用反复点击。</p><div class="economy-list">${[['首次观察生物', '+5'], ['首次读完知识卡', '+3'], ['每题首次答对', '+10'], ['完成化石挖掘', '+20'], ['完成章节学习任务', '+50'], ['见证纪元事件', '+100']].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('')}</div><p class="muted">第一件藏品免费收藏。后续可用演化点收藏，纪元开启需 150 点。体型对比与阅读始终免费。</p>`));
  closeNavigation=setupMobileNavigation();
  new MutationObserver(()=>scene?.pause(paused || !!document.querySelector('dialog[open]'))).observe(document.body,{childList:true});
  store.onNotice(toast); store.subscribe(updateProgress); updateProgress();
}
function currentChapter() { return chapters.find(c => c.id === store.state.chapter)!; }
function currentSpecies() { return species.filter(s => s.chapter === store.state.chapter); }
function openSpecies(s: Species, demo = false) {
  if (demo || demoActive) { demoClose?.(); const previewStore = new GameStore(species, questions, { persist: false }); previewStore.state.unlockedChapters = chapters.map(c => c.id); previewStore.state.chapter = s.chapter; const card = showSpecimen(s, previewStore, () => {}); demoClose = card.close; if (demoActive) addDemoTakeover(card.dialog); return card; }
  specimenClose?.(); const card = showSpecimen(s, store, () => navigate('lab')); specimenClose = card.close;
  card.dialog.addEventListener('close', () => {
    if (mode !== 'codex') return;
    const restore = document.activeElement instanceof HTMLElement && document.activeElement.dataset.codexId === s.id;
    renderCodexGrid();
    if (restore) (document.querySelector<HTMLElement>(`[data-codex-id="${s.id}"]`) || $('#codex-search')).focus({preventScroll:true});
  }, {once:true});
  return card;
}
function navigate(next: Mode, replaceHash = false) {
  if (demoActive) stopDemo();
  closeEpochEvent();
  Array.from(document.querySelectorAll('dialog[open]')).reverse().forEach(dialog => dialog.dispatchEvent(new Event('cancel', {cancelable:true})));
  mode = next; paused = false; closeNavigation(false); cleanup?.(); cleanup = undefined; scene?.dispose(); scene = undefined;
  if (location.hash !== `#${next}`) {
    if (replaceHash) history.replaceState(null, '', `#${next}`);
    else history.pushState(null, '', `#${next}`);
  }
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => { button.classList.toggle('active', button.dataset.mode === mode); if (button.dataset.mode === mode) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
  const pageName = nav.find(n => n.id === next)!.label;
  $('#breadcrumb-current').textContent = pageName; document.title = `${pageName} · 生命长河`;
  const main = $('#main-content');
  if (mode === 'journey') renderJourney(main);
  if (mode === 'relationships') mountRelationships(main, s => { const specimen = showSpecimen(s, store, () => {}, { readOnly: true }); specimenClose = specimen.close; });
  if (mode === 'codex') renderCodex(main);
  if (mode === 'dig') cleanup = mountDig(main, currentChapter(), currentSpecies()[0], store, () => openSpecies(currentSpecies()[0]));
  if (mode === 'quiz') cleanup = mountQuiz(main, currentChapter(), species, questions, store, s => openSpecies(s));
  if (mode === 'lab') cleanup = mountLab(main, store);
  updateProgress(); window.scrollTo({ top: 0, behavior: 'instant' }); main.focus({preventScroll:true});
}
function updateProgress() {
  if (!document.getElementById('points')) return;
  $('#points').textContent = store.state.points.toLocaleString(); $('#nav-collected').textContent = String(store.state.collected.length);
  $('#sidebar-count').textContent = `${store.state.collected.length} / ${species.length}`; $('#sidebar-progress').style.width = `${store.state.collected.length / species.length * 100}%`;
  document.body.classList.toggle('projection', store.state.settings.projection); document.body.classList.toggle('reduced-motion', store.state.settings.reducedMotion);
  if (mode === 'journey') renderTasks();
  const count = document.getElementById('codex-collected-count');
  if (count) count.textContent = String(store.state.collected.length);
  document.querySelectorAll<HTMLElement>('[data-collected-id]').forEach(el => { el.classList.toggle('is-collected', store.state.collected.includes(el.dataset.collectedId!)); });
}

function renderJourney(main: HTMLElement) {
  const chapter = currentChapter();
  main.innerHTML = `<section class="welcome"><div><div class="section-kicker"><span></span> 从一粒微光，到万物生长</div><h1>38 亿年，<span>与你相遇。</span></h1><p>潜入远古的海洋，遇见生命最初的模样。你的每一次好奇，都让旅程向前。</p></div><div class="welcome-actions"><button class="btn inquiry-launch" id="start-inquiry">${icon('Compass', 17)} 3 分钟，做一次证据探究</button><button class="btn demo-button" id="start-demo">${icon('Play', 16)} 90 秒看懂生命长河</button></div></section>
  <div class="journey-grid"><section class="scene-card"><div id="life-scene"></div><div class="scene-vignette"></div><div class="scene-title"><span class="scene-eyebrow">CHAPTER ${String(chapter.id).padStart(2, '0')} <i></i> ${escape(chapter.subtitle)}</span><h2>${escape(chapter.title)}</h2><p>${escape(chapter.range)} · ${escape(chapter.name)}</p></div><div class="scene-live"><i></i> 生命正在发生</div><div class="scene-tools"><button class="scene-btn" id="scene-reset" aria-label="重置观察视角">${icon('RotateCcw', 18)}</button><button class="scene-btn" id="scene-zoom" aria-label="放大场景">${icon('Plus', 19)}</button><button class="scene-btn" id="scene-out" aria-label="缩小场景">${icon('Minus', 19)}</button><span></span><button class="scene-btn" id="scene-pause" aria-label="暂停生物动画">${icon('Pause', 18)}</button><button class="scene-btn" id="scene-photo" aria-label="拍摄场景照片">${icon('Camera', 18)}</button><button class="scene-btn" id="scene-sound" aria-label="切换环境音" aria-pressed="${store.state.settings.sound}">${icon(store.state.settings.sound ? 'Volume2' : 'VolumeX', 18)}</button></div><div class="scene-bottom"><span>${icon('MousePointer2', 15)} 拖动环顾 · 滚轮缩放 · 点击生命</span><span>交互生态展景</span></div><div class="scene-loading" id="scene-loading">${icon('Orbit', 24)} 正在打开远古世界</div></section>
  <aside class="expedition"><div class="expedition-heading"><div><span class="eyebrow">YOUR EXPEDITION</span><h2>本章探索</h2></div><span class="chapter-seal">${String(chapter.id).padStart(2, '0')}</span></div><div class="guide-quote"><span>${icon('Compass', 23)}</span><p>${escape(chapter.question)}</p></div><div id="chapter-tasks"></div><div class="chapter-completion" id="chapter-completion"></div><div class="expedition-foot">${icon('Leaf', 14)} 学到一点，世界就展开一点。</div></aside></div>
  <section class="chapter-section"><div class="section-row"><div><h2>沿着时间，向生命深处</h2><span>八个纪元 · 一部仍在书写的生命史</span></div><button class="text-btn" id="view-tree">查看演化地图 ${icon('ArrowUpRight', 16)}</button></div><div class="chapter-timeline">${chapters.map(c => `<button class="chapter-node ${c.id === chapter.id ? 'active' : ''} ${store.state.unlockedChapters.includes(c.id) ? 'unlocked' : 'locked'}" data-chapter="${c.id}" aria-label="${escape(c.name)}${store.state.unlockedChapters.includes(c.id) ? '' : '，尚未开启'}"><span class="timeline-line"></span><span class="timeline-node">${store.state.completedChapters.includes(c.id) ? icon('Check', 13) : store.state.unlockedChapters.includes(c.id) ? '<i></i>' : icon('LockKeyhole', 11)}</span><strong>${escape(c.name)}</strong><small>${escape(c.range)}</small>${c.id === chapter.id ? '<em>你在这里</em>' : `<b>${String(c.id).padStart(2, '0')}</b>`}</button>`).join('')}</div></section>
  <section class="discovery-section"><div class="section-row"><div><h2>认识这个纪元的居民</h2><span>生命的故事，从一次发现开始</span></div><button class="text-btn" id="view-codex">打开物种图鉴 ${icon('ArrowRight', 16)}</button></div><div class="resident-grid">${currentSpecies().slice(0, 3).map(s => `<button class="resident-card" data-open-species="${s.id}" data-collected-id="${s.id}"><div class="resident-art">${specimenArt(s)}</div><div><span class="resident-tag">${s.rarity === 'star' ? '明星物种' : '远古来客'}</span><h3>${escape(s.name)}</h3><i>${escape(s.latin)}</i><span class="resident-detail">${escape(s.sizeLabel)} <b>·</b> ${escape(s.habitat)}</span></div><span class="resident-arrow">${icon('ArrowUpRight', 19)}</span></button>`).join('')}</div></section><p class="scene-note">展景汇集同一章节的代表生命，不表示它们同时同地共存；未取得开放模型的条目以结构示意呈现。</p>`;
  scene = new LifeScene($('#life-scene'), s => openSpecies(s), store.state.settings); scene.setChapter(chapter, currentSpecies());
  requestAnimationFrame(() => $('#scene-loading')?.remove());
  $('#start-inquiry').addEventListener('click', () => showInquiry()); $('#start-demo').addEventListener('click', startDemo); $('#scene-reset').addEventListener('click', () => scene?.reset()); $('#scene-zoom').addEventListener('click', () => scene?.zoom(.8)); $('#scene-out').addEventListener('click', () => scene?.zoom(1.2));
  $('#scene-pause').addEventListener('click', e => { paused = !paused; scene?.pause(paused); (e.currentTarget as HTMLElement).innerHTML = icon(paused ? 'Play' : 'Pause', 18); (e.currentTarget as HTMLElement).setAttribute('aria-label', paused ? '播放生物动画' : '暂停生物动画'); });
  $('#scene-sound').addEventListener('click', e => { const enabled = !store.state.settings.sound; store.settings({ sound: enabled }); ambient(enabled); (e.currentTarget as HTMLElement).innerHTML = icon(enabled ? 'Volume2' : 'VolumeX', 18); (e.currentTarget as HTMLElement).setAttribute('aria-pressed', String(enabled)); });
  $('#scene-photo').addEventListener('click', async () => { const blob = await scene?.screenshot(); if (blob) { download(`生命长河-${chapter.name}.png`, blob); toast('这一刻，已保存为照片。'); } });
  $('#view-tree').addEventListener('click', showTree); $('#view-codex').addEventListener('click', () => { codexChapter = chapter.id; navigate('codex'); });
  main.querySelectorAll<HTMLButtonElement>('[data-chapter]').forEach(b => b.addEventListener('click', () => visitChapter(Number(b.dataset.chapter))));
  main.querySelectorAll<HTMLButtonElement>('[data-open-species]').forEach(b => b.addEventListener('click', () => openSpecies(species.find(s => s.id === b.dataset.openSpecies)!)));
  renderTasks();
}
function renderTasks() {
  if (!document.getElementById('chapter-tasks')) return;
  const chapter = currentChapter(), tasks = store.taskProgress(chapter.id), completed = store.state.completedChapters.includes(chapter.id);
  $('#chapter-tasks').innerHTML = tasks.slice(0, 3).map(t => `<button class="task-row ${t.current >= t.target ? 'done' : ''}" data-task-mode="${t.mode}"><span class="task-icon">${icon(t.current >= t.target ? 'Check' : t.icon, 17)}</span><span><strong>${t.label}</strong><small>完成可得 <b>+50</b> 演化点</small></span><b>${Math.min(t.current, t.target)}<i>/${t.target}</i></b></button>`).join('');
  const count = tasks.slice(0, 3).filter(t => t.current >= t.target).length;
  $('#chapter-completion').innerHTML = `<div><span>纪元探索进度</span><strong>${Math.round(count / 3 * 100)}%</strong></div><div class="progress-track"><i style="width:${count / 3 * 100}%"></i></div><button class="btn primary" id="chapter-event" ${!completed && !store.canComplete(chapter.id) ? 'disabled' : ''}>${completed ? (chapter.id === 8 ? '重温生命的故事' : '前往下一个纪元') : '见证纪元大事件'} ${icon('ArrowRight', 16)}</button>${!completed && count < 3 ? '<small>完成上方三项任务，让旅程继续。</small>' : ''}`;
  document.querySelectorAll<HTMLButtonElement>('[data-task-mode]').forEach(b => b.addEventListener('click', () => { const next = b.dataset.taskMode as Mode; if (next === 'journey') { scene?.focusSpecies(currentSpecies().find(s => !store.state.observed.includes(s.id))?.id || currentSpecies()[0].id); toast('点击场景中的生物，或下方物种卡片开始观察。'); } else { if (next === 'codex') codexChapter = chapter.id; navigate(next); } }));
  if (completed) {
    const replay = document.createElement('button'); replay.id = 'chapter-replay'; replay.className = 'btn'; replay.textContent = '重温纪元事件';
    replay.addEventListener('click', () => playEvent(chapter)); $('#chapter-completion').append(replay);
  }
  $('#chapter-event').addEventListener('click', () => { if (completed && chapter.id < 8) visitChapter(chapter.id + 1); else playEvent(chapter); });
}
function visitChapter(id: number) {
  const chapter = chapters.find(c => c.id === id)!;
  if (store.state.unlockedChapters.includes(id)) { store.setChapter(id); navigate('journey'); return; }
  const { dialog, close } = modal(`${chapter.name} · 尚待探索`, `<span class="eyebrow">CHAPTER ${String(id).padStart(2, '0')}</span><h3 class="chapter-preview-title">${escape(chapter.title)}</h3><p>${escape(chapter.description)}</p><div class="chapter-preview-art">${specimenArt(species.find(s => s.chapter === id)!)}</div><p class="muted">先完成上一纪元的探索，再用 ${chapter.cost} 演化点开启。解锁后可以随时返回已到访的章节。</p><button class="btn primary" id="unlock-chapter">${icon('KeyRound', 17)} 开启纪元 · ${chapter.cost} 演化点</button>`);
  dialog.querySelector('#unlock-chapter')!.addEventListener('click', () => { const error = store.unlock(id, chapter.cost); if (error) toast(error); else { close(); navigate('journey'); toast(`欢迎来到${chapter.name}`); } });
}
function closeEpochEvent() {
  const current = epochEvent; epochEvent = undefined; current?.close(); scene?.pause(paused);
}
function playEvent(chapter: Chapter, purpose: EpochPurpose = 'journey', onClosed?: () => void) {
  closeEpochEvent();
  const returnFocusId = document.activeElement instanceof HTMLElement ? document.activeElement.id : '';
  const firstCompletion = !store.state.completedChapters.includes(chapter.id);
  if (purpose === 'journey' && firstCompletion && !store.complete(chapter.id)) return;
  // Completing a chapter refreshes task buttons; capture their replacement for restoration.
  if (returnFocusId) document.getElementById(returnFocusId)?.focus({ preventScroll: true });
  scene?.pause(true);
  let current: EpochEvent;
  current = showEpochEvent({ chapter, settings: store.state.settings, purpose, firstCompletion, onClose: reason => {
    onClosed?.();
    if (epochEvent !== current) return;
    epochEvent = undefined; scene?.pause(paused || !!document.querySelector('.classroom-exhibit'));
    if (purpose === 'demo') { if (reason === 'dispose') stopDemo(); return; }
    if (purpose === 'classroom') return;
    toast(firstCompletion ? '纪元探索完成 · +100 演化点' : '纪元事件已重温 · 本次不重复奖励');
    // store.complete already refreshed progress; retain the restored trigger's focus.
  } });
  epochEvent = current;
}
function renderCodex(main: HTMLElement) {
  main.innerHTML = `<div class="section-heading"><div><span class="eyebrow">THE LIVING ARCHIVE</span><h1>每一种生命，都是一个世界。</h1><p>从微小细胞到庞然巨兽，把遇见的生命，收藏成自己的演化史。</p></div><div class="codex-count"><strong><b id="codex-collected-count">${store.state.collected.length}</b><span> / ${species.length}</span></strong><small>已收藏的生命</small></div></div><div class="codex-toolbar"><div class="filter-tabs">${[['all', '全部物种'], ['collected', '我的收藏'], ['discovered', '已发现']].map(([id, label]) => `<button data-filter="${id}" aria-pressed="${codexFilter === id}" class="${codexFilter === id ? 'active' : ''}">${label}</button>`).join('')}</div><div class="codex-search-tools"><label class="search-field">${icon('Search', 17)}<input id="codex-search" placeholder="寻找一个生命…" aria-label="搜索中文名或拉丁名" value="${escape(codexSearch)}"></label><select id="codex-chapter" aria-label="按纪元筛选"><option value="0">全部纪元</option>${chapters.map(c => `<option value="${c.id}" ${codexChapter === c.id ? 'selected' : ''}>${escape(c.name)}</option>`).join('')}</select></div></div><div class="codex-result-row"><p id="codex-results" class="codex-results" role="status" aria-live="polite"></p><button class="text-btn" id="reset-codex-filters" hidden>清除筛选 ${icon('X',14)}</button></div><div class="codex-grid" id="codex-grid"></div><p class="scene-note">档案中的结构示意用于学习，不替代科学复原。开放许可模型与馆藏化石会在展台内分别署名。</p>`;
  main.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(b => b.addEventListener('click', () => { codexFilter = b.dataset.filter!; renderCodex(main); main.querySelector<HTMLButtonElement>(`[data-filter="${codexFilter}"]`)?.focus(); }));
  $('#codex-search').addEventListener('input', e => { codexSearch = (e.target as HTMLInputElement).value; renderCodexGrid(); }); $('#codex-chapter').addEventListener('change', e => { codexChapter = Number((e.target as HTMLSelectElement).value); renderCodexGrid(); }); renderCodexGrid();
}
function resetCodexFilters() {
  codexFilter = 'all'; codexChapter = 0; codexSearch = '';
  renderCodex($('#main-content'));
  $('#codex-search').focus({preventScroll:true});
}
function renderCodexGrid() {
  const filtered = species.filter(s => (!codexChapter || s.chapter === codexChapter) && (codexFilter === 'all' || (codexFilter === 'collected' ? store.state.collected : store.state.observed).includes(s.id)) && `${s.name} ${s.latin}`.toLowerCase().includes(codexSearch.toLowerCase().trim()));
  $('#codex-results').textContent=`找到 ${filtered.length} 个生命档案`;
  const reset = document.querySelector<HTMLButtonElement>('#reset-codex-filters')!;
  reset.hidden = codexFilter === 'all' && !codexChapter && !codexSearch;
  reset.onclick = resetCodexFilters;
  $('#codex-grid').innerHTML = filtered.length ? filtered.map(s => `<button class="codex-card ${store.state.collected.includes(s.id) ? 'is-collected' : ''}" data-codex-id="${s.id}" data-collected-id="${s.id}"><div class="codex-art"><span class="codex-era">${escape(s.period)}</span>${specimenArt(s)}<span class="codex-state">${icon(store.state.collected.includes(s.id) ? 'BookmarkCheck' : store.state.unlockedChapters.includes(s.chapter) ? 'Plus' : 'LockKeyhole', 17)}</span></div><div class="codex-card-copy"><div><h3>${escape(s.name)}</h3><span class="rarity ${s.rarity}">${s.rarity === 'star' ? '明星' : s.rarity === 'rare' ? '珍稀' : '常见'}</span></div><i>${escape(s.latin)}</i><p>${escape(s.definition)}</p><div class="codex-card-bottom"><span>${escape(s.sizeLabel)}</span><span>${store.state.collected.includes(s.id) ? '已收藏' : '翻开档案'} ${icon('ArrowUpRight', 13)}</span></div></div></button>`).join('') : `<div class="empty-state">${icon('Search', 42)}<h2>这段旅程，等待新的发现。</h2><p>试试其他名称、切换纪元，或返回场景认识第一位生命。</p><button class="btn" id="clear-filters">查看全部物种</button></div>`;
  $('#codex-grid').querySelectorAll<HTMLButtonElement>('[data-codex-id]').forEach(b => b.addEventListener('click', () => openSpecies(species.find(s => s.id === b.dataset.codexId)!)));
  document.getElementById('clear-filters')?.addEventListener('click', resetCodexFilters);
}
function showTree() {
  const { dialog, close } = modal('一条时间长河，无数生命分支', `<p class="muted">这是章节探索地图，并非将演化画成通往人类的阶梯。不同谱系分支共存，灭绝与繁盛也不断交错。</p><div class="tree-list">${chapters.map(c => `<button class="tree-row" data-tree="${c.id}"><span>${String(c.id).padStart(2, '0')}</span><div><h3>${escape(c.name)}</h3><p>${escape(c.range)} · ${escape(c.question)}</p></div>${icon(store.state.completedChapters.includes(c.id) ? 'CircleCheck' : store.state.unlockedChapters.includes(c.id) ? 'ArrowRight' : 'LockKeyhole', 20)}</button>`).join('')}</div>`, true);
  dialog.querySelectorAll<HTMLButtonElement>('[data-tree]').forEach(b => b.addEventListener('click', () => { close(); visitChapter(Number(b.dataset.tree)); }));
}
function showSettings() {
  const p = store.state.settings;
  const { dialog, close } = modal('让探索，适合你的节奏', `<div class="settings-list"><label><span><strong>减少动态效果</strong><small>暂停生物摆动和自动镜头过渡</small></span><input type="checkbox" id="reduced-motion" ${p.reducedMotion ? 'checked' : ''}></label><label><span><strong>投影与大字模式</strong><small>增大字号，提高教室投影可读性</small></span><input type="checkbox" id="projection" ${p.projection ? 'checked' : ''}></label><label><span><strong>画面质量</strong><small>低画质可降低移动设备负担</small></span><select id="quality"><option value="auto">自动</option><option value="high">高</option><option value="low">省电</option></select></label></div><h3>让发现留在身边</h3><p class="muted">进度保存在当前浏览器。更换设备前，请导出探索记录。</p><div class="settings-actions"><button class="btn" id="export-save">${icon('Download', 17)} 导出记录</button><button class="btn" id="import-save-trigger">${icon('Upload', 17)} 导入记录</button><input type="file" id="import-save" accept=".json,application/json" hidden><button class="btn" id="cache-offline">${icon('CloudDownload', 17)} 准备离线展馆</button></div><progress id="offline-progress" class="offline-progress" aria-label="离线资源准备进度" hidden></progress><p id="offline-status" class="muted" role="status"></p><details class="reset-details"><summary>重新开始探索</summary><p>这会清除本浏览器的学习记录，请先导出备份。</p><button class="btn danger" id="reset-save">清空记录并重新开始</button></details>`);
  (dialog.querySelector('#quality') as HTMLSelectElement).value = p.quality;
  dialog.querySelector('#reduced-motion')!.addEventListener('change', e => { store.settings({ reducedMotion: (e.target as HTMLInputElement).checked }); scene?.reducedMotion(store.state.settings.reducedMotion); });
  dialog.querySelector('#projection')!.addEventListener('change', e => store.settings({ projection: (e.target as HTMLInputElement).checked }));
  dialog.querySelector('#quality')!.addEventListener('change', e => { store.settings({ quality: (e.target as HTMLSelectElement).value as 'auto' }); scene?.setQuality(store.state.settings.quality); });
  dialog.querySelector('#export-save')!.addEventListener('click', () => download('生命长河-探索记录.json', store.export(), 'application/json'));
  dialog.querySelector('#import-save-trigger')!.addEventListener('click',()=>dialog.querySelector<HTMLInputElement>('#import-save')!.click());
  dialog.querySelector('#import-save')!.addEventListener('change', async e => { const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return; try { if(file.size>250000)throw new Error('记录文件过大，请选择导出的 JSON 记录。'); store.import(await file.text()); close(); navigate(mode); toast('探索记录已导入，欢迎回来。'); } catch (error) { toast((error as Error).message); } });
  dialog.querySelector('#cache-offline')!.addEventListener('click', async e => {
    const button = e.currentTarget as HTMLButtonElement, status = dialog.querySelector('#offline-status')!;
    if (import.meta.env.DEV) { status.textContent = '开发预览不缓存代码。运行 npm run build 和 npm run preview 后可准备离线展馆。'; return; }
    if (!('serviceWorker' in navigator)) { status.textContent = '当前浏览器不支持离线缓存，请使用支持离线服务的浏览器重试。'; return; }
    button.disabled = true; button.setAttribute('aria-busy','true');
    const progress = dialog.querySelector<HTMLProgressElement>('#offline-progress')!; progress.hidden=false;progress.removeAttribute('value');
    status.textContent = '正在保存展馆与模型，请保持此页面打开…';
    try {
      const ready = await prepareOffline(navigator.serviceWorker, workerRegistration || registerOfflineWorker(), 12000, 45000, ({completed,total}) => {progress.max=total;progress.value=completed;status.textContent=`已准备 ${completed} / ${total} 项资源，请保持页面打开…`;});
      status.textContent = ready ? '展馆、知识卡与本地模型已缓存，可断网继续探索。手机系统 AR 与语音可能仍需网络。' : '部分资产未能缓存，请联网后重试。';
    } catch (error) { workerRegistration = undefined; status.textContent = error instanceof Error ? error.message : '当前浏览器无法创建离线缓存，请重试。'; }
    finally { button.disabled = false;button.removeAttribute('aria-busy');progress.hidden=true; }
  });
  dialog.querySelector('#reset-save')!.addEventListener('click', () => {
    const review=modal('确认重新开始探索',`<div class="save-review"><p>当前已有 ${store.state.observed.length} 个观察记录、${store.state.collected.length} 件藏品和 ${store.state.completedChapters.length} 个已完成纪元。重新开始会清除这些进度。</p><p>你可以先导出记录，之后通过导入恢复。</p><div class="save-review-actions"><button class="btn" id="backup-before-reset">先导出记录</button><button class="btn" id="cancel-reset">保留当前进度</button><button class="btn danger" id="confirm-reset">确认重新开始</button></div></div>`);
    review.dialog.querySelector('#backup-before-reset')!.addEventListener('click',()=>download('生命长河-重新开始前的记录.json',store.export(),'application/json'));
    review.dialog.querySelector('#cancel-reset')!.addEventListener('click',review.close);
    review.dialog.querySelector('#confirm-reset')!.addEventListener('click',()=>{store.reset();review.close();close();navigate('journey');toast('新的一页，等待你的发现。');});
    review.dialog.querySelector<HTMLButtonElement>('#cancel-reset')!.focus();
  });
}
function showProfile() {
  modal('你的生命探索手记', `<div class="profile-grid"><div><strong>${store.state.observed.length}</strong><span>认识的生命</span></div><div><strong>${store.state.collected.length}</strong><span>收藏的档案</span></div><div><strong>${store.state.completedChapters.length}</strong><span>走过的纪元</span></div><div><strong>${store.state.totalEarned}</strong><span>累计演化点</span></div></div><h3>一路拾起的徽章</h3><div class="badge-list">${store.state.badges.length ? store.state.badges.map(b => `<span>${icon('Award', 20)}${escape(badgeLabel(b))}</span>`).join('') : '<p class="muted">尝试时间轴排序、生命连线或实验室观察，收获你的第一枚徽章。</p>'}</div>`);
}
function showInquiry(context: 'personal' | 'classroom' = 'personal') {
  const eligible = context === 'personal' && !demoActive;
  if(demoActive) stopDemo();
  openInquiry(species,s=>openSpecies(s,true), eligible ? id => { if (store.inquiryBadge(id)) toast(badgeLabel(id)); } : undefined);
}
function showClassroom() {
  const { dialog, close } = modal('把一段生命史，带进课堂', `<p>选择任一纪元进行教学预览，不改变个人学习进度。</p><div class="classroom-options">${chapters.map(c => `<button class="btn" data-classroom="${c.id}">${String(c.id).padStart(2, '0')} ${escape(c.name)}</button>`).join('')}</div><div class="classroom-inquiry-entry"><div><h3>从观察，走向解释</h3><p>三组证据探究：记录判断、比较资料、迁移解释，最后导出学生记录。</p></div><button class="btn" id="classroom-inquiry">${icon('Compass',17)} 开始证据探究</button></div><button class="btn primary" id="worksheet">${icon('FileDown', 18)} 导出当前纪元学习单</button><p class="muted">学习单包含观察问题、知识卡参考链接与开放思考题。浏览器打印时可保存为 PDF。</p>`);
  dialog.querySelectorAll<HTMLButtonElement>('[data-classroom]').forEach(button => button.addEventListener('click', () => { const c = chapters.find(c => c.id === Number(button.dataset.classroom))!; close(); classroomPreview(c); }));
  dialog.querySelector('#worksheet')!.addEventListener('click', () => worksheet(currentChapter()));
  dialog.querySelector('#classroom-inquiry')!.addEventListener('click',()=>{close();showInquiry('classroom');});
}
function worksheet(chapter: Chapter) {
  const list = species.filter(s => s.chapter === chapter.id);
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>生命长河 · ${escape(chapter.name)}学习单</title><style>body{font:16px/1.8 sans-serif;max-width:800px;margin:50px auto;padding:20px;color:#203d37}h1{border-bottom:2px solid}li{margin:18px 0}a{color:inherit}small{color:#555}@media print{body{margin:0}button{display:none}}</style><h1>生命长河 · ${escape(chapter.name)}</h1><p>姓名：____________ 日期：____________</p><p>引导问题：${escape(chapter.question)}</p><h2>观察与记录</h2><ol>${list.slice(0, 3).map(s => `<li>观察${escape(s.name)}，画出或描述你看到的身体结构。<p>________________________________________________________</p></li>`).join('')}</ol><h2>思考与讨论</h2><p>${escape(chapter.takeaway)}</p><p>图鉴的结构示意和真实化石有哪些区别？哪些信息需要更多证据？</p><p>________________________________________________________</p><h2>参考知识卡</h2>${list.map(s => `<p><b>${escape(s.name)}</b>：${escape(s.definition)}<br>${s.sources.map(source => `<a href="${escape(source.url)}">[${source.level}] ${escape(source.title)}</a>`).join(' · ')}</p>`).join('')}<small>复原形象为科学理解的艺术呈现，知识随研究更新。</small></html>`;
  download(`生命长河-${chapter.name}-学习单.html`, html, 'text/html;charset=utf-8'); toast('学习单已导出，可用浏览器打开并打印。');
}
function classroomPreview(chapter: Chapter) {
  scene?.pause(true);
  openClassroomExhibit({ chapter, residents: species.filter(s=>s.chapter===chapter.id), settings: store.state.settings,
    onSpecies: s=>openSpecies(s,true), onEvent: onClosed=>playEvent(chapter,'classroom',onClosed),
    onWorksheet: ()=>worksheet(chapter), onChooseChapter: showClassroom, onClose: ()=>scene?.pause(paused || !!document.querySelector('.classroom-exhibit')) });
}
function showAbout() {
  modal('一座关于生命，也关于证据的博物馆', `<p class="definition">《生命长河》是一部可以探索、学习与收集的生命演化史。观察、阅读与答题推动探索进度；证据探究进一步练习解释。</p><h3>面向课堂的学习活动</h3><p>三组活动记录初始判断、证据选择与新情境解释，支持三维与文字路线，并可导出探究记录。实验室提供同起点的双环境对照与逐代数据。目标使用者为小学高年级与初中课堂，年龄适配、活动用时和教学效果尚待试测；操作记录不等于知识掌握。</p><h3>我们如何讲述生命</h3><p>复原形象是基于科学理解的艺术呈现，并非学术定论；年代和体型为近似。各章汇集代表类群，不表示它们都曾共存。“人类世”是讨论人类影响的概念，并非此处认定的正式地质年代。</p><h3>每条知识都有来处</h3><p>知识来源分为 A 学术文献、B 科研与博物馆机构、C 百科参考。当前资料以已核对的 C 级百科与部分 B 级机构为主，参赛前还需要专业人工复核。无来源的条目不会进入图鉴。</p><h3>模型与原创</h3><p>开放模型在对应展台署名。未取得合适资产的物种展示原创结构示意，不能等同于科学复原。开发使用 AI 辅助编程、结构示意建模与文稿整理；完整记录见项目 AI_USAGE.md 与 CREDITS.md。</p><h3>数据如何保留</h3><p>个人探索记录保存在当前站点的浏览器中，不要求账户，也未接入广告或行为分析服务。导出文件由你保管；清理浏览器站点数据可能同时移除记录与离线缓存。来源链接会打开外部网站，适用对方的数据规则。</p><h3>本地向导</h3><p>观察生物会展示来自知识卡的解释；当前不连接外部大模型。实验室是简化教学模型，不能用于预测真实物种演化。</p>`);
}
function stopDemo() {
  demoActive = false; clearInterval(demoTimer); demoClose?.(); demoClose = undefined; closeEpochEvent(); $('#demo-overlay').innerHTML = ''; scene?.setChapter(currentChapter(), currentSpecies());
}
function addDemoTakeover(dialog: HTMLDialogElement) {
  const button = document.createElement('button'); button.className = 'btn small demo-dialog-takeover'; button.textContent = '结束演示，接管探索';
  dialog.querySelector('.modal-head')!.insertBefore(button, dialog.querySelector('.close-modal'));
  button.addEventListener('click', stopDemo);
}
function startDemo() {
  if (demoActive) return; closeEpochEvent(); specimenClose?.(); specimenClose = undefined; demoClose?.(); demoClose = undefined; if (mode !== 'journey') navigate('journey'); demoActive = true;
  let seconds = 0; const cambrian = chapters[1], residents = species.filter(s => s.chapter === 2); scene?.setChapter(cambrian, residents);
  const stages = ['潜入寒武纪海洋，拖动就能环顾远古世界。', '每一个名字背后，都是一个可以观察的生命。', '旋转三维展台，让身体结构变得清晰。', '阅读有来源的知识，才是演化点的起点。', '拂去岩层，让沉睡的生命重见天日。', '一段生命史结束，新的世界正在展开。'];
  const draw = () => { $('#demo-overlay').innerHTML = `<div class="demo-bar"><span>${icon('Play', 16)} 演示中 <b>${String(seconds).padStart(2, '0')} / 90 秒</b></span><p>${stages[Math.min(5, Math.floor(seconds / 15))]}</p><div class="demo-progress"><i style="width:${seconds / 90 * 100}%"></i></div><button class="btn small" id="take-over">接管探索 ${icon('MousePointer2', 15)}</button></div>`; $('#take-over').addEventListener('click', stopDemo); };
  draw();
  demoTimer = setInterval(() => {
    seconds++; draw();
    if (seconds === 15) scene?.focusSpecies(residents[0].id);
    if (seconds === 25) openSpecies(residents.find(s => s.form === 'anomalocaris') || residents[1], true);
    if (seconds === 48) { demoClose?.(); demoClose = undefined; scene?.focusSpecies(residents[2].id); }
    if (seconds === 58) { demoClose?.(); const { dialog, close } = modal('化石挖掘 · 演示', '<div id="demo-dig"></div>', true); const preview = new GameStore(species, questions, { persist: false }); preview.state.unlockedChapters = [1, 2]; mountDig(dialog.querySelector('#demo-dig')!, cambrian, residents[0], preview, () => {}); demoClose = close; addDemoTakeover(dialog); }
    if (seconds >= 60 && seconds <= 68) (document.querySelector('#demo-dig #dig-accessible') as HTMLButtonElement | null)?.click();
    if (seconds === 75) { demoClose?.(); demoClose = undefined; playEvent(cambrian, 'demo'); }
    if (seconds >= 90) { stopDemo(); toast('演示结束，开始你自己的生命之旅吧。'); }
  }, 1000);
}

async function init() {
  await store.init();
  // Demo stores are isolated from persistence; only the main store initializes its backing storage.
  shell(); const hash = location.hash.slice(1) as Mode; navigate(nav.some(n => n.id === hash) ? hash : 'journey', true);
  window.addEventListener('hashchange', () => { const target = location.hash.slice(1) as Mode; if (nav.some(n => n.id === target) && target !== mode) navigate(target, true); });
  const connectionLabel = () => { $('#offline-label').textContent = navigator.onLine ? '本地记录 · 无需注册' : '当前离线 · 可用功能取决于缓存'; };
  connectionLabel(); window.addEventListener('offline', connectionLabel); window.addEventListener('online', connectionLabel);
  if (import.meta.env.PROD && 'serviceWorker' in navigator) void registerOfflineWorker();
  // Read-only diagnostics for reproducible performance evidence.
  Object.defineProperty(window, '__lifeDiagnostics', { value: () => ({ scene: scene?.stats, epochEvent: epochEvent?.stats, progress: structuredClone(store.state), species: species.length, questions: questions.length, mode, chapter: store.state.chapter }), configurable: true });
}
void init();
