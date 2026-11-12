import { test, expect, type Page } from '@playwright/test';
const key = 'life-museum-save-v1';
const saved = (page: Page) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), key);
async function complete(page: Page, more = true) {
  await page.locator('[data-inquiry="feathers-and-evidence"]').click();
  await page.locator('input[value="2"]').check(); await page.locator('.inquiry-question button[type="submit"]').click();
  await page.locator('#inquiry-text').click(); await page.locator('#inquiry-continue').click();
  await page.locator('[data-category="support"]').nth(0).click();
  await page.locator(`[data-category="${more ? 'more-information' : 'support'}"]`).nth(1).click();
  await page.locator('#inquiry-show-graph').click(); await page.locator('#inquiry-transfer').click();
  await page.locator('input[value="0"]').check(); await page.locator('.inquiry-question button[type="submit"]').click();
}
test('personal export awards once after download initiation; failure and classroom stay isolated', async ({page}) => {
  await page.goto('/'); await page.locator('[data-open-species="cyanobacteria"]').click(); await page.locator('.close-modal').click();
  const before = await saved(page);
  await page.locator('#start-inquiry').click(); await complete(page);
  expect(await saved(page)).toEqual(before);
  await page.evaluate(() => { (window as any).originalCreate = URL.createObjectURL; URL.createObjectURL = () => { throw Error('download unavailable'); }; });
  await page.locator('#inquiry-export-json').click(); expect(await saved(page)).toEqual(before);
  await page.evaluate(() => { URL.createObjectURL = (window as any).originalCreate; });
  for (const selector of ['#inquiry-export-json','#inquiry-export']) {
    const download = page.waitForEvent('download'); await page.locator(selector).click(); await download;
  }
  const after = await saved(page); expect(after.badges).toEqual(['inquiry-reserved-judgment']);
  expect({...after,badges:before.badges,updatedAt:before.updatedAt}).toEqual(before);
  for (const width of [1440,390,320]) { await page.setViewportSize({width,height:844}); await page.screenshot({path:`evidence/task6-inquiry-${width}.png`}); expect(await page.locator('.inquiry-dialog .modal-body').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true); }
  await page.reload(); expect((await saved(page)).badges).toEqual(['inquiry-reserved-judgment']);
});
test('changed seed requires actual rerun and explicit nonempty run note; duplicate awards leave economy unchanged', async ({page}) => {
  await page.goto('/#lab'); await page.locator('#comparison-prediction').selectOption('higher');
  await page.locator('#run-comparison').click();
  await page.locator('#comparison-note').fill('first'); await page.locator('#save-comparison-note').click(); expect(await saved(page)).toBeNull();
  await page.locator('#run-comparison').click(); await page.locator('#comparison-note').fill('same seed'); await page.locator('#save-comparison-note').click(); expect(await saved(page)).toBeNull();
  await page.locator('#comparison-seed').fill('42'); await page.locator('#save-comparison-note').click(); expect(await saved(page)).toBeNull();
  await page.locator('#run-comparison').click(); await page.locator('#save-comparison-note').click(); expect(await saved(page)).toBeNull();
  await page.locator('#comparison-note').fill('换种子后，比较这次曲线与上一次的差异。'); await page.locator('#save-comparison-note').focus(); await page.keyboard.press('Enter');
  const after = await saved(page); expect(after.badges).toEqual(['inquiry-reproduction']); expect(after.points).toBe(0); expect(after.totalEarned).toBe(0); expect(JSON.stringify(after)).not.toContain('换种子后');
  await page.locator('#save-comparison-note').click(); expect(await saved(page)).toEqual(after);
  for (const width of [1440,390,320]) { await page.setViewportSize({width,height:844}); await page.locator('#comparison-note').scrollIntoViewIfNeeded(); await page.screenshot({path:`evidence/task6-lab-${width}.png`}); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true); }
  await expect(page.locator('#comparison-saved-note')).toContainText('换种子后');
  await page.locator('#comparison-note').fill('尚未保存的编辑');
  await expect(page.locator('#comparison-saved-note')).not.toContainText('尚未保存的编辑');
  expect(await saved(page)).toEqual(after);
  await page.locator('#comparison-seed').fill('43'); await page.locator('#run-comparison').click();
  await expect(page.locator('#comparison-note')).toHaveValue(''); await expect(page.locator('#comparison-saved-note')).toBeHidden();
  await page.reload(); expect((await saved(page)).badges).toEqual(['inquiry-reproduction']);
});

test('classroom and personal exports without reserved judgment never create a badge', async ({page}) => {
  await page.goto('/'); await page.locator('#classroom').click(); await page.locator('#classroom-inquiry').click(); await complete(page);
  const download = page.waitForEvent('download'); await page.locator('#inquiry-export-json').click(); await download;
  expect(await saved(page)).toBeNull(); await page.locator('#inquiry-finish').click();
  await page.locator('#start-inquiry').click(); await complete(page,false);
  const second = page.waitForEvent('download'); await page.locator('#inquiry-export').click(); await second;
  expect(await saved(page)).toBeNull();
});
test('legacy import migrates without awards and invalid import preserves current progress', async ({page}) => {
  await page.goto('/'); await page.locator('[data-open-species="cyanobacteria"]').click(); await page.locator('.close-modal').click();
  const before = await saved(page), legacy = {...before,version:1,badges:['legacy','inquiry-reproduction']};
  await page.locator('#settings').click();
  await page.locator('#import-save').setInputFiles({name:'v1.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
  await expect.poll(async()=>(await saved(page)).badges).toEqual(['legacy']);
  const migrated = await saved(page); expect(migrated.version).toBe(2); expect(migrated.points).toBe(before.points);
  await page.locator('#settings').click();
  await page.locator('#import-save').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...legacy,totalEarned:999}))});
  await expect(page.locator('#toasts')).toContainText('不一致'); expect(await saved(page)).toEqual(migrated);
  await page.reload(); expect((await saved(page)).badges).toEqual(['legacy']);
});

test('profile displays both stable badge IDs as neutral readable labels', async ({page}) => {
  await page.goto('/#lab'); await page.locator('#comparison-prediction').selectOption('higher'); await page.locator('#run-comparison').click();
  await page.locator('#comparison-seed').fill('42'); await page.locator('#run-comparison').click(); await page.locator('#comparison-note').fill('记录这一次重跑。'); await page.locator('#save-comparison-note').click();
  await page.locator('[data-mode="journey"]').click(); await page.locator('#start-inquiry').click(); await complete(page);
  const download=page.waitForEvent('download'); await page.locator('#inquiry-export-json').click(); await download; await page.locator('#inquiry-finish').click();
  await page.locator('#profile').click();
  await expect(page.locator('.badge-list')).toContainText('保留判断：你记录了一次保留判断');
  await expect(page.locator('.badge-list')).toContainText('复现意识：你记录了一次换种子重跑与备注');
  for (const width of [1440,390,320]) { await page.setViewportSize({width,height:844}); await page.screenshot({path:`evidence/task6-profile-${width}.png`}); expect(await page.locator('dialog .modal-body').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true); }
});
