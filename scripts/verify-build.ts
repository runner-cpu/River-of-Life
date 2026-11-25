import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

import { completeSiteDigest, identityHashMethod, offlineAssetHashes, renderServiceWorker, serviceWorkerRevision } from './build-identity';

const assets = offlineAssetHashes('dist');
const files = Object.keys(assets);
const template = readFileSync('public/sw.js', 'utf8');
const revision = serviceWorkerRevision('dist', template, assets);
if (readFileSync('dist/sw.js', 'utf8') !== renderServiceWorker(template, revision, assets)) throw new Error('Service worker differs from the built assets or worker template.');
if (readFileSync('dist/offline-manifest.json', 'utf8') !== JSON.stringify(files)) throw new Error('Offline manifest differs from the delivered file inventory.');
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const gzipBytes = (selected: string[]) => selected.reduce((total,file) => total + gzipSync(readFileSync(join('dist',file)),{level:6}).length,0);
const models = files.filter(file => file.endsWith('.glb'));
const result = {
  builtAt: statSync('dist/index.html').mtime.toISOString(), indexSha256: hash('dist/index.html'),
  releaseContentSha256: completeSiteDigest('dist'), serviceWorkerRevision: revision, manifestSha256: hash('dist/models/manifest.json'),
  jsCssGzipBytes: gzipBytes(files.filter(file => /\.(js|css)$/.test(file))), models: models.length,
  modelBytes: models.reduce((total,file) => total + statSync(join('dist',file)).size,0),
  appChunkGzipBytes: gzipBytes(files.filter(file => file.startsWith('assets/') && /\.(js|css)$/.test(file))),
  nonModelGzipBytes: gzipBytes(files.filter(file => !file.endsWith('.glb'))),
  gzipMethod: 'Independent files, gzip level 6, mtime 0 (Node zlib).',
  releaseContentHashMethod: `${identityHashMethod} Covers every delivered site file, including sw.js and offline-manifest.json.`,
};
writeFileSync('evidence/build-verification.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
