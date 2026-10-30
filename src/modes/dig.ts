import type { Chapter, Species } from '../core/types';
import type { GameStore } from '../core/store';
import { icon, escape, toast } from '../core/ui';
import { specimenArt } from '../scene/creatures';
import { seeded } from '../core/lab';

export function mountDig(container: HTMLElement, chapter: Chapter, specimen: Species, store: GameStore, onSpecimen: () => void) {
  const complete = store.state.excavated.includes(chapter.id);
  container.innerHTML = `<div class="section-heading"><div><span class="eyebrow">BENEATH THE SURFACE</span><h1>让沉睡的生命，重见天日。</h1><p>每一道纹理，都是时间留下的线索。轻轻拂去岩层，发现属于这个纪元的化石。</p></div><span class="outline-tag">${escape(chapter.name)} · 01 号挖掘点</span></div>
    <div class="dig-layout"><section class="dig-site"><div class="dig-topline"><span>${icon('MapPin', 16)} 古生物模拟发掘场</span><span>地层样本 / ${String(chapter.id).padStart(2, '0')}</span></div><div class="scratch-box"><div class="buried-fossil">${specimenArt(specimen)}<span>${escape(specimen.name)} · 结构示意</span></div><canvas id="scratch-canvas" aria-label="化石岩层，拖动擦除，或使用下方无障碍清理按钮"></canvas></div><div class="dig-bottom"><span>${icon('MousePointer2', 17)} 按住拖动或用手指清理岩层</span><button class="btn small" id="dig-accessible">${icon('Brush', 15)} 清理一片岩层</button></div></section>
    <aside class="dig-notes"><span class="eyebrow">FIELD NOTES / 田野笔记</span><h2>发现之前，先学会观察。</h2><ol><li><span>01</span><div><strong>轻轻清理表面</strong><p>像古生物学家一样，耐心揭露标本的边缘。</p></div></li><li><span>02</span><div><strong>寻找身体的线索</strong><p>留意对称、分节和附肢，这些形态帮助我们认识生命。</p></div></li><li><span>03</span><div><strong>阅读它的故事</strong><p>挖掘完成后查看知识卡，理解化石与复原之间的区别。</p></div></li></ol><div class="dig-progress"><div><span>岩层清理程度</span><strong id="dig-percent">${complete ? 100 : 0}%</strong></div><div class="progress-track"><i id="dig-bar" style="width:${complete ? 100 : 0}%"></i></div></div><p class="reward-note">${icon('Sparkles', 17)} 首次完成 +20 演化点与一件藏品</p><div id="dig-result"></div><small class="muted">这是模拟发掘练习。插图不代表真实化石标本，地层也不对应实际采集地点。</small></aside></div>`;
  const canvas = container.querySelector<HTMLCanvasElement>('#scratch-canvas')!, context = canvas.getContext('2d', { willReadFrequently: true })!;
  canvas.width = 800; canvas.height = 500;
  const random = seeded(chapter.id * 93); context.fillStyle = '#8c7c64'; context.fillRect(0, 0, 800, 500);
  for (let i = 0; i < 12000; i++) { const alpha = random() * .22; context.fillStyle = `rgba(${random() > .5 ? '38,31,21' : '244,228,197'},${alpha})`; const radius = random() * 3 + .5; context.beginPath(); context.arc(random() * 800, random() * 500, radius, 0, Math.PI * 2); context.fill(); }
  for (let j = 0; j < 7; j++) { context.beginPath(); context.moveTo(0, j * 80); for (let x = 0; x < 820; x += 20) context.lineTo(x, j * 80 + Math.sin(x / 60 + j) * 12); context.strokeStyle = '#5c503a44'; context.lineWidth = 2; context.stroke(); }
  context.fillStyle = '#e5dac3'; context.font = '16px sans-serif'; context.textAlign = 'center'; context.fillText('时间把秘密藏在这里', 400, 245); context.font = '12px sans-serif'; context.fillText('轻拂岩层，发现生命', 400, 274);
  context.globalCompositeOperation = 'destination-out';
  let finished = complete, drawing = false, last: { x: number; y: number } | undefined, strokes = 0, accessibleSteps = 0;
  const result = () => { container.querySelector('#dig-result')!.innerHTML = `<div class="discovery-result">${icon('PartyPopper', 24)}<h3>发现：${escape(specimen.name)}</h3><p>它的身体，还藏着怎样的故事？</p><button class="btn primary" id="open-dig-species">翻开生命档案 ${icon('ArrowRight', 17)}</button></div>`; container.querySelector('#open-dig-species')!.addEventListener('click', onSpecimen); (container.querySelector('#dig-accessible') as HTMLButtonElement).disabled = true; };
  const check = () => {
    if (finished) return;
    const data = context.getImageData(0, 0, 800, 500).data; let cleared = 0, total = 0;
    for (let i = 3; i < data.length; i += 4 * 16) { total++; if (data[i] < 100) cleared++; }
    const percent = Math.min(100, Math.round(cleared / total / .62 * 100));
    container.querySelector('#dig-percent')!.textContent = `${percent}%`; (container.querySelector('#dig-bar') as HTMLElement).style.width = `${percent}%`;
    if (percent >= 100) { finished = true; context.clearRect(0, 0, 800, 500); const earned = store.excavate(chapter.id); if (earned) toast(`化石出土 · +${earned} 演化点`); result(); }
  };
  const point = (e: PointerEvent) => { const rect = canvas.getBoundingClientRect(); return { x: (e.clientX - rect.left) * 800 / rect.width, y: (e.clientY - rect.top) * 500 / rect.height }; };
  const erase = (p: { x: number; y: number }) => { context.beginPath(); if (last) { context.moveTo(last.x, last.y); context.lineTo(p.x, p.y); context.lineWidth = 65; context.lineCap = 'round'; context.stroke(); } else { context.arc(p.x, p.y, 33, 0, Math.PI * 2); context.fill(); } last = p; if (++strokes % 8 === 0) check(); };
  canvas.addEventListener('pointerdown', e => { if (finished) return; drawing = true; canvas.setPointerCapture(e.pointerId); last = undefined; erase(point(e)); });
  canvas.addEventListener('pointermove', e => { if (drawing) erase(point(e)); });
  canvas.addEventListener('pointerup', () => { drawing = false; last = undefined; check(); }); canvas.addEventListener('pointercancel', () => { drawing = false; last = undefined; check(); });
  container.querySelector('#dig-accessible')!.addEventListener('click', () => { if (finished) return; const x = (accessibleSteps % 4) * 200, y = Math.floor(accessibleSteps / 4) * 167; context.clearRect(x, y, 200, 167); accessibleSteps++; check(); });
  if (complete) { context.clearRect(0, 0, 800, 500); result(); }
  return () => {};
}
