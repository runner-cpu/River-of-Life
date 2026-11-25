import { test, expect, type Page } from '@playwright/test';
import { GameStore } from '../../src/core/store';
import { species } from '../../src/content/species';
import { questions } from '../../src/content/questions';

test.use({ serviceWorkers: 'block' });
const saveKey = 'life-museum-save-v1';
const snapshot = (page: Page) => page.evaluate(() => (window as unknown as { __lifeDiagnostics: () => { progress: unknown } }).__lifeDiagnostics().progress);
const saved = (page: Page) => page.evaluate(key => localStorage.getItem(key), saveKey);
const databaseSaved = (page: Page) => page.evaluate(() => new Promise<unknown>((resolve, reject) => {
  const request = indexedDB.open('life-museum', 1);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result, read = db.transaction('progress').objectStore('progress').get('current');
    read.onsuccess = () => { db.close(); resolve(read.result); }; read.onerror = () => { db.close(); reject(read.error); };
  };
}));
async function observe(page: Page, id = 'cyanobacteria') {
  await page.locator(`[data-codex-id="${id}"]`).click(); await page.locator('dialog .close-modal').click();
}
async function startDelayedImport(page: Page, raw: string) {
  await page.evaluate(() => {
    File.prototype.text = function () {
      return new Promise<string>(resolve => { (window as unknown as { finishSaveRead: (raw: string) => void }).finishSaveRead = resolve; });
    };
  });
  await page.locator('#import-save').setInputFiles({ name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
  await expect(page.locator('#import-status')).toContainText('正在读取');
  await expect(page.locator('#import-save')).toHaveValue('');
}
async function finishRead(page: Page, raw: string) {
  await page.evaluate(raw => (window as unknown as { finishSaveRead: (raw: string) => void }).finishSaveRead(raw), raw);
  await page.evaluate(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
}

test('only one same-context page writes, and a fresh reload takes ownership after it closes', async ({ page, context }) => {
  await page.goto('/#codex'); await observe(page);
  const second = await context.newPage(); await second.goto('/#codex');
  await expect(second.locator('#progress-access')).toContainText('只读快照');
  await expect(second.locator('#progress-access')).toContainText('重新加载');
  const before = await snapshot(second), persisted = await saved(second);
  await observe(second, 'stromatolites');
  expect(await snapshot(second)).toEqual(before); expect(await saved(second)).toBe(persisted);
  await second.locator('#settings').click();
  await expect(second.locator('#projection')).toBeDisabled(); await expect(second.locator('#import-save-trigger')).toBeDisabled();
  const download = second.waitForEvent('download'); await second.locator('#export-save').click(); await download;
  await second.locator('dialog .close-modal').click();
  await page.close(); await second.locator('#progress-access button').click();
  await expect(second.locator('#codex-grid')).toBeVisible(); await expect(second.locator('#progress-access')).toHaveCount(0);
  await observe(second, 'stromatolites');
  expect(JSON.parse((await saved(second))!).observed).toEqual(['cyanobacteria', 'stromatolites']);
});

test('an old read-only snapshot cannot resurrect progress after the writer resets', async ({ page, context }) => {
  await page.goto('/#codex'); await observe(page);
  const second = await context.newPage(); await second.goto('/#codex'); await expect(second.locator('#progress-access')).toBeVisible();
  const old = await snapshot(second);
  await page.locator('#settings').click(); await page.locator('.reset-details summary').click(); await page.locator('#reset-save').click();
  await expect(page.locator('.save-review')).toContainText('恢复存档仍会保留'); await page.locator('#confirm-reset').click();
  const reset = await saved(page); expect(JSON.parse(reset!).observed).toEqual([]);
  await observe(second, 'stromatolites'); expect(await snapshot(second)).toEqual(old); expect(await saved(second)).toBe(reset);
  await page.close(); await second.reload(); await expect(second.locator('#codex-grid')).toBeVisible();
  expect((await snapshot(second) as { observed: string[] }).observed).toEqual([]);
});

test('a browser without Web Locks can read and export but cannot save', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true }); });
  await page.goto('/#codex'); await expect(page.locator('#progress-access')).toContainText('不支持 Web Locks');
  const before = await snapshot(page); await observe(page); expect(await snapshot(page)).toEqual(before); expect(await saved(page)).toBeNull();
  await page.locator('#settings').click(); const download = page.waitForEvent('download'); await page.locator('#export-save').click(); await download;
});

test('closing settings prevents a delayed file read from replacing subsequent progress', async ({ page }) => {
  await page.goto('/#codex'); await observe(page); const raw = (await saved(page))!;
  await page.locator('#settings').click(); await startDelayedImport(page, raw);
  await page.locator('dialog .close-modal').click(); await page.locator('#settings').click(); await page.locator('#projection').check();
  const before = await snapshot(page), persisted = await saved(page); await finishRead(page, raw);
  expect(await snapshot(page)).toEqual(before); expect(await saved(page)).toBe(persisted);
  await expect(page.locator('#projection')).toBeChecked();
});

test('starting a reset cancels a delayed import before it can restore old records', async ({ page }) => {
  await page.goto('/#codex'); await observe(page); const raw = (await saved(page))!;
  await page.locator('#settings').click(); await startDelayedImport(page, raw);
  await page.locator('.reset-details summary').click(); await page.locator('#reset-save').click(); await page.locator('#confirm-reset').click();
  const before = await snapshot(page), persisted = await saved(page); await finishRead(page, raw);
  expect(await snapshot(page)).toEqual(before); expect(await saved(page)).toBe(persisted);
  expect(JSON.parse(persisted!).observed).toEqual([]);
});

test('page exit revokes permission immediately and a restored page reloads before writing', async ({ page }) => {
  await page.goto('/#codex'); await observe(page); const before = await snapshot(page), persisted = await saved(page);
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await observe(page, 'stromatolites'); expect(await snapshot(page)).toEqual(before); expect(await saved(page)).toBe(persisted);
  await Promise.all([
    page.waitForEvent('load'),
    page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))),
  ]);
  await expect(page.locator('#codex-grid')).toBeVisible(); await expect(page.locator('#progress-access')).toHaveCount(0);
  await observe(page, 'stromatolites'); expect(JSON.parse((await saved(page))!).observed).toEqual(['cyanobacteria', 'stromatolites']);
});

test('readers browse unlocked chapters and grade temporary quizzes without changing their snapshot or either replica', async ({ page, context }) => {
  const seed = new GameStore(species, questions, { persist: false });
  for (const s of species.filter(s => s.chapter === 1).slice(0, 3)) { seed.observe(s.id); seed.read(s.id); }
  for (const q of questions.filter(q => q.chapter === 1).slice(0, 3)) seed.answer(q.id, q.correct);
  seed.complete(1); seed.unlock(2); seed.setChapter(1);
  await page.addInitScript(raw => localStorage.setItem('life-museum-save-v1', raw), seed.export());
  await page.goto('/'); await page.locator('#settings').click(); await page.locator('#projection').check(); await page.locator('dialog .close-modal').click();
  const reader = await context.newPage(); await reader.goto('/'); await expect(reader.locator('#progress-access')).toBeVisible();
  const before = await snapshot(reader), local = await saved(reader), database = await databaseSaved(reader);
  await reader.locator('[data-chapter="2"]').click(); await expect(reader.locator('[data-chapter="2"]')).toHaveClass(/active/);
  await expect(reader.locator(`[data-open-species="${species.find(s => s.chapter === 2)!.id}"]`)).toBeVisible();
  await reader.locator('[data-mode="quiz"]').click();
  const deck: string[] = [];
  const expectedCount = new Set(questions.filter(q => q.chapter === 2).map(q => q.speciesId)).size;
  for (let attempt = 0; attempt < expectedCount; attempt++) {
    const id = await reader.locator('.question-card').getAttribute('data-question-id');
    const q = questions.find(q => q.id === id)!;
    expect(q.chapter).toBe(2); expect(deck).not.toContain(q.speciesId); deck.push(q.speciesId);
    await expect(reader.locator('.question-card h2')).toHaveText(q.prompt); await reader.locator(`[data-answer="${q.correct}"]`).click();
    await expect(reader.locator('#quiz-feedback-heading')).toContainText('发现正确答案');
    await expect(reader.locator('#quiz-feedback-heading')).toContainText('只读练习');
    await expect(reader.locator('#quiz-feedback-heading')).not.toContainText('本题已获奖励'); await reader.locator('#next-question').click();
  }
  await expect(reader.locator('.quiz-complete')).toContainText(`答对 ${deck.length} / ${deck.length} 题`);
  await reader.locator('[data-mode="journey"]').click(); await reader.locator('[data-chapter="1"]').click(); await expect(reader.locator('[data-chapter="1"]')).toHaveClass(/active/);
  expect(await snapshot(reader)).toEqual(before); expect(await saved(reader)).toBe(local); expect(await databaseSaved(reader)).toEqual(database);
  await reader.locator('#settings').click(); const waiting = reader.waitForEvent('download'); await reader.locator('#export-save').click();
  const download = await waiting, stream = await download.createReadStream(); let exported = ''; for await (const chunk of stream!) exported += chunk.toString();
  expect(JSON.parse(exported)).toEqual(before);
});

test('a bubbling file-picker cancellation keeps settings open, cancels the pending read, and permits the same-file retry', async ({ page }) => {
  await page.goto('/#codex'); await observe(page); const raw = (await saved(page))!, before = await snapshot(page);
  await page.locator('#settings').click(); await startDelayedImport(page, raw);
  await page.locator('#import-save').dispatchEvent('cancel', { bubbles: true, cancelable: true });
  await expect(page.locator('dialog[open] #import-save')).toHaveCount(1); await expect(page.locator('#import-status')).toContainText('未选择');
  await finishRead(page, raw); expect(await snapshot(page)).toEqual(before); expect(await saved(page)).toBe(raw);
  await page.evaluate(() => { File.prototype.text = Blob.prototype.text; });
  await page.locator('#import-save').setInputFiles({ name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
  await expect(page.locator('dialog')).toHaveCount(0); await expect(page.locator('#toasts')).toContainText('探索记录已导入');
  await page.locator('#settings').click(); await page.locator('dialog').dispatchEvent('cancel', { bubbles: true, cancelable: true }); await expect(page.locator('dialog')).toHaveCount(0);
});
