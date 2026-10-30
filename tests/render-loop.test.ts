import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RenderLoop } from '../src/scene/render-loop';

let page: EventTarget & {hidden:boolean}, queue:Map<number,FrameRequestCallback>, sequence:number;
let intersection:(entries:{isIntersecting:boolean}[])=>void;
const frame=()=>{const pending=[...queue.values()];queue.clear();pending.forEach(callback=>callback(100));};
beforeEach(()=>{
  queue=new Map();sequence=0;page=Object.assign(new EventTarget(),{hidden:false});
  vi.stubGlobal('document',page);
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{queue.set(++sequence,callback);return sequence;});
  vi.stubGlobal('cancelAnimationFrame',(id:number)=>queue.delete(id));
  vi.stubGlobal('IntersectionObserver',class{constructor(callback:typeof intersection){intersection=callback;}observe(){}disconnect(){}});
});
afterEach(()=>vi.unstubAllGlobals());

describe('scene render scheduling',()=>{
  it('parks a static scene and renders again only when invalidated',()=>{
    const render=vi.fn(()=>false),loop=new RenderLoop({} as HTMLElement,render);
    frame();expect(render).toHaveBeenCalledTimes(1);expect(queue.size).toBe(0);
    loop.request();loop.request();expect(queue.size).toBe(1);
    frame();expect(render).toHaveBeenCalledTimes(2);expect(queue.size).toBe(0);loop.dispose();
  });
  it('suspends animation outside the viewport and restarts on return',()=>{
    const render=vi.fn(()=>true),loop=new RenderLoop({} as HTMLElement,render);
    frame();expect(queue.size).toBe(1);
    intersection([{isIntersecting:false}]);expect(queue.size).toBe(0);
    loop.request();expect(queue.size).toBe(0);
    intersection([{isIntersecting:true}]);frame();expect(render).toHaveBeenCalledTimes(2);loop.dispose();
  });
  it('suspends hidden documents and permanently stops after disposal',()=>{
    const render=vi.fn(()=>true),loop=new RenderLoop({} as HTMLElement,render);
    frame();page.hidden=true;page.dispatchEvent(new Event('visibilitychange'));expect(queue.size).toBe(0);
    page.hidden=false;page.dispatchEvent(new Event('visibilitychange'));expect(queue.size).toBe(1);
    loop.dispose();loop.request();page.dispatchEvent(new Event('visibilitychange'));expect(queue.size).toBe(0);
  });
});
