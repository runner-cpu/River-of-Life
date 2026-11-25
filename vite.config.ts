import { defineConfig } from 'vite';
import { writeFileSync, readFileSync } from 'node:fs';
import { offlineAssetHashes, renderServiceWorker, serviceWorkerRevision } from './scripts/build-identity';

export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1200, rollupOptions: { output: { manualChunks: { three: ['three'], icons: ['lucide'] } } } },
  plugins: [{ name: 'museum-offline-manifest', closeBundle() {
    const template = readFileSync('public/sw.js', 'utf8');
    const assets = offlineAssetHashes('dist');
    const revision = serviceWorkerRevision('dist', template, assets);
    writeFileSync('dist/offline-manifest.json', JSON.stringify(Object.keys(assets)));
    writeFileSync('dist/sw.js', renderServiceWorker(template, revision, assets));
  } }],
});
