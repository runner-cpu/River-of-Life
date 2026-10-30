import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Original structure illustration. Feather patterns, color and pose are artistic.
export function createArchaeopteryx() {
  const bird = new THREE.Group(); bird.name = 'archaeopteryx';
  const skinMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .93 });
  const feathers = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .94 });
  const limbMaterial = new THREE.MeshStandardMaterial({ color: '#887659', roughness: .92 });
  const horn = new THREE.MeshStandardMaterial({ color: '#4c473c', roughness: .8 });
  const mouth = new THREE.MeshStandardMaterial({ color: '#3d3027', roughness: 1 });
  const ivory = new THREE.MeshStandardMaterial({ color: '#d8cfb5', roughness: .78 });
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: '#131c18', roughness: .18 });
  const back = new THREE.Color('#746b52'), belly = new THREE.Color('#c3b696');
  const profile = [
    [-1.88,1.61,.014,.023],[-1.66,1.64,.055,.052],[-1.43,1.7,.105,.095],
    [-1.23,1.73,.15,.145],[-1.05,1.64,.145,.145],[-.91,1.42,.13,.14],
    [-.7,1.23,.22,.23],[-.39,1.12,.31,.3],[0,1.08,.31,.3],
    [.38,1.12,.22,.21],[.68,1.16,.09,.09],[.8,1.18,.03,.035],
  ];
  const path = new THREE.CatmullRomCurve3(profile.map(p=>new THREE.Vector3(p[0],p[1],0)),false,'centripetal');
  const positions:number[]=[], colors:number[]=[], indices:number[]=[];
  const rings=64, sides=24;
  for(let i=0;i<=rings;i++) {
    const t=i/rings, center=path.getPoint(t), tangent=path.getTangent(t);
    const up=new THREE.Vector3(-tangent.y,tangent.x,0).normalize();
    const u=t*(profile.length-1), a=Math.min(Math.floor(u),profile.length-2), mix=u-a;
    const ry=THREE.MathUtils.lerp(profile[a][2],profile[a+1][2],mix), rz=THREE.MathUtils.lerp(profile[a][3],profile[a+1][3],mix);
    for(let j=0;j<sides;j++) {
      const angle=j/sides*Math.PI*2, top=Math.cos(angle);
      positions.push(center.x+up.x*top*ry,center.y+up.y*top*ry,Math.sin(angle)*rz);
      const shade=back.clone().lerp(belly,THREE.MathUtils.smoothstep(-top,-.15,.9)*.85);
      shade.multiplyScalar(1+Math.sin(i*2.1+j*.9)*.025); colors.push(shade.r,shade.g,shade.b);
      if(i<rings) { const n=i*sides+j,next=i*sides+(j+1)%sides; indices.push(n,next,n+sides,next,next+sides,n+sides); }
    }
  }
  const geometry=new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3)); geometry.setIndex(indices); geometry.computeVertexNormals(); bird.add(new THREE.Mesh(geometry,skinMaterial));
  const joint=(parent:THREE.Object3D,a:number[],b:number[],r:number,material:THREE.Material=horn,tip=r*.7)=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b);
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(tip,r,start.distanceTo(end),8),material);
    mesh.position.copy(start).add(end).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize()); parent.add(mesh);
  };
  const feather=(parent:THREE.Object3D,a:number[],b:number[],width:number,color:string)=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),length=start.distanceTo(end);
    const vertices:number[]=[],tints:number[]=[],faces:number[]=[];
    const base=new THREE.Color(color),tip=new THREE.Color('#33463e');
    for(let i=0;i<=12;i++) {
      const t=i/12,w=Math.pow(Math.sin(Math.PI*t),.72)*width*(1-.035*Math.sin(i*3));
      const bend=Math.sin(t*Math.PI)*length*.035;
      for(let j=0;j<3;j++) {
        vertices.push(j===0?-w*.46:j===2?w*.54:0,t*length,bend+(j===1?width*.11:0));
        const shade=base.clone().lerp(tip,t*.28); if(j===1) shade.lerp(new THREE.Color('#a49b7b'),.18);
        tints.push(shade.r,shade.g,shade.b);
      }
      if(i<12) {const n=i*3; faces.push(n,n+3,n+1,n+1,n+3,n+4,n+1,n+4,n+2,n+2,n+4,n+5);}
    }
    const shape=new THREE.BufferGeometry();shape.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));shape.setAttribute('color',new THREE.Float32BufferAttribute(tints,3));shape.setIndex(faces);shape.computeVertexNormals();
    const mesh=new THREE.Mesh(shape,feathers),direction=end.sub(start).normalize();
    const across=new THREE.Vector3().crossVectors(direction,new THREE.Vector3(0,1,0)).normalize(),normal=new THREE.Vector3().crossVectors(across,direction).normalize();
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(across,direction,normal));mesh.position.copy(start);parent.add(mesh);
  };
  joint(bird,[.52,1.16,0],[2.6,1.34,0],.09,limbMaterial,.009);
  for(let i=0;i<18;i++) for(const sign of [-1,1]) {
    const x=.57+i*.108,spread=Math.sin((i+2)/22*Math.PI)*.36;
    feather(bird,[x,1.17+i*.009,sign*.025],[x+.43,1.2+i*.009,sign*spread],.19,i%3===0?'#6a7059':'#4e6051');
  }
  // Coverts bridge the shoulder into the continuous body skin.
  for(const sign of [-1,1]) for(let i=0;i<9;i++) {
    const x=-.58+i*.095;
    feather(bird,[x,1.37,sign*.09],[x+.34,1.29,sign*.24],.16,'#8d8163');
  }
  const wings:THREE.Group[]=[];
  for(const sign of [-1,1]) {
    const wing=new THREE.Group();wing.position.set(-.43,1.23,sign*.24);wing.scale.z=sign;wing.rotation.x=sign*.1;bird.add(wing);wings.push(wing);
    joint(wing,[0,0,0],[.12,.01,.62],.07,limbMaterial);
    joint(wing,[.12,.01,.62],[-.2,.02,1.12],.045,limbMaterial);
    for(let i=0;i<12;i++) {
      const t=i/11;
      feather(wing,[-.18+t*.3,.035,1.06-t*.5],[.05+t*.9,-.12,2.1-t*.62],.25,i%4===0?'#636e57':'#455a4b');
    }
    for(let i=0;i<12;i++) feather(wing,[i*.012,.065,.07+i*.061],[.68,-.055,.22+i*.077],.22,i%3===0?'#9a906f':'#827e61');
    for(let row=0;row<2;row++) for(let i=0;i<10;i++) feather(wing,[-.14+i*.021+row*.09,.12-row*.018,.04+i*.09],[.18+i*.018+row*.13,.075-row*.035,.17+i*.095],.17,row?'#8b8366':'#a39675');
    for(let i=0;i<3;i++) joint(wing,[-.2,.02,1.08+i*.04],[-.37-i*.035,.015,1.19+i*.055],.012,horn,.002);
    joint(bird,[.13,.86,sign*.22],[.45,.46,sign*.23],.095,limbMaterial,.05);
    joint(bird,[.45,.46,sign*.23],[.15,.105,sign*.3],.028,limbMaterial,.022);
    for(let toe=-1;toe<=1;toe++) {
      const z=sign*.3+toe*.1;
      joint(bird,[.15,.105,sign*.3],[-.13,.05,z],.017,limbMaterial,.009);
      joint(bird,[-.13,.05,z],[-.23,.02,z+toe*.025],.01,horn,.001);
    }
    joint(bird,[.15,.09,sign*.3],[.4,.035,sign*.34],.014,limbMaterial,.006);
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.034,16,10),eyeMaterial);eye.position.set(-1.28,1.755,sign*.135);bird.add(eye);
    const glint=new THREE.Mesh(new THREE.SphereGeometry(.007,8,6),ivory);glint.position.set(-1.293,1.766,sign*.162);bird.add(glint);
    joint(bird,[-1.85,1.596,sign*.022],[-1.35,1.578,sign*.092],.012,mouth,.017);
    joint(bird,[-1.84,1.572,sign*.02],[-1.31,1.55,sign*.085],.019,limbMaterial,.033);
    // Tooth count is illustrative, not a specimen-level anatomical assertion.
    for(let i=0;i<7;i++) {
      const x=-1.78+i*.053,z=sign*(.028+i*.008);
      joint(bird,[x,1.592,z],[x-.008,1.557,z],.008,ivory,.001);
    }
  }
  // Combine static pieces per material; articulation stays on the wing groups.
  for(const parent of [bird,...wings]) {
    const batches=new Map<THREE.Material,THREE.Mesh[]>();
    for(const child of [...parent.children]) if(child instanceof THREE.Mesh && !Array.isArray(child.material)) {
      const list=batches.get(child.material)||[];list.push(child);batches.set(child.material,list);
    }
    for(const [material,meshes] of batches) {
      if(meshes.length<2) continue;
      const pieces=meshes.map(mesh=>{mesh.updateMatrix();const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();g.applyMatrix4(mesh.matrix);return g;});
      const merged=mergeGeometries(pieces);pieces.forEach(p=>p.dispose());
      if(!merged) continue;
      meshes.forEach(mesh=>{parent.remove(mesh);mesh.geometry.dispose();});parent.add(new THREE.Mesh(merged,material));
    }
  }
  bird.userData.form='archaeopteryx';bird.userData.joints=wings;
  bird.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;}});
  return bird;
}
