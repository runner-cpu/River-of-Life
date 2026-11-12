import type { GameStore } from '../core/store';
import { EvolutionLab } from '../core/lab';
import { icon, escape } from '../core/ui';
import { mountComparison } from './lab-comparison';

export function mountLab(container: HTMLElement, store: GameStore) {
  let lab = new EvolutionLab(), running = false, drought = .75, predation = .2, timer: ReturnType<typeof setInterval> | undefined;
  container.innerHTML = `<div class="section-heading"><div><span class="eyebrow">THE SMALL CHANGES THAT SHAPE LIFE</span><h1>演化，就发生在每一代之间。</h1><p>图鉴记录生命的结果。这里，让我们观察自然选择如何改变一个种群。</p></div><span class="outline-tag">教学模型 · 确定性回放</span></div><nav class="lab-wayfinding" aria-label="实验室内容导航"><button data-lab-target="lab-observation"><span>01</span>观察种群</button><button data-lab-target="lab-environment"><span>02</span>调整环境</button><button data-lab-target="lab-comparison"><span>03</span>对照实验</button></nav><div class="lab-layout" id="lab-observation" tabindex="-1"><section class="lab-world"><div class="lab-world-head"><span><i class="live-dot"></i> 微观观察室</span><span>世代 <b id="generation">0</b></span></div><p class="lab-run-status" id="lab-run-status" role="status">尚未开始。离开此页会重置本次实验，可先导出对照数据。</p><canvas id="lab-canvas" width="900" height="480" aria-label="种群可视化，条纹个体携带耐旱基因"></canvas><div class="lab-legend"><span><i class="gene-a"></i> 耐旱型（带条纹）</span><span><i class="gene-b"></i> 普通型</span><span id="population-label">种群 100</span></div><div class="lab-chart"><div><span>耐旱等位基因频率</span><strong id="gene-frequency">50%</strong></div><div class="lab-chart-frame"><div class="chart-y-labels" aria-hidden="true"><span>100%</span><span>50%</span><span>0%</span></div><svg id="gene-chart" viewBox="0 0 700 100" preserveAspectRatio="none" role="img" aria-label="耐旱等位基因频率随世代变化"><path d="M0 10h700M0 55h700M0 100h700" stroke="#d8dfd6" fill="none"/><polyline id="gene-line" fill="none" stroke="#b77b43" stroke-width="3" vector-effect="non-scaling-stroke"/></svg><div class="chart-x-labels" aria-hidden="true"><span id="chart-start">第 0 代</span><span id="chart-end">第 0 代</span></div></div></div></section><aside class="lab-controls" id="lab-environment" tabindex="-1" aria-label="环境参数"><span class="eyebrow">YOUR EXPERIMENT</span><h2>改变环境，观察选择。</h2><label class="slider-label" for="drought">干旱强度 <output id="drought-value">75%</output></label><input id="drought" type="range" min="0" max="100" value="75"><p>干旱越强，携带耐旱等位基因的个体获得越高的繁殖权重。</p><label class="slider-label" for="predation">捕食选择 <output id="predation-value">20%</output></label><input id="predation" type="range" min="0" max="100" value="20"><p>影响另一独立基因的繁殖权重；不是实时追逐模拟。</p><div class="lab-buttons"><button class="btn primary" id="lab-play" aria-pressed="false">${icon('Play', 17)} 开始观察</button><button class="btn" id="lab-step">前进一代</button><button class="icon-btn" id="lab-reset" aria-label="重置实验">${icon('RotateCcw', 18)}</button></div><div class="lab-insight"><span>${icon('Lightbulb', 20)}</span><div><h3>演化没有预设的目标</h3><p id="lab-insight">基因不会因为「需要」而出现。环境影响不同遗传变体留下后代的机会。</p></div></div><details class="lab-details"><summary>模型假设与数值审计</summary><p>100 个单倍体个体，14 个二值基因；前两位分别表示耐旱和捕食适应，其余为中性位点。每代按适合度加权抽样，突变率 0.3%，固定随机种子 20261025。种群容量固定，能量是生命周期记账，不代表真实生态能量流。</p><p id="energy-audit"></p></details></aside></div>`;
  const canvas = container.querySelector<HTMLCanvasElement>('#lab-canvas')!, ctx = canvas.getContext('2d')!;
  function paint() {
    ctx.fillStyle = `hsl(${105 - drought * 60} 16% ${93 - drought * 5}%)`; ctx.fillRect(0, 0, 900, 480);
    lab.state.population.forEach(p => { const x = p.x * 850 + 25, y = p.y * 430 + 25; ctx.save(); ctx.translate(x, y); ctx.rotate(p.genes[2] * .7); ctx.fillStyle = p.genes[0] ? '#aa713f' : '#4e8378'; ctx.beginPath(); ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2); ctx.fill(); if (p.genes[0]) { ctx.strokeStyle = '#f2dec1'; ctx.lineWidth = 1.8; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 4, -4); ctx.lineTo(i * 4, 4); ctx.stroke(); } } ctx.fillStyle = '#213b35'; ctx.beginPath(); ctx.arc(-5, -2, 1.6, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
    container.querySelector('#generation')!.textContent = String(lab.state.generation); container.querySelector('#gene-frequency')!.textContent = `${Math.round(lab.frequency() * 100)}%`;
    container.querySelector('#gene-line')!.setAttribute('points', lab.state.history.slice(-100).map((value, i, arr) => `${i / Math.max(arr.length - 1, 1) * 700},${100 - value * 90}`).join(' '));
    const firstGeneration=Math.max(0,lab.state.generation-99);
    container.querySelector('#chart-start')!.textContent=`第 ${firstGeneration} 代`;
    container.querySelector('#chart-end')!.textContent=`第 ${lab.state.generation} 代`;
    container.querySelector('#gene-chart')!.setAttribute('aria-label',`第 ${firstGeneration} 至 ${lab.state.generation} 代耐旱等位基因频率，当前 ${Math.round(lab.frequency()*100)}%`);
    if(lab.state.generation===0)container.querySelector('#lab-insight')!.textContent='基因不会因为「需要」而出现。环境影响不同遗传变体留下后代的机会。';
    container.querySelector('#energy-audit')!.textContent = `累计输入 ${lab.state.energyIn} · 输出 ${lab.state.energyOut} · 在体 ${lab.state.population.length * 10} · 守恒残差 ${lab.audit()}`;
    if (lab.state.generation >= 12 && lab.frequency() > .8 && drought > .6) { store.badge('自然选择观察者'); container.querySelector('#lab-insight')!.textContent = '你观察到了耐旱变体的频率上升！已获得「自然选择观察者」徽章。将干旱调到 0，再比较几代的变化。'; }
  }
  const stop = () => { running = false; clearInterval(timer); container.querySelector('#lab-play')!.setAttribute('aria-pressed','false'); container.querySelector('#lab-play')!.innerHTML = `${icon('Play', 17)} 开始观察`; };
  const step = () => { if (lab.state.generation >= 300) { stop();container.querySelector('#lab-run-status')!.textContent='已到达 300 代上限。可重置后更换条件再观察。'; return; } lab.step(drought, predation); paint(); };
  container.querySelector('#lab-play')!.addEventListener('click', () => { if (running) {stop();container.querySelector('#lab-run-status')!.textContent='观察已暂停，可继续或前进一代。';} else {container.querySelector('#lab-run-status')!.textContent='观察进行中，每次推进一代。'; running = true; container.querySelector('#lab-play')!.setAttribute('aria-pressed','true'); container.querySelector('#lab-play')!.innerHTML = `${icon('Pause', 17)} 暂停观察`; timer = setInterval(step, 420); } });
  container.querySelector('#lab-step')!.addEventListener('click', step); container.querySelector('#lab-reset')!.addEventListener('click', () => { stop(); lab = new EvolutionLab(); paint();container.querySelector('#lab-run-status')!.textContent='已回到第 0 代，环境参数保持不变。'; });
  container.querySelector<HTMLInputElement>('#drought')!.addEventListener('input', e => { drought = Number((e.target as HTMLInputElement).value) / 100; container.querySelector('#drought-value')!.textContent = `${Math.round(drought * 100)}%`; paint(); });
  container.querySelector<HTMLInputElement>('#predation')!.addEventListener('input', e => { predation = Number((e.target as HTMLInputElement).value) / 100; container.querySelector('#predation-value')!.textContent = `${Math.round(predation * 100)}%`; });
  const comparison=document.createElement('section');comparison.className='lab-comparison';comparison.id='lab-comparison';comparison.tabIndex=-1;comparison.setAttribute('aria-label','同起点对照实验');container.append(comparison);
  const refreshComparison = mountComparison(comparison,()=>({drought,predation}), id => { if (store.inquiryBadge(id)) container.querySelector('#lab-insight')!.textContent = '你记录了一次换种子重跑与备注。行为记录不评估科学能力，也不增加演化点。'; });
  container.addEventListener('input',event => {
    if (event.target instanceof HTMLInputElement && ['drought','predation'].includes(event.target.id)) refreshComparison();
  });
  container.querySelectorAll<HTMLButtonElement>('[data-lab-target]').forEach(button => button.addEventListener('click',() => {
    const target=container.querySelector<HTMLElement>(`#${button.dataset.labTarget}`)!;
    target.focus({preventScroll:true});
    target.scrollIntoView({block:'start',behavior:store.state.settings.reducedMotion?'instant':'smooth'});
  }));
  const suspend = () => {if(running && (document.hidden || document.querySelector('dialog[open]'))){stop();container.querySelector('#lab-run-status')!.textContent='切换窗口或打开弹窗时已暂停。返回后可手动继续，世代不会悄悄推进。';}};
  document.addEventListener('visibilitychange',suspend);
  const dialogs=new MutationObserver(suspend);dialogs.observe(document.body,{childList:true});
  paint(); return () => { clearInterval(timer);dialogs.disconnect();document.removeEventListener('visibilitychange',suspend); };
}
