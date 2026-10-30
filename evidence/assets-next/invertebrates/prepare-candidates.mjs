import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, dequantize, textureCompress, resample } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
const base = 'evidence/assets-next/invertebrates';
await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const triCount = doc => doc.getRoot().listScenes().map(scene=>{let t=0;scene.traverse(node=>{const mesh=node.getMesh();if(mesh)for(const p of mesh.listPrimitives())t+=(p.getIndices()?.getCount()??p.getAttribute('POSITION')?.getCount()??0)/3;});return Math.round(t);});
const output=[];
for (const id of process.argv.slice(2)) {
  const input=path.join(base,`${id}-museum.glb`), dest=path.join(base,`${id}.glb`);
  const doc=await io.read(input), before=triCount(doc);
  for(const ext of [...doc.getRoot().listExtensionsUsed()])if(['EXT_meshopt_compression','KHR_draco_mesh_compression','EXT_texture_webp'].includes(ext.extensionName))ext.dispose();
  await doc.transform(dequantize(), dedup(), weld());
  const count=Math.max(...triCount(doc));
  if(count>19500)await doc.transform(simplify({simplifier:MeshoptSimplifier,ratio:19000/count,error:0.1}));
  await doc.transform(textureCompress({encoder:sharp,targetFormat:'png',resize:[512,512]}),resample(),prune());
  await io.write(dest,doc);
  const row={id,input,output:dest,sourceBytes:fs.statSync(input).size,sourceTriangles:before,triangles:triCount(doc),bytes:fs.statSync(dest).size,animations:doc.getRoot().listAnimations().map(a=>a.getName()),extensions:doc.getRoot().listExtensionsUsed().map(e=>e.extensionName)};
  if(row.bytes>2097152){await doc.transform(textureCompress({encoder:sharp,targetFormat:'jpeg',resize:[512,512],quality:82}));await io.write(dest,doc);row.bytes=fs.statSync(dest).size;row.textureChange='512px JPEG quality 82';}
  output.push(row);console.log(JSON.stringify(row));
}
fs.writeFileSync(path.join(base,`measurements-${process.argv.slice(2).join('-')}.json`),JSON.stringify(output,null,2));
