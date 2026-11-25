import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { renderServiceWorker } from '../../scripts/build-identity';

const template = readFileSync('public/sw.js', 'utf8');
function release(version: 'A' | 'B') {
  const assets = {
    'index.html': `<!doctype html><title>Museum ${version}</title><main>${version}</main>`,
    [`assets/lazy-${version}.js`]: `export default '${version} chunk';`,
    'models/shared.glb': `${version} model`,
  };
  const hashes = Object.fromEntries(Object.entries(assets).map(([name, text]) => [name, createHash('sha256').update(text).digest('hex')]));
  const revision = createHash('sha256').update(JSON.stringify(hashes)).digest('hex').slice(0, 12);
  return {revision, responses: new Map(Object.entries({...assets,
    'offline-manifest.json': JSON.stringify(Object.keys(assets)), 'sw.js': renderServiceWorker(template, revision, hashes),
  }))};
}

async function serveMuseum() {
  const versions = {A: release('A'), B: release('B')};
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
