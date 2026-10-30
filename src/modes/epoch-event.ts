import '../epoch-event.css';
import type { Chapter, Progress } from '../core/types';
import { escape, icon } from '../core/ui';
import { EpochCinematic } from '../scene/epoch-cinematic';
import { EPOCHS, EpochClock } from '../scene/epoch-timeline';
import { EpochAudio } from './epoch-audio';

export type EpochPurpose = 'journey' | 'demo' | 'classroom';
export type EpochEventOptions = { chapter: Chapter; settings: Progress['settings']; purpose: EpochPurpose; firstCompletion: boolean; onClose: (reason: 'exit' | 'dispose') => void };
let sequence = 0;
export function showEpochEvent(options: EpochEventOptions) {
  const { chapter, settings, purpose } = options, definition = EPOCHS[chapter.id];
  const priorFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  const systemMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = settings.reducedMotion || systemMotion.matches, closed = false, raf = 0;
  const clock = new EpochClock(purpose === 'demo' ? 9 : 10), dialog = document.createElement('dialog'), id = ++sequence;
  dialog.className = 'epoch-event epoch-cinematic'; dialog.dataset.chapter = String(chapter.id); dialog.dataset.theme = definition.theme;
  dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', `epoch-title-${id}`); dialog.setAttribute('aria-describedby', `epoch-description-${id}`);
  dialog.style.setProperty('--epoch-accent', definition.accent);
  const reward = purpose === 'demo' ? '演示预览 · 不写入学习记录' : purpose === 'classroom' ? '课堂预览 · 不记录学习奖励' : options.firstCompletion ? '首次完成 · 已获得 100 演化点' : '重温纪元 · 本次不重复奖励';
  dialog.innerHTML = `<div class="epoch-shell"><header class="epoch-header"><div><span class="eyebrow">EPOCH / ${String(chapter.id).padStart(2, '0')}</span><span class="epoch-chapter">${escape(chapter.name)} · ${escape(chapter.range)}</span></div><button class="epoch-close" data-epoch-close aria-label="关闭纪元高光">${icon('X', 22)}</button></header><div class="epoch-body"><section class="epoch-visual" aria-label="${escape(definition.label)}的抽象教学示意"><div class="epoch-stage"></div><div class="epoch-visual-label"><span>关键帧 / 抽象教学示意</span><strong>${escape(definition.label)}</strong></div><div class="epoch-stage-caption" aria-live="polite" aria-atomic="true"></div></section><section class="epoch-copy"><span class="eyebrow">A TURNING POINT IN LIFE</span><h2 id="epoch-title-${id}">${escape(chapter.event)}</h2><p class="epoch-description" id="epoch-description-${id}">${escape(chapter.eventDescription)}</p><div class="epoch-summary"><span>带走一个发现</span><blockquote>${escape(chapter.takeaway)}</blockquote></div><p class="epoch-context">时间已压缩 · 非真实灾变模拟。画面中的轮廓、色彩与路线用于教学示意。</p><p class="epoch-motion-note" ${reduced ? '' : 'hidden'}>减少动态已启用：以静态关键帧呈现，可暂停字幕或直接阅读总结。</p><p class="epoch-reward">${escape(reward)}</p></section></div><footer class="epoch-controls"><div class="epoch-progress-row"><span class="epoch-playback" role="status" aria-live="polite"></span><span class="epoch-time" aria-hidden="true"></span></div><div class="epoch-progress" role="progressbar" aria-label="纪元高光播放进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><div class="epoch-actions"><button class="btn" data-epoch-pause>${icon('Pause', 16)} 暂停</button><button class="btn" data-epoch-skip>跳到总结 ${icon('SkipForward', 16)}</button>${purpose === 'demo' ? '<button class="btn" data-epoch-takeover>接管探索</button>' : ''}<button class="btn event-continue">${purpose === 'classroom' ? '返回课堂预览' : purpose === 'demo' ? '继续观看演示' : '带着发现，继续向前'} ${icon('ArrowRight', 17)}</button></div></footer></div>`;
  document.body.append(dialog); dialog.showModal();
  const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
  const cinematic = new EpochCinematic(dialog.querySelector('.epoch-stage')!, chapter.id, { ...settings, reducedMotion: reduced });
  const audio = new EpochAudio(settings.sound, chapter.id);
  const pause = dialog.querySelector<HTMLButtonElement>('[data-epoch-pause]')!, skip = dialog.querySelector<HTMLButtonElement>('[data-epoch-skip]')!;
  let stage = -1, lastStatus = '', visibilityPaused = false;
  const draw = () => {
    if (closed || reduced || clock.status !== 'playing') { raf = 0; return; }
    clock.tick(performance.now()); cinematic.render(clock.elapsed); raf = requestAnimationFrame(draw);
  };
  const startFrames = () => { if (!raf && !closed && !reduced && clock.status === 'playing') raf = requestAnimationFrame(draw); };
  const stopFrames = () => { cancelAnimationFrame(raf); raf = 0; };
  const update = () => {
    if (closed) return;
    clock.tick(performance.now()); const isSummary = clock.status === 'summary';
    dialog.dataset.status = clock.status; dialog.dataset.reducedMotion = String(reduced);
    const progress = clock.elapsed / clock.duration;
    const nextStage = isSummary ? 2 : Math.min(2, Math.floor(progress * 3));
    if (nextStage !== stage) { stage = nextStage; dialog.querySelector('.epoch-stage-caption')!.textContent = `${String(stage + 1).padStart(2, '0')} / ${definition.stages[stage]}`; }
    const progressNode = dialog.querySelector<HTMLElement>('.epoch-progress')!; progressNode.setAttribute('aria-valuenow', String(Math.round(progress * 100))); progressNode.querySelector('i')!.style.width = `${progress * 100}%`;
    dialog.querySelector('.epoch-time')!.textContent = `${Math.min(clock.duration, clock.elapsed).toFixed(1)} / ${clock.duration} 秒`;
    if (lastStatus !== clock.status) {
      lastStatus = clock.status; dialog.querySelector('.epoch-playback')!.textContent = isSummary ? '高光结束 · 留下片刻，读懂这次转折' : clock.status === 'paused' ? '已暂停 · 可以慢慢阅读' : '纪元高光 · 正在播放';
      pause.innerHTML = `${icon(clock.status === 'paused' ? 'Play' : 'Pause', 16)} ${clock.status === 'paused' ? '继续' : '暂停'}`;
      pause.setAttribute('aria-label', clock.status === 'paused' ? '继续纪元高光' : '暂停纪元高光');
      pause.setAttribute('aria-pressed', String(clock.status === 'paused'));
    }
    pause.disabled = skip.disabled = isSummary;
    audio.update(progress);
    if (isSummary) { stopFrames(); cinematic.render(clock.duration); audio.dispose(); clearInterval(timer); if (purpose === 'demo') close('exit'); }
  };
  const close = (reason: 'exit' | 'dispose' = 'exit') => {
    if (closed) return; closed = true; clock.close(); clearInterval(timer); stopFrames();
    systemMotion.removeEventListener('change', motionChanged); document.removeEventListener('visibilitychange', visibilityChanged);
    cinematic.dispose(); audio.dispose(); dialog.close(); dialog.remove(); document.body.style.overflow = previousOverflow;
    if (priorFocus?.isConnected) priorFocus.focus({ preventScroll: true });
    else document.querySelector<HTMLElement>('#main-content')?.focus({ preventScroll: true });
    options.onClose(reason);
  };
  const motionChanged = () => { reduced = settings.reducedMotion || systemMotion.matches; cinematic.setReducedMotion(reduced); dialog.querySelector<HTMLElement>('.epoch-motion-note')!.hidden = !reduced; if (reduced) stopFrames(); else startFrames(); update(); };
  const visibilityChanged = () => {
    if (document.hidden && clock.status === 'playing') { visibilityPaused = true; clock.pause(performance.now()); stopFrames(); audio.setPaused(true); update(); }
    else if (!document.hidden && visibilityPaused) { visibilityPaused = false; clock.resume(performance.now()); audio.setPaused(false); startFrames(); update(); }
  };
  pause.addEventListener('click', () => {
    visibilityPaused = false;
    if (clock.status === 'playing') { clock.pause(performance.now()); stopFrames(); audio.setPaused(true); cinematic.render(clock.elapsed); }
    else if (clock.status === 'paused') { clock.resume(performance.now()); audio.setPaused(false); startFrames(); }
    update();
  });
  skip.addEventListener('click', () => { clock.finish(); update(); });
  dialog.querySelector('[data-epoch-close]')!.addEventListener('click', () => close());
  dialog.querySelector('.event-continue')!.addEventListener('click', () => close());
  dialog.querySelector('[data-epoch-takeover]')?.addEventListener('click', () => close('dispose'));
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => close());
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')], first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  systemMotion.addEventListener('change', motionChanged); document.addEventListener('visibilitychange', visibilityChanged);
  const timer = setInterval(update, 100); clock.tick(performance.now()); update(); startFrames(); pause.focus({ preventScroll: true });
  return { dialog, close: () => close('dispose'), get stats() { return { ...cinematic.stats, chapter: chapter.id, purpose, theme: definition.theme, elapsed: clock.elapsed, status: clock.status, reducedMotion: reduced }; } };
}
export type EpochEvent = ReturnType<typeof showEpochEvent>;
