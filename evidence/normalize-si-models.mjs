import { NodeIO } from '@gltf-transform/core';
import fs from 'node:fs';

// Input: already-decoded GLBs. The source cache is deliberately outside release.
const io = new NodeIO();
const released = new Set(JSON.parse(fs.readFileSync('public/models/manifest.json', 'utf8')).map((entry) => entry.speciesId));
for (const [sid, key] of JSON.parse(fs.readFileSync('evidence/tmp/smithsonian-sources.json', 'utf8'))) {
  if (!released.has(sid)) continue;
  const file = `public/models/${sid}.glb`;
  const document = await io.read(file);
  if (document.getRoot().listNodes().some((node) => node.getName() === 'Smithsonian source orientation')) {
    console.log(`${sid}: source orientation already applied; skipped`);
    continue;
  }
  const uuid = key.split('/')[1];
  const source = JSON.parse(fs.readFileSync(`evidence/tmp/si-documents/${uuid}.json`, 'utf8')).models[0];
  for (const scene of document.getRoot().listScenes()) {
    const parent = document.createNode('Smithsonian source orientation')
      .setRotation(source.rotation ?? [0, 0, 0, 1]).setScale([0.001, 0.001, 0.001]);
    for (const child of [...scene.listChildren()]) parent.addChild(child);
    scene.addChild(parent);
  }
  await io.write(file, document);
  console.log(sid, fs.statSync(file).size);
}
