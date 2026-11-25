import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { serviceWorkerRevision, completeSiteDigest } from '../scripts/build-identity';

it('separates the cache revision (including its template) from the digest of the entire delivered site', () => {
  const root = mkdtempSync(join(tmpdir(), 'museum-identity-'));
  try {
    writeFileSync(join(root, 'index.html'), 'shell');
    writeFileSync(join(root, 'offline-manifest.json'), '["index.html"]');
    writeFileSync(join(root, 'sw.js'), 'worker A');
    const revision = serviceWorkerRevision(root, 'template A'); const site = completeSiteDigest(root);
    expect(serviceWorkerRevision(root, 'template B')).not.toBe(revision);
    writeFileSync(join(root, 'sw.js'), 'worker B'); expect(completeSiteDigest(root)).not.toBe(site);
    const changed = completeSiteDigest(root); writeFileSync(join(root, 'offline-manifest.json'), '[ "index.html" ]');
    expect(completeSiteDigest(root)).not.toBe(changed); expect(serviceWorkerRevision(root, 'template A')).toBe(revision);
    const delivered = completeSiteDigest(root); writeFileSync(join(root, 'extra'), 'asset');
    expect(completeSiteDigest(root)).not.toBe(delivered); expect(serviceWorkerRevision(root, 'template A')).not.toBe(revision);
  } finally { rmSync(root, {recursive:true, force:true}); }
});
