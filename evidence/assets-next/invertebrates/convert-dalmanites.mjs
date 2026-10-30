import fs from 'node:fs';
import { Document, NodeIO } from '@gltf-transform/core';
import { weldPrimitive, simplifyPrimitive, normals, dedup, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
await MeshoptSimplifier.ready;
const base='evidence/assets-next/invertebrates';
const rows=JSON.parse(fs.readFileSync(`${base}/stl-metadata.json`,'utf8'));
const doc=new Document(),buf=doc.createBuffer(),scene=doc.createScene('Dalmanites OUMNH C.29611, serial tomography');
const weights=rows.reduce((s,r)=>s+r.triangles,0);
let total=0;
for(const r of rows){
 const b=fs.readFileSync(r.file), positions=new Float32Array(r.triangles*9);
 for(let i=0;i<r.triangles;i++)for(let j=0;j<9;j++)positions[i*9+j]=b.readFloatLE(84+i*50+12+j*4);
 const acc=doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buf);
 const prim=doc.createPrimitive().setAttribute('POSITION',acc);
 weldPrimitive(prim);
 const target=Math.max(6,Math.floor(19500*r.triangles/weights));
 simplifyPrimitive(prim,{simplifier:MeshoptSimplifier,ratio:target/r.triangles,error:1});
 const mat=doc.createMaterial(r.name).setBaseColorFactor(r.color).setRoughnessFactor(0.8).setMetallicFactor(0).setDoubleSided(true);
 prim.setMaterial(mat);
 scene.addChild(doc.createNode(r.name).setMesh(doc.createMesh(r.name).addPrimitive(prim)));
 const n=(prim.getIndices()?.getCount()??prim.getAttribute('POSITION').getCount())/3;total+=n;
 console.log(r.name,r.triangles,'->',n);
}
await doc.transform(normals(),dedup(),prune());
const dest=`${base}/trilobite.glb`;await new NodeIO().write(dest,doc);
fs.writeFileSync(`${base}/dalmanites-measurements.json`,JSON.stringify({sourceTriangles:rows.reduce((s,r)=>s+r.triangles,0),triangles:total,bytes:fs.statSync(dest).size,animations:[],sourceObjects:rows.length},null,2));
console.log('TOTAL',total,fs.statSync(dest).size);
