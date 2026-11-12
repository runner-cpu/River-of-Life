import { populationSnapshot } from '../core/population-view';
import type { compareEnvironments } from '../core/lab-comparison';

function dots(one: number, id: string) {
  return `<svg class="population-dots" viewBox="0 0 200 200" role="img" aria-label="取值 1：${one} 个；取值 0：${100 - one} 个">
    <defs><pattern id="${id}" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 0L4 4M-1 3L1 5M3 -1L5 1" stroke="#32776d" stroke-width="1"/></pattern></defs>
    ${Array.from({ length: 100 }, (_, index) => `<circle data-value="${index < one ? 1 : 0}" cx="${10 + index % 10 * 20}" cy="${10 + Math.floor(index / 10) * 20}" r="6" fill="${index < one ? `url(#${id})` : '#32776d'}" stroke="#32776d"/>`).join('')}
  </svg>`;
}

export function renderPopulation(result: ReturnType<typeof compareEnvironments>, generation: number) {
  const snapshot = populationSnapshot(result, generation);
  return `<div class="population-groups">
    ${snapshot.groups.map(group => `<section class="population-group" data-population="${group.key}">
      <h4>${group.key === 'control' ? '对照组' : '实验组'}</h4>
      <div class="population-pair">
        <figure data-pool="initial"><figcaption>初始 · 第 0 代</figcaption>${dots(group.initial.one, `${group.key}-initial`)}<p>取值 1：${group.initial.one} / 100</p></figure>
        <figure data-pool="current"><figcaption>当前 · 第 ${generation} 代</figcaption>${dots(group.current.one, `${group.key}-current`)}<p>取值 1：${group.current.one} / 100</p></figure>
      </div>
      <p class="population-summary">第 ${generation} 代，基因 0 的取值 1 频率 ${Math.round(group.frequency * 100)}%。${group.change}</p>
    </section>`).join('')}
  </div>`;
}
