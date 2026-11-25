import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { renderServiceWorker } from '../../scripts/build-identity';

import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import type { GameStore } from '../../src/core/store';
import { species } from '../../src/content/species';

const template = readFileSync('public/sw.js', 'utf8');
// Verbatim predecessor sources are checked in so this regression also runs from
// a shallow checkout. The test page calls its real GameStore actions and export.
const predecessor = (file: string) => readFileSync(`tests/fixtures/offline-273e731/${file}.txt`, 'utf8');
function persistentApp(version: 'A' | 'B'): Record<string,string> {
  const current = version === 'B';
  const modules: Record<string,string> = {};
  for (const [name, path] of Object.entries({store:'core/store', persistence:'core/persistence', 'inquiry-badges':'content/inquiry-badges', ...(current ? {'progress-access':'core/progress-access'} : {})})) {
    const source = current ? readFileSync(`src/${path}.ts`, 'utf8') : predecessor(`${name}.ts`);
    modules[`assets/${version}/${name}.js`] = transpileModule(source, {compilerOptions:{module:ModuleKind.ESNext, target:ScriptTarget.ES2022}}).outputText
      .replace("'../content/inquiry-badges'", "'./inquiry-badges.js'").replace("'./persistence'", "'./persistence.js'");
  }
  modules[`assets/${version}/app.js`] = `import {GameStore} from './store.js';
    ${current ? "import {createProgressAccess} from './progress-access.js'; const access=createProgressAccess(); await access.acquire(); addEventListener('pagehide',()=>access.release());" : ''}
    const store = new GameStore(${JSON.stringify(species.filter(s=>s.chapter===1).slice(0,4))}, []${current ? ',{canWrite:()=>access.writable}' : ''});
    await store.init(); window.testStore = store; document.querySelector('main').textContent = '${version}';`;
  return modules;
}
function release(version: 'A' | 'B', persistent: boolean) {
  const assets = {
    'index.html': `<!doctype html><meta charset="utf-8"><title>Museum ${version}</title><main>${persistent ? '' : version}</main>${persistent ? `<script type="module" src="assets/${version}/app.js"></script>` : ''}`,
    [`assets/lazy-${version}.js`]: `export default '${version} chunk';`,
    'models/shared.glb': `${version} model`,
    ...(persistent ? persistentApp(version) : {}),
  };
  const hashes = Object.fromEntries(Object.entries(assets).map(([name, text]) => [name, createHash('sha256').update(text).digest('hex')]));
  const revision = createHash('sha256').update(JSON.stringify(hashes)).digest('hex').slice(0, 12);
  return {revision, responses: new Map(Object.entries({...assets,
    'offline-manifest.json': JSON.stringify(Object.keys(assets)), 'sw.js': renderServiceWorker(persistent && version === 'A' ? predecessor('sw.js') : template, revision, hashes),
  }))};
}

async function serveMuseum(persistent = false) {
  const versions = {A: release('A', persistent), B: release('B', persistent)};
  const state = {current: 'A' as 'A' | 'B', online: true, serveOldModel: false};
  const server = createServer((req, res) => {
    if (req.url === '/observer') {res.writeHead(200, {'Content-Type':'text/html'}); res.end('<title>Observer</title>'); return;}
    const path = (req.url || '/').slice('/museum/'.length) || 'index.html';
    const version = state.serveOldModel && path === 'models/shared.glb' ? 'A' : state.current;
    const text = versions[version].responses.get(path);
    if (!state.online || text === undefined) {res.writeHead(state.online ? 404 : 503); res.end(); return;}
    const type = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.html') ? 'text/html' : path.endsWith('.json') ? 'application/json' : 'model/gltf-binary';
    res.writeHead(200, {'Content-Type': type, 'Cache-Control':'no-store'}); res.end(text);
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address(); if (!address || typeof address === 'string') throw Error('Museum test server failed to bind');
  return {state, versions, origin:`http://127.0.0.1:${address.port}/museum/`, close: () => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve()); server.closeAllConnections();
  })};
}
function prepare(page: Page) {
  return page.evaluate(async () => {
    const active = (await navigator.serviceWorker.ready).active!;
    return new Promise<boolean>(resolve => {
      const channel = new MessageChannel();
      channel.port1.onmessage = ({data}) => {if (typeof data?.ok === 'boolean') {channel.port1.close(); resolve(data.ok);}};
      active.postMessage({type:'CACHE_ALL', progress:true}, [channel.port2]);
    });
  });
}
const model = (page: Page) => page.evaluate(async () => (await fetch('models/shared.glb')).text());

for (const late of [false, true]) {
  test(late ? 'late A preparation survives offline activation and B recovers on the next navigation' : 'complete A stays usable while B waits, then B activates with fresh offline model bytes', async ({context, page}) => {
    const museum = await serveMuseum();
    try {
      await page.goto(museum.origin);
      await page.evaluate(async () => {await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready;});
      await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
      if (!late) expect(await prepare(page)).toBe(true);
      museum.state.current = 'B';
      await page.evaluate(async () => {await (await navigator.serviceWorker.ready).update();});
      await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).waiting?.state)).toBe('installed');
      if (late) {
        // Exercise A finishing an outstanding model download after B is already waiting.
        museum.state.serveOldModel = true;
        expect(await prepare(page)).toBe(true); museum.state.serveOldModel = false;
      }
      const observer = await context.newPage();
      await observer.goto(new URL('../observer', museum.origin).href);
      museum.state.online = false;
      await context.setOffline(true);
      await expect(page.locator('main')).toHaveText('A');
      expect(await page.evaluate(async () => (await import(/* @vite-ignore */ new URL('assets/lazy-A.js', location.href).href)).default)).toBe('A chunk');
      expect(await model(page)).toBe('A model');
      // The same-origin observer can watch activation without keeping a scoped A client alive.
      await page.close();
      await expect.poll(() => observer.evaluate(async url => {
        const registration = await navigator.serviceWorker.getRegistration(url);
        return registration?.active?.state === 'activated' && !registration.waiting;
      }, museum.origin)).toBe(true);
      await observer.goto(museum.origin);
      await expect(observer.locator('main')).toHaveText(late ? 'A' : 'B');
      expect(await model(observer)).toBe(late ? 'A model' : 'B model');
      if (late) {
        await context.setOffline(false); museum.state.online = true;
        expect(await prepare(observer)).toBe(true);
        await context.setOffline(true); museum.state.online = false;
        const next = await context.newPage(); await next.goto(museum.origin);
        await expect(next.locator('main')).toHaveText('B'); expect(await model(next)).toBe('B model');
        expect(await model(observer)).toBe('A model');
      }
    } finally {await museum.close();}
  });
}

declare global { interface Window { testStore: GameStore } }
async function replicas(observer: Page) {
  return observer.evaluate(async () => {
    const local = localStorage.getItem('life-museum-save-v1');
    const database = await new Promise<unknown>((resolve,reject) => {
      const req = indexedDB.open('life-museum', 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result, read = db.transaction('progress').objectStore('progress').get('current');
        read.onsuccess = () => {db.close(); resolve(read.result);}; read.onerror = () => reject(read.error);
      };
    });
    return {local, database};
  });
}

test('legacy fallback A/A and A/B sessions preserve both real progress replicas and hand over to a new writer', async ({context,page}) => {
  const museum = await serveMuseum(true);
  try {
    await page.goto(museum.origin); await expect(page.locator('main')).toHaveText('A');
    await page.evaluate(async () => {await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready;});
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    const [first, second, third] = species.filter(s => s.chapter === 1).map(s => s.id);
    await page.evaluate(id => window.testStore.observe(id), first);
    const observer = await context.newPage(); await observer.goto(new URL('../observer', museum.origin).href);
    const seed = await replicas(observer); expect(seed.database).toEqual(JSON.parse(seed.local!));
    museum.state.current = 'B'; await page.evaluate(async () => {await (await navigator.serviceWorker.ready).update();});
    await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).waiting?.state)).toBe('installed');
    museum.state.serveOldModel = true; expect(await prepare(page)).toBe(true); museum.state.serveOldModel = false;
    await page.close();
    await expect.poll(() => observer.evaluate(async url => {
      const reg = await navigator.serviceWorker.getRegistration(url); return reg?.active?.state === 'activated' && !reg.waiting;
    }, museum.origin)).toBe(true);
    museum.state.online = false; await context.setOffline(true);
    // An A preview on an empty origin can practice without creating the database.
    await observer.evaluate(() => new Promise<void>((resolve,reject) => {
      const req = indexedDB.deleteDatabase('life-museum'); req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
    }));
    const empty = await context.newPage(); await empty.goto(museum.origin); await expect(empty.locator('main')).toHaveText('A');
    expect(JSON.parse(await empty.evaluate(()=>window.testStore.export()))).toEqual(seed.database); // local-only copy
    await empty.evaluate(()=>window.testStore.reset()); await empty.close();
    expect(await observer.evaluate(async () => (await indexedDB.databases()).map(db=>db.name))).not.toContain('life-museum');
    await observer.evaluate(record => new Promise<void>((resolve,reject) => {
      const req = indexedDB.open('life-museum',1); req.onupgradeneeded = () => req.result.createObjectStore('progress');
      req.onsuccess = () => {const db=req.result, tx=db.transaction('progress','readwrite'); tx.objectStore('progress').put(record,'current');
        tx.oncomplete=()=>{db.close();resolve();}; tx.onabort=()=>reject(tx.error);}; req.onerror=()=>reject(req.error);
    }),seed.database);
    // The legacy module and its imports must resolve relative URLs from the cached A release.
    // Force the first preview to read its only good copy from IndexedDB.
    await observer.evaluate(() => localStorage.removeItem('life-museum-save-v1'));
    const a1 = await context.newPage(); await a1.goto(museum.origin); await expect(a1.locator('main')).toHaveText('A');
    expect(JSON.parse(await a1.evaluate(() => window.testStore.export()))).toEqual(seed.database);
    await observer.evaluate(raw => localStorage.setItem('life-museum-save-v1', raw!), seed.local);
    const a2 = await context.newPage(); await a2.goto(museum.origin); await expect(a2.locator('main')).toHaveText('A');
    await a1.evaluate(id => window.testStore.observe(id), second);
    await a2.evaluate(() => { window.testStore.reset(); window.testStore.settings({sound:true}); });
    expect(await a1.evaluate(()=>window.testStore.state.observed)).toEqual([first,second]);
    expect(await a2.evaluate(()=>window.testStore.state.observed)).toEqual([]);
    expect(await replicas(observer)).toEqual(seed);
    await a2.evaluate(()=>{const dialog=document.createElement('dialog'); document.body.append(dialog); dialog.showModal();});
    await expect(a2.locator('dialog')).toContainText('不会保存个人进度');
    const blocked = await context.newPage();
    await blocked.addInitScript(() => Object.defineProperty(window,'localStorage',{value:window.localStorage, configurable:false}));
    await blocked.goto(museum.origin); await expect(blocked.locator('body')).toContainText('无法打开旧版离线预览');
    expect(await blocked.evaluate(()=>typeof window.testStore)).toBe('undefined'); await blocked.close();
    expect(await prepare(a1)).toBe(false);
    museum.state.online = true; await context.setOffline(false); expect(await prepare(a1)).toBe(true);
    museum.state.online = false; await context.setOffline(true);
    const b = await context.newPage(); await b.goto(museum.origin); await expect(b.locator('main')).toHaveText('B');
    await b.evaluate(id=>window.testStore.observe(id),third);
    const latest = await replicas(observer); expect(JSON.parse(latest.local!).observed).toEqual([first,third]);
    expect(latest.database).toEqual(JSON.parse(latest.local!));
    await a1.evaluate(raw=>{
      addEventListener('pagehide',()=>window.testStore.reset(),{once:true});
      dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
      dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})); window.testStore.import(raw!);
    },seed.local);
    await a2.evaluate(id=>window.testStore.observe(id),second); expect(await replicas(observer)).toEqual(latest);
    await Promise.all([a1.close(), a2.close(), b.close()]);
    const next = await context.newPage(); await next.goto(museum.origin); await expect(next.locator('main')).toHaveText('B');
    expect(JSON.parse(await next.evaluate(()=>window.testStore.export()))).toEqual(latest.database);
    await next.evaluate(id=>window.testStore.observe(id),second);
    const final = await replicas(observer); expect(JSON.parse(final.local!).observed).toEqual([first,third,second]);
    expect(final.database).toEqual(JSON.parse(final.local!));
  } finally {await museum.close();}
});
