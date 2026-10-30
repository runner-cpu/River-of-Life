import { createElement } from 'lucide';
import { museumIcons as icons } from './icons';

export function icon(name: string, size = 20) {
  const node = icons[name as keyof typeof icons] || icons.Circle;
  return createElement([node[0], { ...node[1], width: size, height: size, 'stroke-width': 1.65, 'aria-hidden': 'true' }, node[2]]).outerHTML;
}
export function escape(value: unknown): string { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)); }
export function $(selector: string, root: ParentNode = document) { return root.querySelector<HTMLElement>(selector)!; }
export function toast(message: string) {
  const region = document.getElementById('toasts'); if (!region) return;
  const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = `${icon('Sparkles', 17)}<span>${escape(message)}</span>`;
  region.append(el); setTimeout(() => el.remove(), 4500);
}
let modalSequence = 0;
export function modal(title: string, body: string, wide = false) {
  const priorFocus = document.activeElement as HTMLElement | null;
  const dialog = document.createElement('dialog'); dialog.className = `modal ${wide ? 'wide' : ''}`;
  const titleId = `modal-title-${++modalSequence}`; dialog.setAttribute('aria-labelledby', titleId);
  dialog.innerHTML = `<div class="modal-head"><div><span class="eyebrow">RIVER OF LIFE</span><h2 id="${titleId}">${escape(title)}</h2></div><button class="icon-btn close-modal" aria-label="关闭弹窗">${icon('X')}</button></div><div class="modal-body">${body}</div>`;
  document.body.append(dialog); dialog.showModal();
  const close = () => { if (!dialog.isConnected) return; dialog.close(); dialog.remove(); if (priorFocus?.isConnected) priorFocus.focus({preventScroll:true}); };
  dialog.querySelector('.close-modal')!.addEventListener('click', close);
  dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close(); } });
  dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
  return { dialog, close };
}
export function download(name: string, content: string | Blob, mime = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
let audio: AudioContext | undefined, drone: OscillatorNode | undefined, gain: GainNode | undefined;
export function ambient(enabled: boolean) {
  if (!enabled) { if (gain && audio) gain.gain.setTargetAtTime(0, audio.currentTime, .5); return; }
  try { audio ??= new AudioContext(); void audio.resume(); if (!drone) { drone = audio.createOscillator(); gain = audio.createGain(); drone.type = 'sine'; drone.frequency.value = 110; gain.gain.value = 0; drone.connect(gain); gain.connect(audio.destination); drone.start(); } gain!.gain.setTargetAtTime(.025, audio.currentTime, 1); } catch { toast('当前浏览器暂不支持环境音。'); }
}
export function speak(text: string) {
  if (!('speechSynthesis' in window)) { toast('当前浏览器不支持语音朗读。'); return; }
  speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'zh-CN'; utterance.rate = .9;
  const voice = speechSynthesis.getVoices().find(v => v.lang.startsWith('zh')); if (voice) utterance.voice = voice;
  utterance.onerror = () => toast('语音暂时不可用，你可以继续阅读知识卡。'); speechSynthesis.speak(utterance);
}
