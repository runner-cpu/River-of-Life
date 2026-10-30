import * as THREE from 'three';
import type { Chapter } from '../core/types';
import { seeded } from '../core/lab';

// Scenery frames a clear observation area. Vegetation is contextual illustration.
export function buildHabitat(chapter: Chapter, ocean: boolean) {
  const group = new THREE.Group(), random = seeded(chapter.id * 149);
  const ice = chapter.environment === 'ice', forest = chapter.environment === 'forest';
  const colors = ice ? ['#b9c9c8', '#d8e0d8'] : ocean ? ['#718579', '#9b9a7d'] : chapter.environment === 'desert' ? ['#a18e70', '#b9a384'] : ['#687663', '#9a9b7c'];
  const floor = new THREE.PlaneGeometry(100, 100, 64, 64); floor.rotateX(-Math.PI / 2);
  const points = floor.attributes.position, tint = new Float32Array(points.count * 3);
  const low = new THREE.Color(colors[0]), high = new THREE.Color(colors[1]);
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i), z = points.getZ(i), edge = THREE.MathUtils.smoothstep(Math.hypot(x, z), 10, 24);
    const lagoon = chapter.id === 6 || chapter.id === 7 ? .8 * (1 - THREE.MathUtils.smoothstep(Math.hypot((x - 5.6) / 4.3, (z + 3.7) / 3.2), .6, 1.05)) : 0;
    points.setY(i, -.58 + edge * (Math.sin(x * .23) * Math.cos(z * .21) * 1.1) - lagoon);
    const mix = .4 + Math.sin(x * .41 + z * .17) * .1 + Math.cos(z * .63) * .1;
    const c = low.clone().lerp(high, mix); tint.set([c.r, c.g, c.b], i * 3);
  }
  floor.setAttribute('color', new THREE.BufferAttribute(tint, 3)); floor.computeVertexNormals();
  const ground = new THREE.Mesh(floor, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); ground.receiveShadow = true; group.add(ground);

  const stoneGeo = new THREE.DodecahedronGeometry(1, 1), stoneMat = new THREE.MeshStandardMaterial({ color: ice ? '#8fa8ab' : '#74776b', roughness: 1 });
  // Rocks stay outside the residents' clear central floor.
  for (let i = 0; i < 25; i++) {
    const angle = random() * Math.PI * 2, radius = 9.5 + random() * 13;
    const stone = new THREE.Mesh(stoneGeo, stoneMat), scale = .25 + random() * .9;
    stone.position.set(Math.cos(angle) * radius, -.51, Math.sin(angle) * radius);
    stone.rotation.set(random() * .3, random() * 6, random() * .3); stone.scale.set(scale * 1.8, scale * .6, scale); stone.castShadow = true; stone.receiveShadow = true; group.add(stone);
  }
  const foliage = [new THREE.MeshStandardMaterial({color:'#2f5246',roughness:1,side:THREE.DoubleSide}),new THREE.MeshStandardMaterial({color:'#526e50',roughness:1,side:THREE.DoubleSide}),new THREE.MeshStandardMaterial({color:'#72805a',roughness:1,side:THREE.DoubleSide})];
  const bark = new THREE.MeshStandardMaterial({ color: '#635f50', roughness: 1 });
  if (!ocean && !ice) {
    // Open, branching silhouettes keep the forest behind the observation floor.
    const branchMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });
    for (let i = 0; i < (forest ? 16 : 8); i++) {
      const tree = new THREE.Group(), h = 4.5 + random() * 3;
      tree.position.set((i % 8 - 3.5) * 4.7 + random() * 2, -.58, -12 - Math.floor(i / 8) * 7 - random() * 4);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.025, .13, h, 7), bark); trunk.position.y = h / 2; tree.add(trunk);
      const vertices: number[] = [], shades: number[] = [];
      const addLeaf = (a: THREE.Vector3, b: THREE.Vector3, width: number, shade: THREE.Color) => {
        const axis = b.clone().sub(a), cross = new THREE.Vector3(-axis.z, 0, axis.x).normalize().multiplyScalar(width);
        const mid = a.clone().lerp(b, .46), left = mid.clone().add(cross), right = mid.clone().sub(cross);
        mid.y += width * .35;
        for (const p of [a, left, mid, left, b, mid, b, right, mid, right, a, mid]) { vertices.push(p.x,p.y,p.z); shades.push(shade.r,shade.g,shade.b); }
      };
      for (let tier = 0; tier < 7; tier++) {
        const t = tier / 7, y = h * (.25 + .7 * t), reach = h * .29 * (1 - t * .82);
        for (let branch = 0; branch < 5; branch++) {
          const angle = branch / 5 * Math.PI * 2 + tier * 1.9 + random() * .4;
          const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
          const sideways = new THREE.Vector3(-direction.z, 0, direction.x);
          const length = reach * (.75 + random() * .4);
          const start = new THREE.Vector3(0,y,0), end = direction.clone().multiplyScalar(length); end.y = y + h * .05;
          const shade = new THREE.Color('#315c4c').lerp(new THREE.Color('#77916a'), random() * .65 + t * .22);
          addLeaf(start,end,length*.14,shade);
          for (let j = 1; j <= 5; j++) {
            const u = j / 6, center = start.clone().lerp(end,u); center.y -= Math.sin(u * Math.PI) * .16;
            for (const sign of [-1,1]) {
              const tip = center.clone().addScaledVector(direction,length*.19).addScaledVector(sideways,sign*length*.28*(1-u*.8)); tip.y += .08;
              addLeaf(center,tip,length*.12,shade);
            }
          }
        }
      }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)); geometry.setAttribute('color',new THREE.Float32BufferAttribute(shades,3)); geometry.computeVertexNormals();
      // Distant canopy does not need a separate shadow pass.
      tree.add(new THREE.Mesh(geometry,branchMat)); group.add(tree);
    }
  }
  if (!ice) for(let i=0;i<(ocean?32:30);i++) {
    const angle=random()*Math.PI*2, radius=8.5+random()*6;
    const fern=new THREE.Group();fern.position.set(Math.cos(angle)*radius,-.57,Math.sin(angle)*radius);fern.rotation.y=random()*6;
    const verts:number[]=[],faces:number[]=[];const height=ocean?.65+random()*.9:.3+random()*.45;
    for(let f=0;f<7;f++) {
      const a=f/7*Math.PI*2;
      for(let j=1;j<9;j++) {
        const t=j/9,reach=t*height,up=Math.sin(t*Math.PI*.7)*height;
        const center=new THREE.Vector3(Math.cos(a)*reach,up,Math.sin(a)*reach);
        const side=new THREE.Vector3(-Math.sin(a),0,Math.cos(a)).multiplyScalar(Math.sin(t*Math.PI)*height*.23);
        for(const sign of [-1,1]){const n=verts.length/3;verts.push(center.x,center.y,center.z,center.x+side.x*sign,center.y-.045,center.z+side.z*sign,center.x+Math.cos(a)*height*.11,center.y+height*.07,center.z+Math.sin(a)*height*.11);faces.push(n,n+1,n+2);}
      }
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geometry.setIndex(faces);geometry.computeVertexNormals();
    fern.add(new THREE.Mesh(geometry,foliage[i%3]));group.add(fern);
  }
  if (chapter.id === 6 || chapter.id === 7) {
    const coastline = (radius: number) => {
      const shape = new THREE.Shape();
      for(let j=0;j<=80;j++){const a=j/80*Math.PI*2,r=radius*(1+.04*Math.sin(a*3)+.025*Math.cos(a*7));const x=Math.cos(a)*r,y=Math.sin(a)*r;if(j===0)shape.moveTo(x,y);else shape.lineTo(x,y);}
      return new THREE.ShapeGeometry(shape);
    };
    const shore = new THREE.Mesh(coastline(1), new THREE.MeshStandardMaterial({color:'#aaa58a',roughness:1}));
    shore.rotation.x=-Math.PI/2;shore.scale.set(4.3,3.2,1);shore.position.set(5.6,-.55,-3.7);shore.receiveShadow=true;group.add(shore);
    const water = new THREE.Mesh(coastline(1),new THREE.MeshStandardMaterial({color:'#4b8584',roughness:.34,metalness:.08,transparent:true,opacity:.72}));
    water.rotation.x=-Math.PI/2;water.scale.set(3.9,2.85,1);water.position.set(5.6,-.51,-3.7);group.add(water);
  }
  return group;
}
