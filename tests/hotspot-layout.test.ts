import { describe, expect, it } from 'vitest';
import { layoutHotspots } from '../src/scene/hotspot-layout';

describe('projected specimen label layout',()=>{
  it('separates six crowded labels within a phone-sized stage',()=>{
    const items=Array.from({length:6},(_,index)=>({x:170+index*5,y:210+index*2,width:98,height:32,selected:index===3}));
    const boxes=layoutHotspots(items,350,400);
    expect(boxes[3].x).toBe(items[3].x);expect(boxes[3].y).toBe(items[3].y);
    for(let i=0;i<boxes.length;i++){
      const a=boxes[i];expect(a.x-a.width/2).toBeGreaterThanOrEqual(8);expect(a.x+a.width/2).toBeLessThanOrEqual(342);
      expect(a.y-a.height/2).toBeGreaterThanOrEqual(8);expect(a.y+a.height/2).toBeLessThanOrEqual(392);
      for(let j=i+1;j<boxes.length;j++){const b=boxes[j];expect(Math.abs(a.x-b.x)>=(a.width+b.width)/2 || Math.abs(a.y-b.y)>=(a.height+b.height)/2).toBe(true);}
    }
  });
  it('retains the original anchor when there is enough room',()=>{
    const items=[{x:80,y:70,width:80,height:30,selected:false},{x:230,y:210,width:100,height:32,selected:false}];
    expect(layoutHotspots(items,350,400)).toEqual(items);
  });
});
