import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export const identityHashMethod = 'SHA-256 of JSON [relative path, lowercase SHA-256 of file bytes] pairs, sorted by relative path and encoded as UTF-8.';
const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

function siteFiles(root: string): string[] {
  function walk(dir: string): string[] {
    return readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? walk(path) : [relative(root, path).replaceAll('\\', '/')];
    });
  }
  return walk(root).sort();
}

export function offlineAssetHashes(root: string): Record<string, string> {
  return Object.fromEntries(siteFiles(root).filter(path => path !== 'sw.js' && path !== 'offline-manifest.json')
    .map(path => [path, sha256(readFileSync(join(root, path)))]));
}

export function completeSiteDigest(root: string): string {
  return sha256(JSON.stringify(siteFiles(root).map(path => [path, sha256(readFileSync(join(root, path)))])));
}

export function serviceWorkerRevision(root: string, template: string, assets = offlineAssetHashes(root)): string {
  return sha256(JSON.stringify([sha256(template), Object.entries(assets)])).slice(0, 12);
}

export function renderServiceWorker(template: string, revision: string, assets: Record<string, string>): string {
  return template.replace('__BUILD_REVISION__', revision).replace('/*__ASSET_HASHES__*/{}', () => JSON.stringify(assets));
}
