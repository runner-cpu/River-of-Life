import type { Species } from '../core/types';
import type { GameStore } from '../core/store';
import { escape, icon, modal, toast, speak } from '../core/ui';
import { getModels, SpecimenStage } from '../scene/life-scene';
import { guideMarkup, mountGuide } from './guide';
type Viewer = HTMLElement & { autoRotate: boolean };
// A failed model-viewer load is cached for its src. Change only the fragment on
// a later attempt, preserving the network URL and the offline cache entry.
const modelLoadVersions = new Map<string, number>();

export function showSpecimen(s: Species, store: GameStore, onLab: () => void) {
  const accessible = store.state.unlockedChapters.includes(s.chapter);
  const gained = accessible ? store.observe(s.id) : 0;
  if (gained) toast(`发现${s.name} · +${gained} 演化点`);
  const { dialog, close } = modal(s.name, `
    <div class="specimen-layout">
      <div class="specimen-left"><div class="model-stage" id="model-stage"><span class="stage-loading">${icon('LoaderCircle')} 正在准备展台</span></div>
      <div class="stage-caption"><span id="representation">结构示意模型</span><span>拖动旋转 · 双指缩放</span></div>
      <div class="model-actions"><button class="btn small" id="rotate-model" aria-pressed="false">${icon('Rotate3d', 17)} 自动旋转</button><button class="btn small" id="compare-model">${icon('Ruler', 17)} 代表尺寸对比</button><button class="btn small" id="speak-species">${icon('Volume2', 17)} 听讲解</button></div>
      <div id="model-load-notice" role="status" hidden></div><div id="size-comparison" hidden></div>
      <div class="provenance" id="model-credit">模型用于解释身体结构；颜色、姿态与运动为艺术示意，不是化石扫描。</div></div>
      <div class="specimen-copy"><span class="eyebrow">${escape(s.latin)}</span><div class="specimen-meta"><span>${escape(s.period)}</span><span>${s.rarity === 'star' ? '明星物种' : s.rarity === 'rare' ? '珍稀发现' : '生命档案'}</span></div>
      <p class="definition">${escape(s.definition)}</p>
      <dl class="facts"><div><dt>生活年代</dt><dd>约 ${s.startMya}–${s.endMya} 百万年前</dd></div><div><dt>体型</dt><dd>${escape(s.sizeLabel)}</dd></div><div><dt>食性 / 营养</dt><dd>${escape(s.diet)}</dd></div><div><dt>栖息地</dt><dd>${escape(s.habitat)}</dd></div></dl>
      <div class="fact-block"><h3>${icon('Sparkles', 16)} 一个有趣的发现</h3><p>${escape(s.fact)}</p></div>
      <div class="fact-block misconception"><h3>${icon('Focus', 16)} 换一个角度认识它</h3><p>${escape(s.misconception)}</p></div>
      <p class="extinction"><strong>它的后来</strong> ${escape(s.extinction)}</p>
      <div class="learning-actions"><button class="btn primary" id="mark-read" ${!accessible ? 'disabled' : ''}>${icon('Check', 17)} ${store.state.read.includes(s.id) ? '已阅读' : '我已阅读 · +3 演化点'}</button><button class="btn" id="collect-species" ${!accessible ? 'disabled' : ''}>${icon('BookmarkPlus', 17)} ${store.state.collected.includes(s.id) ? '已加入图鉴' : !store.state.collected.length ? '免费收藏' : `收藏 · ${s.cost} 演化点`}</button></div>
      ${!accessible ? '<p class="muted">这张卡片可以提前阅读；开启所属纪元后可记录学习进度。</p>' : ''}
      <details class="sources"><summary>${icon('BookMarked', 16)} 查阅知识来源 · ${s.sources.length} 条</summary>${s.sources.map(source => `<a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer"><span class="source-level">${source.level}</span>${escape(source.title)} ${icon('ArrowUpRight', 13)}</a><small>核对于 ${escape(source.checked)} · ${source.level === 'A' ? '学术文献' : source.level === 'B' ? '科研/博物馆机构' : '百科参考，内容仍需人工复核'}${source.scope ? `<br>核对范围：${escape(source.scope)}` : ''}</small>`).join('')}</details>
      <div id="darwin-guide">${guideMarkup(s)}</div>
      <button class="text-btn lab-link" id="specimen-lab">在实验室理解自然选择 ${icon('ArrowRight', 16)}</button></div>
    </div>`, true);
  let stage: SpecimenStage | undefined;
  let model: Viewer | undefined;
  let disposed = false, rotating = false, loadSequence = 0;
  let loadTimer: ReturnType<typeof setTimeout> | undefined;
  const container=dialog.querySelector<HTMLElement>('#model-stage')!;
  const representation=dialog.querySelector<HTMLElement>('#representation')!;
  const credit=dialog.querySelector<HTMLElement>('#model-credit')!;
  const notice=dialog.querySelector<HTMLElement>('#model-load-notice')!;
  const diagramCredit='当前展示原创结构示意；颜色、姿态与运动为艺术呈现，不是馆藏扫描或外部复原模型。';
  const disposeGuide = mountGuide(dialog.querySelector<HTMLElement>('#darwin-guide')!, s);
  const observer = new MutationObserver(() => {
    if (!dialog.isConnected) {
      disposed = true;loadSequence++;clearTimeout(loadTimer);disposeGuide();stage?.dispose();observer.disconnect();
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    }
  });
  observer.observe(document.body, { childList: true });
  function diagram(reason?: string) {
    clearTimeout(loadTimer);stage?.dispose();stage=undefined;model=undefined;container.innerHTML='';
    container.dataset.state=reason?'fallback':'diagram';representation.textContent='原创结构示意';credit.textContent=diagramCredit;
    try {stage=new SpecimenStage(container,s,store.state.settings.reducedMotion);stage.rotate(rotating);}
    catch {container.textContent='当前设备无法显示 3D，你仍可阅读完整档案。';container.dataset.state='unavailable';}
    notice.hidden=!reason;notice.className='model-load-notice';
    notice.innerHTML=reason?`<p>${escape(reason)} 当前已切换为结构示意，知识卡可以继续阅读。</p><button class="btn small" id="retry-model">重新加载原模型</button>`:'';
    notice.querySelector('#retry-model')?.addEventListener('click',()=>void loadModel());
  }
  async function loadModel() {
    const sequence=++loadSequence;
    clearTimeout(loadTimer);stage?.dispose();stage=undefined;model=undefined;notice.hidden=true;
    container.dataset.state='loading';container.innerHTML=`<span class="model-load-status" role="status">${icon('LoaderCircle')} 正在加载三维展台</span>`;
    representation.textContent='准备模型';credit.textContent='加载完成后将显示对应模型的来源与许可。';
    let finished=false, assetKey:string|undefined;
    const failed=(reason:string)=>{if(disposed || sequence!==loadSequence || finished)return;finished=true;if(assetKey)modelLoadVersions.set(assetKey,(modelLoadVersions.get(assetKey)||0)+1);diagram(reason);};
    loadTimer=setTimeout(()=>failed('模型加载超过预期，请检查连接后重试。'),15000);
    try {
      const models=await getModels();if(disposed || sequence!==loadSequence || finished)return;
      const asset=models.find(m=>m.speciesId===s.id);
      if(!asset){finished=true;diagram();return;}
      assetKey=asset.url;
      const {ModelViewerElement}=await import('@google/model-viewer');
      if(disposed || sequence!==loadSequence || finished)return;
      ModelViewerElement.dracoDecoderLocation=`${import.meta.env.BASE_URL}draco/`;
      const viewer=document.createElement('model-viewer') as Viewer;model=viewer;
      const version=modelLoadVersions.get(asset.url)||0;
      viewer.setAttribute('src',import.meta.env.BASE_URL+asset.url.replace(/^\//,'')+(version?`#retry-${version}`:''));
      viewer.setAttribute('alt',`${s.name}的可旋转三维模型`);viewer.setAttribute('camera-controls','');viewer.setAttribute('touch-action','pan-y');
      viewer.setAttribute('shadow-intensity','1');viewer.setAttribute('exposure','1.1');viewer.setAttribute('ar','');viewer.setAttribute('ar-modes','webxr scene-viewer quick-look');
      if(asset.representation==='reconstruction')viewer.setAttribute('camera-orbit','55deg 70deg auto');
      if(!store.state.settings.reducedMotion)viewer.setAttribute('autoplay','');
      const idle=asset.animations.find(name=>/idle/i.test(name));if(idle)viewer.setAttribute('animation-name',idle);
      viewer.innerHTML=`<button slot="ar-button" class="btn ar-button">${icon('Scan',17)} 放进我的空间</button>`;
      viewer.autoRotate=rotating;
      viewer.addEventListener('error',()=>failed('原模型未能加载。'),{once:true});
      viewer.addEventListener('load',()=>{
        if(disposed || sequence!==loadSequence || finished)return;
        finished=true;clearTimeout(loadTimer);container.dataset.state='loaded';container.querySelector('.model-load-status')?.remove();
        representation.textContent=asset.representation==='fossil'?'馆藏化石 · 3D 扫描':asset.representation==='diagram'?'开放许可 · 结构示意':'开放许可 · 3D 复原';
        const licenseUrl=asset.licenseUrl || (asset.license==='CC0-1.0'?'https://creativecommons.org/publicdomain/zero/1.0/':undefined);
        credit.innerHTML=`${asset.title?`${escape(asset.title)}<br>`:''}${escape(asset.author)} · ${licenseUrl?`<a target="_blank" rel="noopener noreferrer" href="${escape(licenseUrl)}">${escape(asset.license)}</a>`:escape(asset.license)} · <a target="_blank" rel="noopener noreferrer" href="${escape(asset.source)}">模型来源 ${icon('ArrowUpRight',12)}</a><br>${escape(asset.note)}${asset.modifications?`<details><summary>查看模型处理记录</summary><p>${escape(asset.modifications)}</p>${asset.derivativeSource?`<a target="_blank" rel="noopener noreferrer" href="${escape(asset.derivativeSource)}">衍生模型与动画来源 ${icon('ArrowUpRight',12)}</a>`:''}</details>`:''}<br>AR 需要兼容的手机与 HTTPS；模型比例以知识卡为准。`;
      },{once:true});
      container.append(viewer);
    } catch {failed('展台组件暂时不可用。');}
  }
  void loadModel();
  dialog.querySelector('#rotate-model')!.addEventListener('click', e => { rotating = !rotating; stage?.rotate(rotating); if (model) model.autoRotate = rotating; (e.currentTarget as HTMLElement).classList.toggle('active', rotating); (e.currentTarget as HTMLElement).setAttribute('aria-pressed', String(rotating)); });
  dialog.querySelector('#compare-model')!.addEventListener('click', () => {
    const el = dialog.querySelector<HTMLElement>('#size-comparison')!; el.hidden = !el.hidden;
    if (!el.hidden) { store.compare(s.id); const max = Math.max(s.lengthM, 1.7); el.innerHTML = `<h3>代表尺寸 · 放到身边看一看</h3><div class="scale-row"><span>${escape(s.name)}</span><i style="width:${Math.max(.3, s.lengthM / max * 100)}%"></i><b>${escape(s.sizeLabel)}</b></div><div class="scale-row human"><span>成人身高参照</span><i style="width:${1.7 / max * 100}%"></i><b>1.7 米</b></div><p class="muted">条形按卡片的代表尺寸线性缩放；体长、身高、翼展与结构尺度等含义见各自标注，不同个体有差异。${s.lengthM < .01 ? '微小生物的条形为便于辨认而放大，不代表实际比例。' : ''}</p>`; }
  });
  dialog.querySelector('#speak-species')!.addEventListener('click', () => speak(`${s.name}。${s.definition}。${s.fact}。${s.misconception}`));
  dialog.querySelector('#mark-read')!.addEventListener('click', e => { const gain = store.read(s.id); (e.currentTarget as HTMLElement).innerHTML = `${icon('Check', 17)} 已阅读`; if (gain) toast(`读懂一段生命故事 · +${gain} 演化点`); });
  dialog.querySelector('#collect-species')!.addEventListener('click', e => { toast(store.collect(s.id)); if (store.state.collected.includes(s.id)) (e.currentTarget as HTMLElement).innerHTML = `${icon('Check', 17)} 已加入图鉴`; });
  dialog.querySelector('#specimen-lab')!.addEventListener('click', () => { close(); onLab(); });
  return { close, dialog };
}
