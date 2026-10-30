import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const files = (JSON.parse(readFileSync('dist/offline-manifest.json','utf8')) as string[]).sort();
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const revision = createHash('sha256');
files.forEach(file => revision.update(file).update(readFileSync(join('dist',file))));
const gzipBytes = (selected: string[]) => selected.reduce((total,file) => total + gzipSync(readFileSync(join('dist',file)),{level:6}).length,0);
const models = files.filter(file => file.endsWith('.glb'));
const result = {
  builtAt: statSync('dist/index.html').mtime.toISOString(), indexSha256: hash('dist/index.html'),
  releaseContentSha256: revision.digest('hex'), manifestSha256: hash('public/models/manifest.json'),
  jsCssGzipBytes: gzipBytes(files.filter(file => /\.(js|css)$/.test(file))), models: models.length,
  modelBytes: models.reduce((total,file) => total + statSync(join('dist',file)).size,0),
  appChunkGzipBytes: gzipBytes(files.filter(file => file.startsWith('assets/') && /\.(js|css)$/.test(file))),
  nonModelGzipBytes: gzipBytes(files.filter(file => !file.endsWith('.glb'))),
  gzipMethod: 'Independent files, gzip level 6, mtime 0 (Node zlib).',
  releaseContentHashMethod: 'SHA-256 over each UTF-8 relative path followed by its file bytes, in lexicographically sorted offline-manifest.json order; excludes sw.js and offline-manifest.json, matching Vite offline build revision.',
};
if(!readFileSync('dist/sw.js','utf8').includes(result.releaseContentSha256.slice(0,12))) throw new Error('Service worker revision differs from build content.');
writeFileSync('evidence/build-verification.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
