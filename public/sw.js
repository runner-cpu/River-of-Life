/* A registration owns only the twelve-hex revision caches for its exact scope. */
const scope = self.registration.scope;
const prefix = `life-museum-${new URL(scope).pathname}-`;
const cacheName = `${prefix}__BUILD_REVISION__`;
const assetHashes = /*__ASSET_HASHES__*/{};
const files = Object.keys(assetHashes);
const urlFor = file => new URL(file, scope).href;
const manifestUrl = urlFor('offline-manifest.json');
const candidatePrefix = urlFor('.offline-state/previous/');
const candidateKey = name => candidatePrefix + encodeURIComponent(name);
const preparedKey = urlFor('.offline-state/prepared');
const pinKey = id => urlFor(`.offline-state/client/${encodeURIComponent(id)}`);
const ignoreVary = { ignoreVary: true };
const owns = name => name.startsWith(prefix) && /^[0-9a-f]{12}$/.test(name.slice(prefix.length));

async function isComplete(cache) {
  const stored = await cache.match(manifestUrl, ignoreVary);
  if (!stored) return false;
  let list;
  try { list = await stored.json(); } catch { return false; }
  if (!Array.isArray(list) || !list.includes('index.html')) return false;
  const entries = new Set((await cache.keys()).map(request => request.url));
  return list.every(file => typeof file === 'string' && entries.has(urlFor(file)));
}

async function previousComplete() {
  for (const key of (await caches.keys()).reverse()) {
    if (key !== cacheName && owns(key) && await isComplete(await caches.open(key))) return key;
  }
}

async function verifiedResponse(file, request, signal) {
  const response = await fetch(request, {cache: 'no-store', signal});
  if (!response.ok) throw new Error(`Unavailable offline resource: ${file}`);
  const bytes = await response.clone().arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (hex !== assetHashes[file]) throw new Error(`Offline resource belongs to another release: ${file}`);
  return response;
}

async function populate(cache, list, { fresh = false, progress = () => {} } = {}) {
  // Also bound the worker's network work if the requesting page closes or times out.
  const signal = AbortSignal.timeout(600_000);
  let completed = 0;
  progress(0, list.length);
  for (const file of list) {
    const url = urlFor(file);
    if (fresh || !(await cache.match(url, ignoreVary))) {
      await cache.put(url, await verifiedResponse(file, url, signal));
    }
    progress(++completed, list.length);
  }
}

self.addEventListener('install', event => event.waitUntil((async () => {
  const existing = await caches.keys();
  const cache = await caches.open(cacheName);
  try {
    const full = await previousComplete();
    const list = full ? files : files.filter(file => !file.startsWith('models/') && !file.startsWith('draco/'));
    await populate(cache, list, {fresh: true});
    await cache.put(manifestUrl, new Response(JSON.stringify(files), {headers: {'Content-Type': 'application/json'}}));
    // Reserve the possible fallback choices before installation succeeds. Activation
    // can then settle the choice with deletions alone, even when storage is full.
    if (!full) for (const name of existing) {
      if (owns(name) && name !== cacheName) await cache.put(candidateKey(name), new Response(name));
    }
  } catch (error) {
    if (!existing.includes(cacheName)) await caches.delete(cacheName);
    throw error;
  }
  // Default lifecycle: this worker waits while the previous release has open pages.
})()));

function candidateEntries(cache) {
  return cache.keys().then(requests => requests.filter(request => request.url.startsWith(candidatePrefix)));
}

self.addEventListener('activate', event => event.waitUntil((async () => {
  const cache = await caches.open(cacheName);
  // A may have completed CACHE_ALL after this worker installed and started waiting.
  const candidates = await candidateEntries(cache);
  const existing = await caches.keys();
  let fallback;
  if (!(await isComplete(cache))) {
    for (const entry of [...candidates].reverse()) {
      const name = decodeURIComponent(entry.url.slice(candidatePrefix.length));
      if (owns(name) && existing.includes(name) && await isComplete(await caches.open(name))) {fallback = name; break;}
    }
  }
  await cache.delete(preparedKey);
  for (const entry of candidates) if (entry.url !== candidateKey(fallback)) await cache.delete(entry);
  for (const key of existing) {
    if (owns(key) && key !== cacheName && key !== fallback) await caches.delete(key);
  }
  await self.clients.claim();
})()));

// Activation leaves at most one candidate. Read it once per worker lifetime.
let fallbackSelection;
function activeFallback(current) {
  return fallbackSelection ??= candidateEntries(current).then(([entry]) =>
    entry && decodeURIComponent(entry.url.slice(candidatePrefix.length)));
}

async function servingCache(event, current) {
  const previous = await activeFallback(current);
  if (!previous) return current;
  if (event.request.mode === 'navigate') {
    // An unpinned document always uses A. B HTML is safe only after future requests
    // from its client can identify their cache without relying on worker memory.
    if (event.resultingClientId && await current.match(preparedKey)) {
      try {
        await current.put(pinKey(event.resultingClientId), new Response(cacheName));
        return current;
      } catch { /* With no space for a pin, the complete A release remains readable. */ }
    }
  } else if (event.clientId && await current.match(pinKey(event.clientId))) {
    return current;
  }
  return caches.open(previous);
}

self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(scope)) return;
  event.respondWith((async () => {
    const current = await caches.open(cacheName);
    const cache = await servingCache(event, current);
    if (request.mode === 'navigate') return (await cache.match(urlFor('index.html'), ignoreVary)) || fetch(request);
    const file = url.href.slice(scope.length);
    if (file.startsWith('.offline-state/')) return fetch(request);
    const cached = await cache.match(request, ignoreVary);
    if (cached) return cached;
    if (cache !== current || !Object.hasOwn(assetHashes, file) || request.headers?.has('range')) return fetch(request);
    const response = await verifiedResponse(file, request);
    try { await cache.put(request, response.clone()); } catch { /* A quota error cannot invalidate the network response. */ }
    return response;
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_ALL') return;
  event.waitUntil((async () => {
    const port = event.ports[0];
    try {
      const cache = await caches.open(cacheName);
      await populate(cache, files, {progress: (completed, total) => {
        if (event.data.progress) port?.postMessage({type: 'progress', completed, total});
      }});
      if (await activeFallback(cache)) await cache.put(preparedKey, new Response('ready'));
      port?.postMessage({ok:true});
    } catch { port?.postMessage({ok:false}); }
  })());
});
