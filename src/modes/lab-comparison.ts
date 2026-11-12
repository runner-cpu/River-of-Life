import { renderPopulation } from './population-view';
import { compareEnvironments, comparisonCSV } from '../core/lab-comparison';
import { download, escape, icon } from '../core/ui';

export function mountComparison(container: HTMLElement, environment: () => { drought: number; predation: number }) {
  let lastConditions: { drought: number; predation: number; seed: number; prediction: string } | undefined;
  container.innerHTML = `<div class="comparison-heading"><div><span class="eyebrow">让解释经得起一次对照</span><h2>同一个起点，两个环境。</h2><p>保留相同初始种群，只改变干旱强度。先预测，再运行 30 代，比较两条曲线。</p></div><span class="outline-tag">对照探究 · 独立于上方实验</span></div><div class="comparison-setup"><label for="comparison-prediction">你的预测<select id="comparison-prediction"><option value="">先选一个预测</option><option value="higher">实验组耐旱频率更高</option><option value="same">两组频率相同</option><option value="lower">实验组耐旱频率更低</option><option value="unsure">不确定，先记录结果</option></select></label><label for="comparison-seed">随机种子<input id="comparison-seed" type="number" min="0" max="4294967295" step="1" value="20261025"></label><button class="btn primary" id="run-comparison">${icon('FlaskConical',17)} 运行对照实验</button></div><p class="comparison-current" id="comparison-current"></p><p class="comparison-conditions">对照组：干旱 0%；实验组：运行时取上方干旱值。两组捕食选择相同、种群各 100、突变率 0.3%，起点与随机种子相同。0% 干旱仍含模型设定的耐旱性状成本，不能称为“无选择”。</p><div id="comparison-feedback" role="status"></div><p class="comparison-pending" id="comparison-pending" role="status" hidden>参数或预测已调整。下方仍是上一次运行的结果与记录，请重新运行。</p><div id="comparison-result"></div>`;
  const refreshConditions = () => {
    const current=environment();
    container.querySelector('#comparison-current')!.innerHTML = `当前环境：实验组干旱 <strong>${Math.round(current.drought*100)}%</strong> · 两组捕食选择 <strong>${Math.round(current.predation*100)}%</strong>`;
    container.querySelector<HTMLElement>('#comparison-pending')!.hidden = !lastConditions || (lastConditions.drought===current.drought && lastConditions.predation===current.predation && container.querySelector<HTMLInputElement>('#comparison-seed')!.value.trim()!=='' && lastConditions.seed===Number(container.querySelector<HTMLInputElement>('#comparison-seed')!.value) && lastConditions.prediction===container.querySelector<HTMLSelectElement>('#comparison-prediction')!.value);
  };
  refreshConditions();
  container.querySelector('#comparison-seed')!.addEventListener('input', refreshConditions);
  container.querySelector('#comparison-prediction')!.addEventListener('change', refreshConditions);
  container.querySelector('#run-comparison')!.addEventListener('click', () => {
    const seedInput = container.querySelector<HTMLInputElement>('#comparison-seed')!;
    const prediction = container.querySelector<HTMLSelectElement>('#comparison-prediction')!;
    if (!prediction.value) { container.querySelector('#comparison-feedback')!.textContent = '先记录一个预测，再开始比较。'; prediction.focus(); return; }
    if (!seedInput.value.trim() || !seedInput.checkValidity()) { seedInput.reportValidity(); return; }
    const result = compareEnvironments({ seed: Number(seedInput.value), generations: 30, ...environment() });
    lastConditions = {drought:result.settings.drought,predation:result.settings.predation,seed:result.settings.seed,prediction:prediction.value}; refreshConditions();
    const first = result.rows[0], last = result.rows.at(-1)!;
    const difference = Math.round((last.treatment - last.control) * 100);
    const relation = difference > 0 ? 'higher' : difference < 0 ? 'lower' : 'same';
    const selectedText = prediction.selectedOptions[0].text;
    container.querySelector('#comparison-feedback')!.textContent = '对照实验已完成。以下参数和曲线固定为本次运行的记录。';
    const points = (key: 'control' | 'treatment') => result.rows.map((row,index) => `${index/30*700},${100-row[key]*90}`).join(' ');
    container.querySelector('#comparison-result')!.innerHTML = `<div class="comparison-result-heading"><div><h3>第 30 代，两组相差 ${Math.abs(difference)} 个百分点。</h3><p>两组初始频率均为 ${Math.round(first.control*100)}%。${difference === 0 ? '本次终点相同，仍应比较中间过程。' : `本次${difference > 0 ? '实验组' : '对照组'}更高。`} ${prediction.value === 'unsure' ? '现在可以用结果修订你的想法。' : prediction.value === relation ? '本次结果与你的预测一致。' : '本次结果与你的预测不同，请结合条件解释。'}</p></div><button class="btn small" id="export-comparison">${icon('FileDown',16)} 导出本次数据</button></div><div class="comparison-legend"><span><i></i>对照组 · 干旱 0% · ${Math.round(last.control*100)}%</span><span><i></i>实验组 · 干旱 ${Math.round(result.settings.drought*100)}% · ${Math.round(last.treatment*100)}%</span></div><p class="comparison-axis-title">耐旱等位基因频率 / %</p><div class="comparison-chart"><div aria-hidden="true" class="chart-y-labels"><span>100%</span><span>50%</span><span>0%</span></div><svg viewBox="0 0 700 100" preserveAspectRatio="none" role="img" aria-label="30 代频率对照；实线对照组终点 ${Math.round(last.control*100)}%，虚线实验组终点 ${Math.round(last.treatment*100)}%"><path d="M0 10h700M0 55h700M0 100h700" stroke="#d6decf" fill="none"/><polyline points="${points('control')}" stroke="#32776d" stroke-width="2.5" vector-effect="non-scaling-stroke" fill="none"/><polyline points="${points('treatment')}" stroke="#9b602c" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-dasharray="7 4" fill="none"/></svg><div class="chart-x-labels" aria-hidden="true"><span>第 0 代</span><span>第 30 代</span></div></div><dl class="comparison-record"><div><dt>本次预测</dt><dd>${escape(selectedText)}</dd></div><div><dt>随机种子</dt><dd>${result.settings.seed}</dd></div><div><dt>共同捕食选择</dt><dd>${Math.round(result.settings.predation*100)}%</dd></div><div><dt>模型能量残差</dt><dd>对照 ${result.energyResiduals.control} · 实验 ${result.energyResiduals.treatment}</dd></div></dl><p class="comparison-conditions">两组使用相同初始条件与随机序列，单次差异只描述这一次模型运行。改变种子可查看重复结果；不能把一次曲线当作真实物种演化规律或教学效果证据。上方调参后需再次运行才会更新此记录。</p><details class="comparison-table"><summary>查看每代数值（亦可导出 CSV）</summary><table><caption>耐旱等位基因频率，单位 %</caption><thead><tr><th scope="col">世代</th><th scope="col">对照组</th><th scope="col">实验组</th></tr></thead><tbody>${result.rows.map(row => `<tr><th scope="row">${row.generation}</th><td>${Math.round(row.control*100)}</td><td>${Math.round(row.treatment*100)}</td></tr>`).join('')}</tbody></table></details>`;
    const resultContainer = container.querySelector<HTMLElement>('#comparison-result')!;
    resultContainer.insertAdjacentHTML('afterbegin', `
      <section class="population-view" aria-labelledby="population-title">
        <h3 id="population-title">基因 0 · 个体池数量示意</h3>
        <p>基因 0 是基因的位置编号；取值 1 表示本模型的耐旱等位基因，斜纹点表示取值 1，实心点表示取值 0。</p>
        <p>每池固定 100 点，取值 1 点数 = 四舍五入（频率 × 100），其余为取值 0。这是汇总频率的教学示意，固定点位不代表跨代追踪同一个体。</p>
        <div class="population-navigation">
          <button class="btn small" id="population-previous" type="button">上一代</button>
          <label for="population-generation">当前世代 <output id="population-generation-label">30</output>
            <input id="population-generation" type="range" min="0" max="30" step="1" value="30">
          </label>
          <button class="btn small" id="population-next" type="button">下一代</button>
        </div>
        <div id="population-content" aria-live="polite"></div>
      </section>`);
    const generationInput = container.querySelector<HTMLInputElement>('#population-generation')!;
    const chart = container.querySelector('.comparison-chart svg')!;
    chart.insertAdjacentHTML('beforeend', `<g id="population-chart-marker" aria-hidden="true">
      <line x1="0" x2="0" y1="0" y2="100" stroke="#263e36" stroke-dasharray="2 3"/>
      <circle data-marker="control" r="3" fill="#32776d"/>
      <circle data-marker="treatment" r="3" fill="#9b602c"/>
    </g>`);
    const updateGeneration = () => {
      const generation = Number(generationInput.value);
      const row = result.rows[generation];
      container.querySelector('#population-generation-label')!.textContent = String(generation);
      container.querySelector('#population-content')!.innerHTML = renderPopulation(result, generation);
      container.querySelector<HTMLButtonElement>('#population-previous')!.disabled = generation === 0;
      container.querySelector<HTMLButtonElement>('#population-next')!.disabled = generation === 30;
      const marker = container.querySelector('#population-chart-marker')!;
      marker.setAttribute('data-generation', String(generation));
      marker.setAttribute('transform', `translate(${generation / 30 * 700},0)`);
      for (const key of ['control', 'treatment'] as const) {
        marker.querySelector(`[data-marker="${key}"]`)!.setAttribute('cy', String(100 - row[key] * 90));
      }
      container.querySelectorAll('.comparison-table tbody tr').forEach((element, index) => {
        if (index === generation) element.setAttribute('aria-current', 'true');
        else element.removeAttribute('aria-current');
      });
    };
    generationInput.addEventListener('input', updateGeneration);
    for (const [id, delta] of [['previous', -1], ['next', 1]] as const) {
      container.querySelector(`#population-${id}`)!.addEventListener('click', () => {
        generationInput.value = String(Number(generationInput.value) + delta);
        updateGeneration();
      });
    }
    updateGeneration();
    container.querySelector('#export-comparison')!.addEventListener('click', () => download(`生命长河-对照实验-${result.settings.seed}.csv`, '\ufeff'+comparisonCSV(result),'text/csv;charset=utf-8'));
  });
  return refreshConditions;
}
