export type HotspotBox = {x:number;y:number;width:number;height:number;selected:boolean};

/** Keep projected name buttons close to their anchors without covering each other. */
export function layoutHotspots(items: HotspotBox[], width:number, height:number) {
  const result=items.map(item=>({...item})),placed:HotspotBox[]=[];
  const order=items.map((item,index)=>({item,index})).sort((a,b)=>Number(b.item.selected)-Number(a.item.selected));
  for(const {item,index} of order) {
    let best={...item},bestScore=Infinity;
    const dy=item.height+10,dx=item.width+10;
    for(const [ox,oy] of [[0,0],[0,-dy],[0,dy],[-dx,0],[dx,0],[0,-dy*2],[0,dy*2],[-dx,-dy],[dx,-dy],[-dx,dy],[dx,dy]]) {
      const x=Math.max(item.width/2+8,Math.min(width-item.width/2-8,item.x+ox));
      const y=Math.max(item.height/2+8,Math.min(height-item.height/2-8,item.y+oy));
      const overlap=placed.reduce((sum,p)=>sum+Math.max(0,(item.width+p.width)/2+6-Math.abs(x-p.x))*Math.max(0,(item.height+p.height)/2+6-Math.abs(y-p.y)),0);
      const score=overlap*10000+(x-item.x)**2+(y-item.y)**2;
      if(score<bestScore){bestScore=score;best={...item,x,y};}
    }
    result[index]=best;placed.push(best);
  }
  return result;
}
