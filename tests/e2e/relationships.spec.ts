import { test, expect, type Page } from '@playwright/test';
import { relationships } from '../../src/content/relationships';
const snapshot = (page: Page) => page.evaluate(async () => {
 const db = await new Promise<IDBDatabase>((resolve,reject) => {const r=indexedDB.open('life-museum',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const saved=await new Promise<unknown>((resolve,reject)=>{const r=db.transaction('progress').objectStore('progress').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();
 return { memory: (window as unknown as {__lifeDiagnostics:()=>unknown}).__lifeDiagnostics(), local:localStorage.getItem('life-museum-save-v1'), indexed:saved };
});
test('keyboard graph expands archives and read-only exhibit returns to archive with all ledgers unchanged', async ({page}) => {
 await page.goto('/#relationships'); await expect(page.locator('[data-epoch]')).toHaveCount(8);
 const before=await snapshot(page); const epoch=page.locator('[data-epoch="1"]');await epoch.focus();await page.keyboard.press('Enter');
 const archive=page.locator('[data-archive]').first();await archive.focus();await page.keyboard.press('Enter');await expect(archive).toHaveAttribute('aria-pressed','true');
 await page.locator('#relationship-open').focus();await page.keyboard.press('Enter');await expect(page.locator('dialog')).toBeVisible();
 await expect(page.locator('#mark-read')).toBeDisabled();await expect(page.locator('#collect-species')).toBeDisabled();await expect(page.locator('#specimen-lab')).toBeDisabled();
 await page.locator('#compare-model').click();await expect(page.locator('#size-comparison')).toBeVisible();
 // Synthetic events also cannot cross the read-only boundary.
 await page.evaluate(()=>['mark-read','collect-species','specimen-lab'].forEach(id=>document.getElementById(id)!.dispatchEvent(new Event('click'))));
 await page.keyboard.press('Escape');await expect(archive).toBeFocused();expect(await snapshot(page)).toEqual(before);
 await page.screenshot({path:'evidence/relationships-desktop.png',fullPage:true});
 await epoch.click();await expect(page.locator('#relationship-open')).toHaveCount(0);await expect(epoch).toBeFocused();
});
test('list exposes all 48 archives and opens each matching exhibit without persistence',async({page})=>{
 await page.goto('/#relationships');await page.getByRole('button',{name:'分组列表',exact:true}).click();const before=await snapshot(page);
 for(const group of relationships){await page.locator(`[data-epoch="${group.chapter.id}"]`).click();for(const card of group.species){await page.locator(`[data-archive="${card.id}"]`).click();await page.locator('#relationship-open').click();await expect(page.locator('dialog h2')).toHaveText(card.name);await page.keyboard.press('Escape');await expect(page.locator(`[data-archive="${card.id}"]`)).toBeFocused();}}
 expect(await snapshot(page)).toEqual(before);
});
for(const width of [390,320]) test(`narrow ${width}px defaults to usable list with no overflow and reduced motion`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.goto('/#relationships');await expect(page.locator('[data-view="list"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('[data-epoch="1"]').click();await page.locator('[data-archive]').first().click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.locator('.relationship-archive').first().evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
 await page.screenshot({path:`evidence/relationships-${width}.png`,fullPage:true});
 await page.locator('#relationship-open').click();await page.keyboard.press('Escape');await expect(page.locator('[data-archive]').first()).toBeFocused();
});
test.describe('forced network failure',()=>{
test.use({serviceWorkers:'block'});
test('relationship exhibit recovers its model after fallback without writing learning progress',async({page})=>{
 await page.route('**/models/manifest.json',r=>r.abort());await page.goto('/#relationships');await page.getByRole('button',{name:'分组列表',exact:true}).click();
 const card=relationships.flatMap(g=>g.species).find(s=>s.id==='archaeopteryx')!;await page.locator(`[data-epoch="${card.chapter}"]`).click();await page.locator(`[data-archive="${card.id}"]`).click();const before=await snapshot(page);await page.locator('#relationship-open').click();
 await expect(page.locator('#model-stage')).toHaveAttribute('data-state','fallback');await page.unroute('**/models/manifest.json');await page.locator('#retry-model').click();await expect(page.locator('#model-stage')).toHaveAttribute('data-state','loaded');
 await page.screenshot({path:'evidence/relationships-model-restored.png',fullPage:true});await page.keyboard.press('Escape');expect(await snapshot(page)).toEqual(before);
});
});
test('prepared production cache supports relationship list and exhibit after offline refresh',async({page,context})=>{
 test.setTimeout(120000);await page.goto('/#relationships');await page.evaluate(async()=>{await navigator.serviceWorker.ready});await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 await page.locator('#settings').click();await page.locator('#cache-offline').click();await expect(page.locator('#offline-status')).toContainText('展馆、知识卡与本地模型已缓存',{timeout:60000});await page.keyboard.press('Escape');
 await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'分组列表',exact:true}).click();await page.locator('[data-epoch="1"]').click();await page.locator('[data-archive]').first().click();const before=await snapshot(page);await page.locator('#relationship-open').click();await page.locator('#compare-model').click();await expect(page.locator('#size-comparison')).toBeVisible();await page.keyboard.press('Escape');expect(await snapshot(page)).toEqual(before);await context.setOffline(false);
});
