import type { Chapter, Progress, Species } from '../core/types';
import { escape, icon, modal } from '../core/ui';
import { LifeScene } from '../scene/life-scene';
import './classroom.css';

type ClassroomOptions = {
  chapter: Chapter; residents: Species[]; settings: Progress['settings'];
  onSpecies: (species: Species) => void; onEvent: (onClosed: () => void) => void;
  onWorksheet: () => void; onChooseChapter: () => void; onClose: () => void;
};

export function openClassroomExhibit(options: ClassroomOptions) {
  const { chapter, residents } = options;
  const environments = { ocean: '远古海洋', reef: '浅海展景', forest: '远古林地', desert: '内陆展景', plain: '旷野与海岸', ice: '冰期旷野' };
  const { dialog, close } = modal('课堂预览 · '+chapter.name, [
    '<div class="classroom-layout">',
    '<section class="classroom-stage" aria-label="'+escape(chapter.name)+'互动展景">',
    '<div class="classroom-scene" id="classroom-scene"></div>',
    '<div class="classroom-scene-title"><span id="preview-caption">'+escape(environments[chapter.environment])+' / '+String(chapter.id).padStart(2,'0')+'</span><h3 id="preview-heading">'+escape(chapter.title)+'</h3><p id="preview-subtitle">'+escape(chapter.range)+'</p></div>',
    '<div class="classroom-tools" aria-label="展景控制">',
    '<button aria-label="复位课堂视角" title="复位视角" id="preview-reset">'+icon('Scan',18)+'</button>',
    '<button aria-label="暂停课堂动画" title="暂停动画" id="preview-pause" aria-pressed="false">'+icon('Pause',18)+'</button>',
    '<button aria-label="显示物种标签" title="显示物种标签" id="preview-labels" aria-pressed="true">'+icon('Tags',18)+'</button></div>',
    '<div class="classroom-stage-foot"><button id="preview-overview" hidden>'+icon('ArrowLeft',15)+' 返回展厅全景</button><span id="preview-gesture">'+icon('MousePointer2',14)+' 拖动环顾 · 滚轮缩放</span><span class="classroom-art-note" hidden>颜色与姿态为艺术呈现</span></div></section>',
    '<aside class="classroom-guide" aria-label="课堂观察导览">',
    '<div class="classroom-question"><span class="eyebrow">带着一个问题观察</span><h3>'+escape(chapter.question)+'</h3><p>选择一个生命，走近它的身体与故事。</p></div>',
    '<div class="classroom-residents"><div class="classroom-list-heading"><h3>本章代表生命</h3><span>'+String(residents.length).padStart(2,'0')+'</span></div>',
    ...residents.map((s,index)=>'<button class="classroom-resident" data-preview-focus="'+s.id+'" aria-label="聚焦'+escape(s.name)+'" title="'+escape(s.name)+'" aria-pressed="false"><span class="resident-number">'+String(index+1).padStart(2,'0')+'</span><span class="resident-name"><strong>'+escape(s.name)+'</strong><small>'+escape(s.latin)+'</small></span>'+icon('ArrowUpRight',15)+'</button>'),
    '</div><div class="classroom-selected" hidden>',
    '<nav class="classroom-sequence" aria-label="切换观察物种"><button id="preview-previous" aria-label="上一个物种">'+icon('ChevronLeft',18)+'</button><span id="preview-current" aria-live="polite"></span><button id="preview-next" aria-label="下一个物种">'+icon('ChevronRight',18)+'</button></nav>',
    '<div class="classroom-observation"><span class="eyebrow">观察档案</span><p id="preview-selected-summary"></p><dl id="preview-facts"></dl><div class="classroom-insight"><span>'+icon('Eye',15)+' 再仔细看一眼</span><p id="preview-fact"></p></div></div><button class="btn primary" id="preview-read">打开完整生命档案 '+icon('ArrowUpRight',16)+'</button></div>',
    '<div class="classroom-actions"><button class="btn primary" id="preview-event">'+icon('Play',16)+' 观看本章纪元高光</button><button class="text-btn" id="preview-sheet">'+icon('FileDown',16)+' 下载本章学习单</button></div></aside></div>',
    '<footer class="classroom-footer"><p>'+escape(chapter.description)+'</p><span>'+icon('BookOpen',14)+' 教学预览 · 不记录学习奖励</span></footer>',
  ].join(''), true);
  dialog.classList.add('classroom-exhibit');
  dialog.querySelector('.modal-head .eyebrow')!.textContent='生命长河 / 第 '+String(chapter.id).padStart(2,'0')+' 展厅';
  const back=document.createElement('button'); back.className='text-btn classroom-back'; back.innerHTML=icon('Grid2x2',16)+' 选择纪元';
  dialog.querySelector('.modal-head')!.insertBefore(back,dialog.querySelector('.close-modal'));
  back.addEventListener('click',()=>{close();options.onChooseChapter();});
  const element=<T extends HTMLElement=HTMLElement>(selector:string)=>dialog.querySelector<T>(selector)!;
  let selected: Species | undefined, paused=false, labels=true;
  const scene=new LifeScene(element('#classroom-scene'),selectSpecies,options.settings);
  scene.setChapter(chapter,residents);

  function selectSpecies(species:Species) {
    selected=species;
    const index=residents.indexOf(species);
    scene.inspectSpecies(species.id); dialog.classList.add('is-inspecting');
    element('.classroom-selected').hidden=false; element('#preview-overview').hidden=false; element('.classroom-art-note').hidden=false;
    element('#preview-caption').textContent='生命近观 / '+String(index+1).padStart(2,'0');
    element('#preview-heading').textContent=species.name; element('#preview-subtitle').textContent=species.latin;
    element('#preview-current').textContent=species.name+' · '+String(index+1).padStart(2,'0')+' / '+String(residents.length).padStart(2,'0');
    element('#preview-selected-summary').textContent=species.definition;
    element('#preview-facts').innerHTML=[['生活年代',species.period],['体型线索',species.sizeLabel],['食性',species.diet]].map(([key,value])=>'<div><dt>'+key+'</dt><dd>'+escape(value)+'</dd></div>').join('');
    element('#preview-fact').textContent=species.fact;
    element('.classroom-observation').scrollTop=0;
    dialog.querySelectorAll<HTMLButtonElement>('[data-preview-focus]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.previewFocus===species.id)));
    if(matchMedia('(max-width: 650px)').matches) dialog.scrollTo({top:0,behavior:'instant'});
  }
  function reset() {
    scene.reset(); selected=undefined;dialog.classList.remove('is-inspecting');
    element('.classroom-selected').hidden=true;element('#preview-overview').hidden=true;element('.classroom-art-note').hidden=true;
    element('#preview-caption').textContent=environments[chapter.environment]+' / '+String(chapter.id).padStart(2,'0');
    element('#preview-heading').textContent=chapter.title;element('#preview-subtitle').textContent=chapter.range;
    dialog.querySelectorAll('[data-preview-focus]').forEach(item=>item.setAttribute('aria-pressed','false'));
  }
  dialog.querySelectorAll<HTMLButtonElement>('[data-preview-focus]').forEach(button=>button.addEventListener('click',()=>selectSpecies(residents.find(s=>s.id===button.dataset.previewFocus)!)));
  for(const [id,step] of [['#preview-previous',-1],['#preview-next',1]] as const) element(id).addEventListener('click',()=>{
    if(selected) selectSpecies(residents[(residents.indexOf(selected)+step+residents.length)%residents.length]);
  });
  element('#preview-read').addEventListener('click',()=>{if(selected){scene.pause(true);options.onSpecies(selected);}});
  element('#preview-reset').addEventListener('click',reset);element('#preview-overview').addEventListener('click',reset);
  element('#preview-pause').addEventListener('click',event=>{
    paused=!paused;scene.pause(paused);const button=event.currentTarget as HTMLButtonElement;
    button.setAttribute('aria-pressed',String(paused));button.setAttribute('aria-label',paused?'继续课堂动画':'暂停课堂动画');button.title=paused?'继续动画':'暂停动画';button.innerHTML=icon(paused?'Play':'Pause',18);
  });
  element('#preview-labels').addEventListener('click',event=>{labels=!labels;scene.showLabels(labels);(event.currentTarget as HTMLButtonElement).setAttribute('aria-pressed',String(labels));});
  element('#preview-sheet').addEventListener('click',options.onWorksheet);
  element('#preview-event').addEventListener('click',()=>{scene.pause(true);options.onEvent(()=>scene.pause(paused));});
  const observer=new MutationObserver(()=>{
    if(!dialog.isConnected){scene.dispose();observer.disconnect();options.onClose();return;}
    const active=Array.from(document.querySelectorAll('dialog[open]')).at(-1);
    scene.pause(paused || active!==dialog);
  });
  observer.observe(document.body,{childList:true});
  return {dialog,close};
}
