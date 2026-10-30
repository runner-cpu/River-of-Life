// Model-viewer frames the default node pose before starting animation. Align it
// with the existing Idle's first sample so later animation cannot leave the frame.
// Animation samples, skin inverse-bind matrices, meshes, and textures are retained.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const manifest = JSON.parse(fs.readFileSync('public/models/manifest.json','utf8'));
const modification = ' Aligned default node transforms with the existing Idle first frame for consistent animated/static viewer framing; retained animation samples and skin inverse-bind matrices.';
const report = [];
for (const id of ['hallucigenia','opabinia']) {
  const input = `evidence/assets-next/invertebrates/${id}.glb`;
  const output = `public/models/${id}.glb`;
  const document = await io.read(input);
  const idle = document.getRoot().listAnimations().find(animation=>animation.getName()==='Idle');
  if (!idle) throw new Error(`${id}: no Idle`);
  const changes = [];
  for (const channel of idle.listChannels()) {
    const node = channel.getTargetNode(), sampler=channel.getSampler(), path=channel.getTargetPath();
    if (!node || !sampler) throw new Error(`${id}: missing animation target or sampler`);
    if (!['translation','rotation','scale'].includes(path)) continue;
    const value = sampler.getOutput().getElement(sampler.getInterpolation()==='CUBICSPLINE'?1:0,[]);
    const key = path[0].toUpperCase()+path.slice(1);
    const before = [...node[`get${key}`]()];
    if (before.some((v,i)=>Math.abs(v-value[i])>1e-8)) changes.push({node:node.getName(),path,before,after:value});
    node[`set${key}`](value);
  }
  await io.write(output,document);
  const roundtrip = await io.read(output);
  const unchanged = (before, after) => before.length === after.length && before.every((item,index)=>Buffer.from(item).equals(Buffer.from(after[index])));
  if (!unchanged(document.getRoot().listAccessors().map(a=>new Uint8Array(a.getArray().buffer,a.getArray().byteOffset,a.getArray().byteLength)),roundtrip.getRoot().listAccessors().map(a=>new Uint8Array(a.getArray().buffer,a.getArray().byteOffset,a.getArray().byteLength)))) throw new Error(`${id}: accessor data changed`);
  if (!unchanged(document.getRoot().listTextures().map(t=>t.getImage()),roundtrip.getRoot().listTextures().map(t=>t.getImage()))) throw new Error(`${id}: texture data changed`);
  const bytes=fs.readFileSync(output), asset=manifest.find(entry=>entry.speciesId===id);
  asset.bytes=bytes.length;
  if (!asset.modifications.includes(modification.trim())) asset.modifications+=modification;
  report.push({id,input,output,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),accessorAndTextureBytesPreserved:true,changes});
}
fs.writeFileSync('public/models/manifest.json',JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync('evidence/idle-pose-preparation.json',JSON.stringify({checkedAt:new Date().toISOString(),report},null,2)+'\n');
console.log(JSON.stringify(report.map(({id,bytes,changes})=>({id,bytes,changedTransforms:changes.length}))));
