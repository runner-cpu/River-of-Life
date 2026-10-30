import { defineConfig } from 'vite';
import { readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1200, rollupOptions: { output: { manualChunks: { three: ['three'], icons: ['lucide'] } } } },
  plugins: [{ name: 'museum-offline-manifest', closeBundle() {
    const files: string[] = [];
    const walk = (dir: string) => { for (const entry of readdirSync(dir, { withFileTypes: true })) { const path = join(dir, entry.name); if (entry.isDirectory()) walk(path); else if (!['sw.js', 'offline-manifest.json'].includes(entry.name)) files.push(relative('dist', path).replaceAll('\\', '/')); } };
    walk('dist');
    const revision = createHash('sha256'); files.sort().forEach(file => revision.update(file).update(readFileSync(join('dist', file))));
    writeFileSync('dist/offline-manifest.json', JSON.stringify(files));
    const script = readFileSync('public/sw.js', 'utf8').replace('__BUILD_REVISION__', revision.digest('hex').slice(0, 12));
    writeFileSync('dist/sw.js', script);
  } }],
});
