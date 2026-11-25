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

// Runs in the fallback document before any cached release code. Its storage view
// lasts for this realm, including asynchronous callbacks and BFCache restoration.
function startLegacyPreview(html, labelPreview) {
  const saveKey = 'life-museum-save-v1';
  const temporary = new Map();
  try {
    const saved = window.localStorage.getItem(saveKey);
    if (saved !== null) temporary.set(saveKey, saved);
  } catch { /* IndexedDB may still contain the user's only valid copy. */ }
  Object.defineProperty(window, 'localStorage', {value: Object.freeze({
    getItem: key => temporary.get(String(key)) ?? null,
    setItem: (key, value) => temporary.set(String(key), String(value)),
    removeItem: key => temporary.delete(String(key)), clear: () => temporary.clear(),
    key: index => [...temporary.keys()][index] ?? null, get length() { return temporary.size; },
  }), configurable: false});

  // Open only the existing progress database. An empty origin stays empty, and
  // the predecessor cannot receive a versionchange transaction to create stores.
  let factory;
  try { factory = window.indexedDB; } catch { /* blocked storage */ }
  Object.defineProperty(window, 'indexedDB', {value: Object.freeze({open(name, version) {
    if (!factory || name !== 'life-museum' || version !== 1) throw new Error('Offline preview');
    const request = factory.open(name, version);
    request.addEventListener('upgradeneeded', event => {
      event.stopImmediatePropagation(); request.transaction.abort();
    });
    request.addEventListener('success', event => {
      const db = request.result, transact = db.transaction.bind(db);
      try {
        Object.defineProperty(db, 'transaction', {value(stores, mode = 'readonly') {
          if (mode !== 'readonly') throw new Error('Offline preview is read-only');
          return transact(stores, 'readonly');
        }, configurable: false});
      } catch {
        // Never pass an unprotected connection to the old application.
        event.stopImmediatePropagation(); db.close();
      }
    });
    return request;
  }}), configurable: false});

  // Continue the original parser so module scripts run normally, and preserve
  // the original document URL as the base for its release-specific imports.
  document.write(html);
  document.addEventListener('DOMContentLoaded', labelPreview, {once:true});
}

function labelLegacyPreview() {
  document.getElementById('offline-preview-recovery')?.remove();
  const notice = () => {
    const label = document.createElement('p');
    label.textContent = '旧版离线预览 · 本页操作仅在当前窗口模拟，不会保存个人进度。可在设置中导出或准备新版离线资源。';
    label.style.cssText = 'margin:0;padding:.6em 1em;background:#fff1ca;color:#362e18;font:600 14px/1.4 system-ui';
    return label;
  };
  const banner = notice();
  banner.style.position = 'sticky'; banner.style.top = '0'; banner.style.zIndex = '1000';
  document.body.prepend(banner);
  const labelDialog = dialog => { if (!dialog.querySelector('[data-offline-notice]')) {
    const label = notice(); label.dataset.offlineNotice = ''; dialog.prepend(label);
  }};
  document.querySelectorAll('dialog').forEach(labelDialog);
  new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node.nodeName === 'DIALOG') labelDialog(node);
    }
  }).observe(document.body, {childList:true});
}

async function legacyPreview(response) {
  // The old HTML is data, including closing script tags. CSP rejection, a
  // missing document, or failure to install a guard leaves only recovery text.
  const message = '无法打开旧版离线预览。个人记录仍然保留，请重新加载后重试。';
  const headers = new Headers(response?.headers);
  for (const name of ['Content-Length', 'Content-Encoding', 'ETag', 'Last-Modified']) headers.delete(name);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  const html = response && JSON.stringify(await response.text()).replaceAll('<', '\\u003c');
  const bootstrap = html ? `<script>(${startLegacyPreview})(${html}, ${labelLegacyPreview})</script>` : '';
  return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8">${bootstrap}<p id="offline-preview-recovery">${message}</p></html>`, {headers});
}

self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(scope)) return;
  event.respondWith((async () => {
    const current = await caches.open(cacheName);
    const cache = await servingCache(event, current);
    if (request.mode === 'navigate') {
      const response = await cache.match(urlFor('index.html'), ignoreVary);
      return cache === current ? response || fetch(request) : legacyPreview(response);
    }
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
