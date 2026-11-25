/* Cache names are scoped by registration path; updates preserve unrelated applications. */
const prefix = `life-museum-${new URL(self.registration.scope).pathname}-`;
const cacheName = `${prefix}__BUILD_REVISION__`;
const urlFor = file => new URL(file, self.registration.scope).href;
let manifest;
async function files() {
  if (!manifest) {
    const response = await fetch(urlFor('offline-manifest.json'), { cache: 'no-cache' });
    if (!response.ok) throw new Error('Offline manifest unavailable');
    manifest = await response.json();
  }
  return manifest;
}
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(cacheName);
  const list = await files();
  // App shell, all code and knowledge are available after the first successful visit.
  await cache.addAll(list.filter(file => !file.startsWith('models/') && !file.startsWith('draco/')).map(urlFor));
  await cache.add(urlFor('offline-manifest.json'));
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith(prefix) && key !== cacheName) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    // Every URL here is a same-origin museum asset. Preview/static hosts can set
    // Vary: Origin even though these files are identical for module and cache.add requests.
    if (request.mode === 'navigate') return (await cache.match(urlFor('index.html'), { ignoreVary: true })) || fetch(request);
    const cached = await cache.match(request, { ignoreVary: true }); if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && (url.pathname.includes('/assets/') || url.pathname.includes('/models/') || url.pathname.includes('/draco/'))) await cache.put(request, response.clone());
    return response;
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_ALL') return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(cacheName), list = await files(); let completed = 0;
      const progress = () => event.data.progress && event.ports[0]?.postMessage({type:'progress',completed,total:list.length});
      progress();
      for (const file of list) { const url = urlFor(file); if (!(await cache.match(url, { ignoreVary: true }))) await cache.add(url); completed++; progress(); }
      event.ports[0]?.postMessage({ ok: true });
    }
    catch { event.ports[0]?.postMessage({ ok: false }); }
  })());
});
