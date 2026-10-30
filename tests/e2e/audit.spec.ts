import { test, expect, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
// Fault injection must reach the network rather than a service-worker cache.
test.use({serviceWorkers:'block'});

const saveKey='life-museum-save-v1';
const navigate=async(page:Page,mode:string)=>{
  const menu=page.getByRole('button',{name:'打开导航',exact:true});if(await menu.isVisible())await menu.click();
  await page.locator(`[data-mode="${mode}"]`).click();
};

test('mobile navigation hides closed links, traps focus, restores focus and releases the page',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  const trigger=page.locator('.mobile-menu');
  await expect(page.locator('.sidebar')).toHaveAttribute('inert','');
  await trigger.click();await expect(trigger).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('.app-body')).toHaveAttribute('inert','');
  await page.locator('#settings').focus();await page.keyboard.press('Tab');await expect(page.locator('.drawer-close')).toBeFocused();
  await page.keyboard.press('Shift+Tab');await expect(page.locator('#settings')).toBeFocused();
  await page.keyboard.press('Escape');await expect(trigger).toBeFocused();await expect(trigger).toHaveAttribute('aria-expanded','false');
  await trigger.click();await page.locator('[data-mode="codex"]').click();
  await expect(page.locator('#main-content')).toBeFocused();await expect(page.locator('.app-body')).not.toHaveAttribute('inert');
  await expect(page.locator('.sidebar')).toHaveAttribute('inert','');
});

test('codex filters retain keyboard focus and quiz tabs support arrow navigation',async({page})=>{
  await page.goto('/');await navigate(page,'codex');
  await page.locator('[data-filter="collected"]').click();
  await expect(page.locator('[data-filter="collected"]')).toBeFocused();
  await expect(page.locator('[data-filter="collected"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#codex-results')).toHaveText('找到 0 个生命档案');
  await page.locator('#clear-filters').click();await page.locator('#codex-search').fill('始祖鸟');
  await expect(page.locator('#codex-results')).toHaveText('找到 1 个生命档案');
  await page.locator('#codex-chapter').selectOption('1');
  await expect(page.locator('#codex-results')).toHaveText('找到 0 个生命档案');
  await page.locator('#reset-codex-filters').click();
  await expect(page.locator('#codex-search')).toHaveValue('');
  await expect(page.locator('#codex-search')).toBeFocused();
  await expect(page.locator('#codex-chapter')).toHaveValue('0');
  await expect(page.locator('#codex-results')).toHaveText('找到 48 个生命档案');
  await expect(page.locator('#reset-codex-filters')).toBeHidden();
  await navigate(page,'quiz');await page.locator('[data-kind="quick"]').focus();await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-kind="timeline"]')).toBeFocused();await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby','quiz-tab-timeline');
  await page.keyboard.press('End');await expect(page.locator('[data-kind="mistakes"]')).toBeFocused();
  await page.keyboard.press('Home');await expect(page.locator('[data-kind="quick"]')).toBeFocused();
});

test('failed external model uses honest fallback credit and can be retried',async({page})=>{
  await page.route('**/models/archaeopteryx.glb',route=>route.abort());
  await page.goto('/');await navigate(page,'codex');await page.locator('[data-codex-id="archaeopteryx"]').click();
  await expect(page.locator('#model-stage')).toHaveAttribute('data-state','fallback');
  await expect(page.locator('#representation')).toHaveText('原创结构示意');
  await expect(page.locator('#model-credit')).toContainText('当前展示原创结构示意');
  await expect(page.locator('#model-credit')).not.toContainText('Smithsonian');
  await expect(page.locator('#model-stage canvas')).toBeVisible();
  await page.screenshot({path:'evidence/audit-model-fallback.png'});
  await page.unroute('**/models/archaeopteryx.glb');await page.locator('#retry-model').click();
  await expect(page.locator('#model-stage')).toHaveAttribute('data-state','loaded');
  await expect(page.locator('#representation')).toContainText('3D 扫描');await expect(page.locator('#model-credit')).toContainText('Smithsonian');
  await expect(page.locator('#model-load-notice')).toBeHidden();
});

test('reset requires a second decision and keyboard import rejects oversized files without changes',async({page})=>{
  await page.goto('/');await page.locator('[data-open-species="cyanobacteria"]').click();await page.locator('#mark-read').click();await page.locator('.close-modal').click();
  const before=await page.evaluate(key=>localStorage.getItem(key),saveKey);
  await page.locator('#settings').click();await page.locator('.reset-details summary').click();await page.locator('#reset-save').click();
  await expect(page.getByRole('dialog',{name:'确认重新开始探索',exact:true})).toBeVisible();
  await expect(page.locator('#cancel-reset')).toBeFocused();await page.locator('#cancel-reset').click();
  expect(await page.evaluate(key=>localStorage.getItem(key),saveKey)).toBe(before);
  const chooserPromise=page.waitForEvent('filechooser');await page.locator('#import-save-trigger').focus();await page.keyboard.press('Enter');
  const chooser=await chooserPromise;await chooser.setFiles({name:'oversized.json',mimeType:'application/json',buffer:Buffer.alloc(250001,32)});
  await expect(page.locator('.toast-region')).toContainText('记录文件过大');
  expect(await page.evaluate(key=>localStorage.getItem(key),saveKey)).toBe(before);
});

test('paused, obscured and offscreen scenes stop rendering while controls still redraw',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:1280,height:720});await page.goto('/');
  const frames=()=>page.evaluate(()=>(window as typeof window & {__lifeDiagnostics:()=>{scene:{frames:number}}}).__lifeDiagnostics().scene.frames);
  const settled=async()=>{let previous=-1,matches=0;await expect.poll(async()=>{const current=await frames();matches=current===previous?matches+1:0;previous=current;return matches;},{intervals:[100,100,100]}).toBeGreaterThanOrEqual(3);return frames();};
  await expect.poll(frames).toBeGreaterThan(2);await page.locator('#scene-pause').click();const paused=await settled();
  await page.waitForTimeout(500);expect(await frames()).toBe(paused);
  await page.locator('#scene-zoom').click();await expect.poll(frames).toBeGreaterThan(paused);const zoomed=await settled();
  await page.locator('#scene-pause').click();await expect.poll(frames).toBeGreaterThan(zoomed);
  await page.locator('#settings').click();const obscured=await settled();await page.waitForTimeout(400);expect(await frames()).toBe(obscured);
  await page.locator('.close-modal').click();await expect.poll(frames).toBeGreaterThan(obscured);
  await page.setViewportSize({width:1280,height:520});await page.locator('.footer').scrollIntoViewIfNeeded();
  await expect(page.locator('#life-scene canvas')).not.toBeInViewport();
  const offscreen=await settled();await page.waitForTimeout(400);expect(await frames()).toBe(offscreen);
  await page.locator('#scene-pause').scrollIntoViewIfNeeded();await expect.poll(frames).toBeGreaterThan(offscreen);
  writeFileSync('evidence/audit-render-scheduling.json',JSON.stringify({paused,zoomed,obscured,offscreen,staticIntervalsMs:[500,400,400],staticIntervalsProducedZeroNewFrames:true},null,2));
});

test('small-screen species labels remain separate and inside the scene',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  const boxes=await page.locator('#life-scene .hotspot').evaluateAll(elements=>elements.filter(element=>getComputedStyle(element).visibility==='visible').map(element=>{
    const rect=element.getBoundingClientRect();return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom};
  }));
  expect(boxes.length).toBe(6);
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
    const a=boxes[i],b=boxes[j];expect(Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top))).toBe(0);
  }
  await page.screenshot({path:'evidence/audit-mobile-journey.png'});
});
