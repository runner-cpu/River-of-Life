import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { inquiries } from '../../src/content/inquiries';

const saveKey='life-museum-save-v1';

test('evidence inquiry opens a real exhibit, records reasoning and exports without changing the personal save',async({page})=>{
  await page.goto('/');await page.locator('[data-open-species="cyanobacteria"]').click();await page.locator('.close-modal').click();
  const before=await page.evaluate(key=>localStorage.getItem(key),saveKey);
  await page.locator('#start-inquiry').click();await page.locator('[data-inquiry="feathers-and-evidence"]').click();
  await page.locator('input[value="2"]').check();await page.locator('.inquiry-question button[type="submit"]').click();
  await expect(page.locator('#inquiry-continue')).toBeDisabled();await page.locator('#inquiry-model').click();
  const exhibit=page.getByRole('dialog',{name:'始祖鸟',exact:true});await expect(exhibit.locator('#model-stage')).toHaveAttribute('data-state','loaded');
  await expect(exhibit.locator('.sources')).toContainText('核对范围');await exhibit.locator('#mark-read').click();await exhibit.locator('.close-modal').click();
  await expect(page.locator('#inquiry-model')).toBeFocused();await page.locator('#inquiry-continue').click();
  await page.locator('input[value="2"]').check();await page.locator('.inquiry-question button[type="submit"]').click();
  await page.locator('input[value="0"]').check();await page.locator('.inquiry-question button[type="submit"]').click();
  await expect(page.locator('.inquiry-review')).toContainText('与本活动参考解释一致');
  await page.locator('#inquiry-explanation').fill('<script>test</script>羽毛不能代替多项特征比较。');
  await expect(page.locator('#inquiry-character-count')).toHaveText(`${'<script>test</script>羽毛不能代替多项特征比较。'.length} / 1200`);
  const downloadPromise=page.waitForEvent('download');await page.locator('#inquiry-export').click();const download=await downloadPromise;
  const html=readFileSync((await download.path())!,'utf8');expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>');
  expect(html).toContain('不是标准化测验');expect(html).toContain(inquiries[0].source.url);
  await page.screenshot({path:'evidence/competition-inquiry-result.png'});await page.locator('#inquiry-finish').click();
  expect(await page.evaluate(key=>localStorage.getItem(key),saveKey)).toBe(before);await expect(page.locator('#start-inquiry')).toBeFocused();
});

test('all inquiry topics support a complete text route at a phone viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  const before=await page.evaluate(key=>localStorage.getItem(key),saveKey);
  for(const activity of inquiries){
    await page.locator('#start-inquiry').click();await page.locator(`[data-inquiry="${activity.id}"]`).click();
    await page.locator(`input[value="${activity.initial.correct}"]`).check();await page.locator('.inquiry-question button[type="submit"]').click();
    await page.locator('#inquiry-text').click();await page.locator('#inquiry-continue').click();
    await page.locator(`input[value="${activity.evidence.correct}"]`).check();await page.locator('.inquiry-question button[type="submit"]').click();
    await page.locator(`input[value="${activity.transfer.correct}"]`).check();await page.locator('.inquiry-question button[type="submit"]').click();
    const overflow=await page.locator('.inquiry-dialog .modal-body').evaluate(el=>el.scrollWidth>el.clientWidth+1);expect(overflow).toBe(false);
    await expect(page.locator('#inquiry-export')).toBeVisible();await page.locator('#inquiry-finish').click();
  }
  expect(await page.evaluate(key=>localStorage.getItem(key),saveKey)).toBe(before);
});

test('controlled experiment preserves its run conditions, exports all generations and matches identical environments',async({page})=>{
  await page.goto('/#lab');await page.locator('#run-comparison').click();await expect(page.locator('#comparison-feedback')).toContainText('先记录');
  await page.locator('#comparison-prediction').selectOption('higher');await page.locator('#run-comparison').click();
  await expect(page.locator('.comparison-legend')).toContainText('干旱 75%');await expect(page.locator('.comparison-record')).toContainText('20261025');
  await page.locator('#comparison-seed').fill('20261026');await expect(page.locator('#comparison-pending')).toBeVisible();
  await expect(page.locator('.comparison-record')).toContainText('20261025');
  await page.locator('#comparison-seed').fill('20261025');await expect(page.locator('#comparison-pending')).toBeHidden();
  await page.locator('#comparison-prediction').selectOption('lower');await expect(page.locator('#comparison-pending')).toBeVisible();
  await page.locator('#comparison-prediction').selectOption('higher');await expect(page.locator('#comparison-pending')).toBeHidden();
  await page.locator('.comparison-table summary').click();await expect(page.locator('.comparison-table tbody tr')).toHaveCount(31);
  const downloadPromise=page.waitForEvent('download');await page.locator('#export-comparison').click();
  const csv=readFileSync((await (await downloadPromise).path())!,'utf8');expect(csv.trim().split('\n')).toHaveLength(32);expect(csv).toContain(',20261025,0,0.75,0.2,0.003,100');
  await page.locator('#drought').focus();await page.keyboard.press('Home');await expect(page.locator('#drought-value')).toHaveText('0%');
  await expect(page.locator('.comparison-legend')).toContainText('干旱 75%');
  await expect(page.locator('#comparison-current')).toContainText('实验组干旱 0%');
  await expect(page.locator('#comparison-pending')).toBeVisible();
  await page.locator('#comparison-prediction').selectOption('same');await page.locator('#run-comparison').click();
  await expect(page.locator('#comparison-pending')).toBeHidden();
  await expect(page.locator('.comparison-result-heading')).toContainText('相差 0 个百分点');
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('phone experiment navigation reaches each section without changing route or simulation',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/#lab');
  for(const target of ['lab-comparison','lab-environment','lab-observation']){
    await page.locator(`[data-lab-target="${target}"]`).click();
    await expect(page.locator(`#${target}`)).toBeFocused();
    // The final section can stop above the page bottom before reaching the top edge.
    await expect.poll(()=>page.locator(`#${target}`).evaluate(el=>{const top=el.getBoundingClientRect().top;return top>=0&&top<innerHeight/2;})).toBe(true);
    await expect(page).toHaveURL(/#lab$/);
  }
  await expect(page.locator('#generation')).toHaveText('0');
});

test('phone specimen scroll keeps close visible and restores the catalog position and focus',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/#codex');
  const card=page.locator('[data-codex-id="stromatolites"]');await card.scrollIntoViewIfNeeded();
  const pagePosition=await page.evaluate(()=>scrollY);await card.click();
  const head=page.locator('dialog .modal-head'),body=page.locator('dialog .modal-body');
  const headerTop=await head.evaluate(el=>el.getBoundingClientRect().top);
  await body.hover();await page.mouse.wheel(0,800);
  await expect.poll(()=>body.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  expect(await head.evaluate(el=>el.getBoundingClientRect().top)).toBeCloseTo(headerTop,0);
  await expect(page.locator('dialog .close-modal')).toBeInViewport();
  expect(await page.evaluate(()=>scrollY)).toBe(pagePosition);
  await page.locator('dialog .close-modal').click();await expect(card).toBeFocused();
  expect(await page.evaluate(()=>scrollY)).toBe(pagePosition);
});
