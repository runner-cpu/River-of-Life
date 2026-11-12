import './relationships.css';
import { relationships } from '../content/relationships';
import { timePosition, timeRange, timeReferences, toggleEpoch } from '../core/relationships';
import type { Species } from '../core/types';
import { escape } from '../core/ui';

export function mountRelationships(root: HTMLElement, open: (s: Species) => void) {
  let view = matchMedia('(max-width: 600px)').matches ? 'list' : 'graph';
  let expanded = new Set<number>();
  let selected: Species | undefined;
  const range = timeRange(relationships.flatMap(g => [g.chapter, ...g.species]));
  const x = (age: number) => 170 + timePosition(age, range) * 790;
  function draw(focus?: string) {
    root.innerHTML = `<section class="relationships"><span class="eyebrow">EPOCHS & ARCHIVES</span><h1>纪元与生命档案</h1><p>8 个纪元 · 48 个档案。本视图按纪元与年代组织，不代表完整系统发生关系；同组生物不表示同地同时共存。</p><div class="relationship-switch" role="group" aria-label="显示方式"><button class="btn" data-view="graph" aria-pressed="${view === 'graph'}">时间图形</button><button class="btn" data-view="list" aria-pressed="${view === 'list'}">分组列表</button></div><p>当前显示：${range.startMya}—${range.endMya} MYA（百万年前）</p><p class="muted">压缩时间轴：log(1 + MYA)，视觉距离不等于相同年数。纪元与档案线段分别显示各自年代，跨章年代保留原范围。</p><div class="relationship-references">${timeReferences(relationships.map(g => g.chapter)).map(t => `<p>${t}</p>`).join('')}</div><div class="relationship-content">${view === 'list' ? list() : graph()}</div><aside class="relationship-detail" aria-live="polite">${selected ? `<span class="eyebrow">所选档案</span><h2>${escape(selected.name)}</h2><p><i>${escape(selected.latin)}</i> · ${selected.startMya}—${selected.endMya} MYA</p><p>${escape(selected.definition)}</p><button class="btn primary" id="relationship-open">打开展台</button><p class="muted">只读展台，不记录观察、阅读、收藏或尺寸比较。</p>` : '<p>展开纪元，再选择一个档案查看详情。</p>'}</aside></section>`;
    root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b => b.onclick = () => { view = b.dataset.view!; draw(`[data-view="${view}"]`); });
    root.querySelectorAll<HTMLElement>('[data-epoch]').forEach(b => {
      const activate = () => { expanded = toggleEpoch(expanded, Number(b.dataset.epoch)); if (selected?.chapter === Number(b.dataset.epoch) && !expanded.has(selected.chapter)) selected = undefined; draw(`[data-epoch="${b.dataset.epoch}"]`); };
      b.onclick = activate; b.onkeydown = e => { if (b.tagName.toLowerCase() === 'g' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); activate(); } };
    });
    root.querySelectorAll<HTMLElement>('[data-archive]').forEach(b => {
      const activate = () => { selected = relationships.flatMap(g => g.species).find(s => s.id === b.dataset.archive); draw(`[data-archive="${b.dataset.archive}"]`); };
      b.onclick = activate; b.onkeydown = e => { if (b.tagName.toLowerCase() === 'g' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); activate(); } };
    });
    root.querySelector<HTMLButtonElement>('#relationship-open')?.addEventListener('click', () => {
      // The modal captures this source node, restoring focus to the selected archive.
      root.querySelector<HTMLElement>(`[data-archive="${selected!.id}"]`)?.focus(); open(selected!);
    });
    if (focus) root.querySelector<HTMLElement>(focus)?.focus({preventScroll:true});
  }
  function list() {
    return relationships.map(g => `<section class="relationship-group ${selected?.chapter === g.chapter.id ? 'selected' : ''}"><h2><button class="btn" data-epoch="${g.chapter.id}" aria-expanded="${expanded.has(g.chapter.id)}">${escape(g.chapter.name)} · ${g.chapter.startMya}—${g.chapter.endMya} MYA ${expanded.has(g.chapter.id) ? '−' : '+'}</button></h2>${expanded.has(g.chapter.id) ? `<ul>${g.species.map(s => `<li><button class="relationship-archive ${selected?.id === s.id ? 'selected' : ''}" data-archive="${s.id}" aria-pressed="${selected?.id === s.id}"><strong>${escape(s.name)}</strong><i>${escape(s.latin)}</i><span>${s.startMya}—${s.endMya} MYA</span></button></li>`).join('')}</ul>` : ''}</section>`).join('');
  }
  function graph() {
    let y = 30;
    const rows = relationships.map(g => {
      const cy = y; y += 48;
      const children = expanded.has(g.chapter.id) ? g.species.map(s => { const sy = y; y += 38; return `<path d="M 20 ${cy} V ${sy} H 160" class="relationship-link"/><g tabindex="0" role="button" aria-label="${escape(s.name)}，${s.startMya}—${s.endMya} MYA" aria-pressed="${selected?.id === s.id}" data-archive="${s.id}" class="relationship-node ${selected?.id === s.id ? 'selected' : ''}"><text x="32" y="${sy + 5}">${escape(s.name)}</text><line x1="${x(s.startMya)}" x2="${x(s.endMya)}" y1="${sy}" y2="${sy}"/><circle cx="${x(s.startMya)}" cy="${sy}" r="6"/></g>`; }).join('') : '';
      return `<g tabindex="0" role="button" aria-label="${escape(g.chapter.name)}" aria-expanded="${expanded.has(g.chapter.id)}" data-epoch="${g.chapter.id}" class="relationship-node epoch ${selected?.chapter === g.chapter.id ? 'selected' : ''}"><text x="10" y="${cy + 5}">${expanded.has(g.chapter.id) ? '−' : '+'} ${escape(g.chapter.name)}</text><line x1="${x(g.chapter.startMya)}" x2="${x(g.chapter.endMya)}" y1="${cy}" y2="${cy}"/><circle cx="${x((g.chapter.startMya + g.chapter.endMya) / 2)}" cy="${cy}" r="8"/></g>${children}`;
    }).join('');
    const ticks = [range.startMya, 1000, 500, 100, 10, 1, 0].filter(a => a <= range.startMya && a >= range.endMya);
    return `<div class="relationship-chart"><svg viewBox="0 0 1020 ${y + 65}" role="group" aria-label="可展开纪元时间图形">${rows}<line x1="170" x2="960" y1="${y}" y2="${y}" stroke="currentColor"/>${ticks.map(a => `<g><line x1="${x(a)}" x2="${x(a)}" y1="${y}" y2="${y + 8}" stroke="currentColor"/><text x="${x(a)}" y="${y + 27}" text-anchor="middle">${a}</text></g>`).join('')}<text x="565" y="${y + 53}" text-anchor="middle">MYA · 百万年前（压缩比例）</text></svg></div>`;
  }
  draw();
}
