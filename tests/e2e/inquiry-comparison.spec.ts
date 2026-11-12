import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function complete(page: Page, initial = '0') {
  await page.locator('#start-inquiry').click();
  await page.locator('[data-inquiry="feathers-and-evidence"]').click();
  await page.locator(`input[value="${initial}"]`).check();
  await page.locator('.inquiry-question button[type="submit"]').click();
  await page.locator('#inquiry-text').click(); await page.locator('#inquiry-continue').click();
  for (let i = 0; i < 2; i++) await page.locator('[data-category="support"]').nth(i).click();
  await page.locator('#inquiry-show-graph').click(); await page.locator('#inquiry-transfer').click();
  await page.locator('input[value="0"]').check(); await page.locator('.inquiry-question button[type="submit"]').click();
}
async function downloadRecord(page: Page) {
  const waiting = page.waitForEvent('download');
  await page.locator('#inquiry-export-json').focus(); await page.keyboard.press('Enter');
  return (await (await waiting).path())!;
}
async function upload(page: Page, text: string, name = 'peer.json') {
  await page.locator('#inquiry-peer-file').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
}
async function progress(page: Page) {
  return page.evaluate(async () => {
    const memory = (window as unknown as { __lifeDiagnostics: () => unknown }).__lifeDiagnostics();
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('life-museum'); r.onsuccess = () => resolve(r.result); r.onerror = reject; });
    const saved = await new Promise(resolve => { const r = db.transaction('progress').objectStore('progress').get('current'); r.onsuccess = () => resolve(r.result); });
    db.close();
    return { memory: (memory as { progress: unknown }).progress, local: localStorage.getItem('life-museum-save-v1'), saved };
  });
}
for (const width of [1440, 390, 320]) {
  test(`real JSON exchange, keyboard, revisions, safe text and failed imports at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 }); await page.goto('/');
    await complete(page);
    const injection = '<img src=x onerror="window.peerInjected=true"><script>window.peerInjected=true</script>';
    await page.locator('#inquiry-explanation').fill(injection);
    const path = await downloadRecord(page);
    const original = readFileSync(path, 'utf8'); const record = JSON.parse(original);
    await page.locator('#inquiry-finish').click();
    await complete(page, '1');
    await page.locator('#inquiry-explanation').fill('我的当前解释');
    const before = await progress(page);
    await page.locator('#inquiry-peer-file').focus(); await expect(page.locator('#inquiry-peer-file')).toBeFocused();
    await page.locator('#inquiry-peer-file').setInputFiles(path);
    await expect(page.locator('#inquiry-peer-status')).toContainText('已导入');
    const columns = page.locator('.inquiry-peer-column');
    await expect(columns).toHaveCount(2); await expect(columns.nth(1)).toContainText(injection);
    expect(await columns.nth(1).locator('img, script').count()).toBe(0);
    expect(await page.evaluate(() => 'peerInjected' in window)).toBe(false);
    await expect(page.locator('.inquiry-peer-differences')).toContainText('起初的判断');
    await page.locator('#inquiry-explanation').fill('编辑后的解释');
    await expect(columns.first()).toContainText('编辑后的解释');
    await page.locator('#inquiry-revise').click();
    await page.locator('[data-category="more-information"]').first().click();
    await page.locator('#inquiry-show-graph').click(); await page.locator('#inquiry-transfer').click();
    await page.locator('input[value="0"]').check(); await page.locator('.inquiry-question button[type="submit"]').click();
    await expect(columns.nth(1)).toContainText(injection);
    await expect(page.locator('.inquiry-peer-differences')).toContainText('证据 1');
    const previous = await page.locator('#inquiry-peer-result').textContent();
    const invalid = [
      ['<html>old record</html>', 'HTML'], ['{', 'JSON'],
      [JSON.stringify({ ...record, version: 0 }), '版本'],
      [JSON.stringify({ ...record, inquiryId: 'sea-and-family' }), '主题'],
      [JSON.stringify({ ...record, phase: 'graph' }), '完成'],
      [JSON.stringify({ ...record, classifications: [{ ...record.classifications[0], cardId: 'unknown' }, record.classifications[1]] }), '卡片'],
      [' '.repeat(100001), '字符'], [' '.repeat(400001), '未读取'],
    ];
    for (const [text, error] of invalid) {
      await upload(page, text); await expect(page.locator('#inquiry-peer-status')).toContainText(error);
      await expect(page.locator('#inquiry-peer-result')).toHaveText(previous!);
      await expect(page.locator('#inquiry-explanation')).toHaveValue('编辑后的解释');
    }
    expect(await progress(page)).toEqual(before);
    const boxes = await columns.evaluateAll(elements => elements.map(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, bottom: r.bottom }; }));
    if (width < 600) expect(boxes[1].y).toBeGreaterThanOrEqual(boxes[0].bottom);
    else expect(boxes[1].x).toBeGreaterThan(boxes[0].x);
    expect(await page.locator('.modal-body').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await page.locator('.inquiry-peer').evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
    await page.locator('#inquiry-peer-result > h3').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `evidence/task5-peer-${width}.png` });
    await page.locator('.inquiry-peer-differences').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `evidence/task5-differences-${width}.png` });
    await page.locator('#inquiry-explanation').fill('我认为还要比较多条结构证据，羽毛不能单独说明分类。');
    await upload(page, JSON.stringify({ ...record, explanation: '羽毛是一条线索，还应结合牙齿、尾部与前肢一起讨论。' }));
    await expect(page.locator('#inquiry-peer-status')).toContainText('已导入');
    await page.locator('#inquiry-peer-result > h3').scrollIntoViewIfNeeded();
    await page.locator('.inquiry-peer-column h4').first().evaluate(el => el.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: `evidence/task5-teaching-peer-${width}.png` });
    await page.locator('.inquiry-peer-differences').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `evidence/task5-teaching-differences-${width}.png` });
  });
}

test('prepared production cache supports real downloaded peer file after disconnect and reload', async ({ page, context }) => {
  test.setTimeout(120000);
  await page.goto('/'); await complete(page);
  await page.locator('#inquiry-explanation').fill('离线文件往返');
  const path = await downloadRecord(page); await page.locator('#inquiry-finish').click();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.locator('#settings').click(); await page.locator('#cache-offline').click();
  await expect(page.locator('#offline-status')).toContainText('展馆、知识卡与本地模型已缓存', { timeout: 60000 });
  await page.keyboard.press('Escape');
  await context.setOffline(true); await page.reload();
  await expect(page.locator('#start-inquiry')).toBeVisible(); await complete(page);
  const before = await progress(page);
  await page.locator('#inquiry-peer-file').setInputFiles(path);
  await expect(page.locator('#inquiry-peer-status')).toContainText('已导入');
  await expect(page.locator('.inquiry-peer-column').nth(1)).toContainText('离线文件往返');
  expect(await progress(page)).toEqual(before);
});
