import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import { renderServiceWorker } from '../scripts/build-identity';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

const scope = 'https://example.test/museum/';
const prefix = 'life-museum-/museum/-';
const A = 'aaaaaaaaaaaa', B = 'bbbbbbbbbbbb', C = 'cccccccccccc';
const source = readFileSync('public/sw.js', 'utf8');
const manifest = 'offline-manifest.json';
function release(tag: string): Record<string, string> {
  const files = ['index.html', `assets/lazy-${tag}.js`, 'models/shared.glb', `models/only-${tag}.glb`];
  return Object.fromEntries([[manifest, JSON.stringify(files)], ...files.map(file => [file, `${tag} ${file}`])]);
}
function harness() {
  const site = { content: release('A'), online: true, quota: false, capacity: Infinity };
  type Input = string | Request;
  const href = (input: Input) => typeof input === 'string' ? new URL(input, scope).href : input.url;
  const network = vi.fn(async (input: Input) => {
    if (!site.online) throw Error('offline');
    const body = site.content[href(input).slice(scope.length)];
    return body === undefined ? new Response('missing', {status: 404}) : new Response(body);
  });
  class MemoryCache {
    entries = new Map<string, Response>();
    async match(key: Input) { return this.entries.get(href(key))?.clone(); }
    async put(key: Input, value: Response) {
      const used = [...stores.values()].reduce((total, cache) => total + cache.entries.size, 0);
      if (site.quota || (!this.entries.has(href(key)) && used >= site.capacity)) throw Error('quota');
      this.entries.set(href(key), value.clone());
    }
    async delete(key: Input) { return this.entries.delete(href(key)); }
    async add(key: Input) { const res = await network(key); if (!res.ok) throw Error('missing'); await this.put(key, res); }
    async addAll(keys: Input[]) { for (const key of keys) await this.add(key); }
    async keys() { return [...this.entries.keys()].map(k => new Request(k)); }
  }
  const stores = new Map<string, MemoryCache>();
  const caches = {
    keys: async () => [...stores.keys()], delete: async (k: string) => stores.delete(k),
    open: async (k: string) => { if (!stores.has(k)) stores.set(k, new MemoryCache()); return stores.get(k)!; },
  };
  const worker = (rev: string) => {
    const events = new Map<string, (event: object) => void>();
    const skipWaiting = vi.fn();
    const hashes = Object.fromEntries(Object.entries(release(rev === A ? 'A' : rev === B ? 'B' : 'C')).filter(([key]) => key !== manifest)
      .map(([key, body]) => [key, createHash('sha256').update(body).digest('hex')]));
    runInNewContext(renderServiceWorker(source, rev, hashes), {
      self: { registration: { scope }, location: new URL(scope), skipWaiting,
        clients: { claim: vi.fn() },
        addEventListener: (name: string, fn: (event: object) => void) => events.set(name, fn) },
      caches, fetch: network, crypto: webcrypto, URL, Request, Response, Headers, AbortSignal, setTimeout, clearTimeout,
    });
    const lifecycle = async (event: string, extra = {}) => {
      let work: Promise<unknown> | undefined;
      events.get(event)!({waitUntil: (p: Promise<unknown>) => {work = p;}, ...extra});
      await work;
    };
    return { lifecycle, skipWaiting,
      prepare: async () => {
        const postMessage = vi.fn();
        await lifecycle('message', {data: {type: 'CACHE_ALL', progress: true}, ports: [{postMessage}]});
        return postMessage.mock.lastCall?.[0]?.ok;
      },
      get: async (file: string, navigate = false, tab = 'tab') => {
        let response: Promise<Response> | undefined;
        await lifecycle('fetch', {request: { method: 'GET', url: href(file), mode: navigate ? 'navigate' : 'cors' },
          resultingClientId: navigate ? tab : '', clientId: navigate ? '' : tab, respondWith: (p: Promise<Response>) => {response = p;} });
        return (await response)?.text();
      },
    };
  };
  async function legacy(full: boolean) {
    const cache = await caches.open(prefix + A);
    for (const [file, body] of Object.entries(site.content)) if (full || !file.startsWith('models/')) await cache.put(file, new Response(body));
    return cache;
  }
  return { site, stores, caches, worker, network, legacy };
}

it('migrates a complete legacy release from fresh B bytes and waits for the A pages', async () => {
  const h = harness(); const a = await h.legacy(true);
  const unrelated = [prefix + 'neighbour', 'life-museum-/museum/-sub/-cccccccccccc', 'other-app'];
  for (const key of unrelated) await h.caches.open(key);
  h.site.content = release('B'); const b = h.worker(B);
  await b.lifecycle('install');
  expect(await (await a.match('assets/lazy-A.js'))?.text()).toBe('A assets/lazy-A.js');
  const target = await h.caches.open(prefix + B);
  expect(await (await target.match('models/shared.glb'))?.text()).toBe('B models/shared.glb');
  expect(await target.match('models/only-B.glb')).toBeTruthy(); expect(await target.match('models/only-A.glb')).toBeUndefined();
  expect(b.skipWaiting).not.toHaveBeenCalled();
  await b.lifecycle('activate'); h.site.online = false;
  expect(await b.get('models/shared.glb')).toBe('B models/shared.glb');
  expect(h.stores.has(prefix + A)).toBe(false);
  for (const key of unrelated) expect(h.stores.has(key)).toBe(true);
});

it('leaves a partial legacy visitor on a shell installation and keeps a complete legacy cache on B failure', async () => {
  for (const full of [false, true]) {
    const h = harness(); await h.legacy(full); h.site.content = release('B'); delete h.site.content['models/only-B.glb'];
    const b = h.worker(B);
    if (full) { await expect(b.lifecycle('install')).rejects.toThrow(); expect(h.stores.has(prefix + A)).toBe(true); }
    else { await b.lifecycle('install'); await b.lifecycle('activate'); expect(await (await h.caches.open(prefix + B)).match('models/shared.glb')).toBeUndefined(); }
  }
});

it('remembers late completion across offline activation and restart, then recovers B online', async () => {
  const h = harness(); const a = h.worker(A); await a.lifecycle('install'); await a.lifecycle('activate');
  h.site.content = release('B'); const b = h.worker(B); await b.lifecycle('install');
  // A's remaining model downloads finish while B is waiting (for example from a still-current mirror).
  h.site.content = release('A'); expect(await a.prepare()).toBe(true);
  h.site.online = false; await b.lifecycle('activate');
  const restarted = h.worker(B);
  expect(await restarted.get('', true)).toMatch(/startLegacyPreview[\s\S]*A index\.html/);
  expect(await restarted.get('assets/lazy-A.js')).toBe('A assets/lazy-A.js');
  expect(await restarted.get('models/shared.glb')).toBe('A models/shared.glb');
  h.site.online = true; h.site.content = release('B');
  expect(await restarted.prepare()).toBe(true);
  expect(await restarted.get('models/shared.glb')).toBe('A models/shared.glb');
  h.site.online = false;
  expect(await h.worker(B).get('', true, 'new-tab')).toBe('B index.html');
  expect(await h.worker(B).get('models/shared.glb', false, 'new-tab')).toBe('B models/shared.glb');
  expect(await h.worker(B).get('models/shared.glb', false, 'tab')).toBe('A models/shared.glb');
});

it('returns a successful network response on cache quota rejection but exposes explicit preparation and network failures', async () => {
  const h = harness(); const a = h.worker(A); await a.lifecycle('install'); await a.lifecycle('activate'); h.site.quota = true;
  expect(await a.get('models/shared.glb')).toBe('A models/shared.glb');
  expect(await a.prepare()).toBe(false);
  h.site.online = false; await expect(a.get('models/shared.glb')).rejects.toThrow('offline');
});
it('rejects same-URL model bytes from another release and can retry after the matching bytes return', async () => {
  const h = harness(); const a = h.worker(A); await a.lifecycle('install'); await a.lifecycle('activate');
  h.site.content = release('B');
  expect(await a.prepare()).toBe(false);
  expect(await (await h.caches.open(prefix + A)).match('models/shared.glb')).toBeUndefined();
  h.site.content = release('A'); expect(await a.prepare()).toBe(true);
  expect(await a.get('models/shared.glb')).toBe('A models/shared.glb');
});

it.each([true, false])('serves coherent A without free space even after restart (quota during activation: %s)', async quotaDuringActivation => {
  const h = harness(); const a = h.worker(A); await a.lifecycle('install'); await a.lifecycle('activate');
  h.site.content = release('B'); const b = h.worker(B); await b.lifecycle('install');
  h.site.content = release('A'); expect(await a.prepare()).toBe(true);
  h.site.online = false; h.site.quota = quotaDuringActivation; await b.lifecycle('activate');
  h.site.quota = true;
  expect(await h.worker(B).get('', true, 'old-tab')).toMatch(/startLegacyPreview[\s\S]*A index\.html/);
  expect(await h.worker(B).get('models/shared.glb', false, 'old-tab')).toBe('A models/shared.glb');
  h.site.quota = false; h.site.online = true; h.site.content = release('B'); expect(await b.prepare()).toBe(true);
  h.site.online = false; h.site.quota = true;
  expect(await h.worker(B).get('', true, 'quota-tab')).toMatch(/startLegacyPreview[\s\S]*A index\.html/);
  expect(await h.worker(B).get('models/shared.glb', false, 'quota-tab')).toBe('A models/shared.glb');
  h.site.quota = false;
  expect(await h.worker(B).get('', true, '')).toMatch(/startLegacyPreview[\s\S]*A index\.html/);
  expect(await h.worker(B).get('models/shared.glb', false, '')).toBe('A models/shared.glb');
  expect(await h.worker(B).get('', true, 'new-tab')).toBe('B index.html');
  expect(await h.worker(B).get('models/shared.glb', false, 'new-tab')).toBe('B models/shared.glb');
  expect(await h.worker(B).get('models/shared.glb', false, 'old-tab')).toBe('A models/shared.glb');
});

it('reclaims a failed new B so A and C can fit together under quota', async () => {
  const h = harness(); const older = await h.legacy(true);
  const sibling = 'life-museum-/museum/child/-dddddddddddd';
  await (await h.caches.open(sibling)).put('sibling', new Response('keep'));
  h.site.content = release('B'); delete h.site.content['models/only-B.glb'];
  await expect(h.worker(B).lifecycle('install')).rejects.toThrow();
  h.site.content = release('C'); h.site.capacity = older.entries.size * 2 + 1;
  const c = h.worker(C); await c.lifecycle('install');
  expect(h.stores.has(prefix + B)).toBe(false);
  expect(await (await older.match('models/shared.glb'))?.text()).toBe('A models/shared.glb');
  await c.lifecycle('activate'); h.site.online = false;
  expect(await c.get('models/shared.glb')).toBe('C models/shared.glb');
  expect(await (await (await h.caches.open(sibling)).match('sibling'))?.text()).toBe('keep');
});

it('preserves an existing matching rollback cache when fresh verification fails halfway', async () => {
  const h = harness(); await h.legacy(true);
  h.site.content = release('B'); const existing = await h.caches.open(prefix + B);
  for (const [file, text] of Object.entries(h.site.content)) await existing.put(file, new Response(text));
  h.site.content['models/shared.glb'] = 'unexpected bytes';
  await expect(h.worker(B).lifecycle('install')).rejects.toThrow();
  expect(h.stores.get(prefix + B)).toBe(existing);
  expect(await (await existing.match('models/shared.glb'))?.text()).toBe('B models/shared.glb');
  expect(h.stores.has(prefix + A)).toBe(true);
});
