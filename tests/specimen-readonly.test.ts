import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameStore } from '../src/core/store';
import { species } from '../src/content/species';
import { questions } from '../src/content/questions';
const harness=vi.hoisted(()=>({elements:new Map<string, {hidden:boolean;innerHTML:string;dataset:Record<string,string>;textContent:string;listeners:Map<string,(e:unknown)=>void>;addEventListener:(name:string,fn:(e:unknown)=>void)=>void;querySelector:()=>null}>()}));
vi.mock('../src/core/ui',()=>({escape:String,icon:()=>'',toast:vi.fn(),speak:vi.fn(),modal:()=>({dialog:{isConnected:true,querySelector:(selector:string)=>{if(!harness.elements.has(selector)){const el={hidden:true,innerHTML:'',dataset:{},textContent:'',listeners:new Map(),addEventListener(name:string,fn:(e:unknown)=>void){this.listeners.set(name,fn);},querySelector:()=>null};harness.elements.set(selector,el);}return harness.elements.get(selector);}},close:vi.fn()})}));
vi.mock('../src/modes/specimen-annotations',()=>({mountSpecimenAnnotations:()=>({bind:vi.fn(),dispose:vi.fn()})}));
vi.mock('../src/modes/guide',()=>({guideMarkup:()=>'',mountGuide:()=>()=>{}}));
vi.mock('../src/scene/life-scene',()=>({getModels:()=>new Promise(()=>{}),SpecimenStage:class{}}));
import { showSpecimen } from '../src/modes/specimen';
afterEach(()=>{vi.unstubAllGlobals();harness.elements.clear();vi.restoreAllMocks();});
describe('specimen read-only mutation boundary',()=>{
 it('never invokes any progression method, even for synthetic disabled actions',()=>{
  vi.stubGlobal('document',{body:{}});vi.stubGlobal('MutationObserver',class{observe(){}disconnect(){}});
  const store=new GameStore(species,questions,{persist:false});const before=structuredClone(store.state);
  const calls=['observe','read','collect','compare'] as const;const spies=calls.map(method=>vi.spyOn(store,method));const onLab=vi.fn();
  showSpecimen(species[0],store,onLab,{readOnly:true});
  for(const id of ['#mark-read','#collect-species','#compare-model','#specimen-lab'])harness.elements.get(id)!.listeners.get('click')!({currentTarget:{innerHTML:''}});
  spies.forEach(spy=>expect(spy).not.toHaveBeenCalled());expect(onLab).not.toHaveBeenCalled();expect(store.state).toEqual(before);
 });
 it('keeps observation and comparison behavior for default callers',()=>{
  vi.stubGlobal('document',{body:{}});vi.stubGlobal('MutationObserver',class{observe(){}disconnect(){}});
  const store=new GameStore(species,questions,{persist:false});const observe=vi.spyOn(store,'observe');const compare=vi.spyOn(store,'compare');
  showSpecimen(species[0],store,()=>{});harness.elements.get('#compare-model')!.listeners.get('click')!({});
  expect(observe).toHaveBeenCalledWith(species[0].id);expect(compare).toHaveBeenCalledWith(species[0].id);
 });
});
