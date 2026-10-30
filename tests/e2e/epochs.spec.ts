import { test, expect, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { chapters } from '../../src/content/chapters';
import { species } from '../../src/content/species';
import { questions } from '../../src/content/questions';
import { GameStore } from '../../src/core/store';

const saveKey = 'life-museum-save-v1';
type EpochStats = { chapter: number; theme: string; elapsed: number; status: string; reducedMotion: boolean; webgl: boolean; triangles: number; drawCalls: number; pixelRatio: number };
const stats = (page: Page) => page.evaluate(() => (window as typeof window & { __lifeDiagnostics(): { epochEvent?: EpochStats } }).__lifeDiagnostics().epochEvent);
async function openPreview(page: Page, chapter: number) {
  const menu = page.getByRole('button', { name: '打开导航', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.locator('#classroom').click();
  await page.locator(`[data-classroom="${chapter}"]`).click();
  await page.locator('#preview-event').click();
}

test('all eight classroom highlights render distinct accessible scenes without changing progress', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.locator('#chapter-event')).toBeVisible();
  const before = await page.evaluate(key => localStorage.getItem(key), saveKey);
  const measurements: EpochStats[] = [];
  for (const chapter of chapters) {
    await openPreview(page, chapter.id);
    const event = page.getByRole('dialog', { name: chapter.event, exact: true });
    await expect(event).toBeVisible();
    await expect(event).toContainText(chapter.eventDescription);
    await expect(event).toContainText(chapter.takeaway);
    await expect.poll(async () => (await stats(page))?.triangles || 0).toBeGreaterThan(0);
    const measured = (await stats(page))!;
    expect(measured.chapter).toBe(chapter.id); expect(measured.reducedMotion).toBe(true);
    expect(measured.webgl).toBe(true); expect(measured.triangles).toBeLessThan(150_000);
    expect(measured.pixelRatio).toBeLessThanOrEqual(1.7); measurements.push(measured);
    await page.locator('[data-epoch-skip]').click();
    await expect(event).toHaveAttribute('data-status', 'summary');
    if (chapter.id === 6) await page.screenshot({ path: 'evidence/epoch-impact-desktop.png' });
    await page.locator('.event-continue').click();
    await expect(event).toHaveCount(0); expect(await stats(page)).toBeFalsy();
    await expect(page.locator('#preview-event')).toBeFocused();
    await page.locator('dialog[open] .close-modal').click();
  }
  expect(new Set(measurements.map(item => item.theme)).size).toBe(8);
  expect(await page.evaluate(key => localStorage.getItem(key), saveKey)).toBe(before);
  expect(errors).toEqual([]);
  writeFileSync('evidence/epoch-scene-budgets.json', JSON.stringify({ measuredAt: new Date().toISOString(), kind: 'headless structural counts, not physical device FPS', scenes: measurements }, null, 2));
});

test('highlight pause, keyboard focus, resume, summary and Escape clean up the active event', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/'); await expect(page.locator('#chapter-event')).toBeVisible();
  await page.clock.install();
  await openPreview(page, 6);
  await page.clock.runFor(500);
  await page.locator('[data-epoch-pause]').click();
  await expect(page.locator('.epoch-event')).toHaveAttribute('data-status', 'paused');
  const paused = (await stats(page))!; expect(paused.reducedMotion).toBe(false);
  await page.clock.fastForward(2_000);
  expect((await stats(page))!.elapsed).toBe(paused.elapsed);
  const focusables = await page.locator('.epoch-event button:visible').count();
  for (let index = 0; index < focusables + 2; index++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('.epoch-event'))).toBe(true);
  }
  await page.locator('[data-epoch-pause]').click(); await page.clock.runFor(500);
  expect((await stats(page))!.elapsed).toBeGreaterThan(paused.elapsed);
  await page.clock.fastForward(11_000);
  await expect(page.locator('.epoch-event')).toHaveAttribute('data-status', 'summary');
  await page.keyboard.press('Escape');
  await expect(page.locator('.epoch-event')).toHaveCount(0); expect(await stats(page)).toBeFalsy();
  await expect(page.locator('#preview-event')).toBeFocused();
});

test('mobile reduced-motion highlights fit a short viewport and replay cannot reward twice', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await page.goto('/'); await expect(page.locator('#chapter-event')).toBeVisible();
  await openPreview(page, 8);
  const fit = await page.locator('.epoch-event').evaluate(element => ({ content: element.scrollWidth, visible: element.clientWidth }));
  expect(fit.content).toBeLessThanOrEqual(fit.visible + 1);
  await page.locator('[data-epoch-skip]').click();
  await page.locator('.event-continue').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'evidence/epoch-mobile.png' });
  await page.locator('.event-continue').click(); await page.locator('dialog[open] .close-modal').click();
  const fixture = new GameStore(species, questions, { persist: false });
  for (const resident of species.filter(entry => entry.chapter === 1).slice(0, 3)) { fixture.observe(resident.id); fixture.read(resident.id); }
  for (const question of questions.filter(entry => entry.chapter === 1).slice(0, 3)) fixture.answer(question.id, question.correct);
  fixture.complete(1);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: saveKey, value: fixture.export() });
  await page.reload();
  await expect(page.locator('#chapter-replay')).toBeVisible();
  const before = await page.evaluate(key => localStorage.getItem(key), saveKey);
  await page.locator('#chapter-replay').click(); await page.locator('.event-continue').click();
  expect(await page.evaluate(key => localStorage.getItem(key), saveKey)).toBe(before);
});

test('missing WebGL keeps the full highlight narration and exit control usable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, options?: object) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return Reflect.apply(original, this, [type, options]);
    } as typeof original;
  });
  await page.goto('/'); await expect(page.locator('#chapter-event')).toBeVisible();
  await openPreview(page, 4);
  await expect(page.getByRole('dialog', { name: chapters[3].event, exact: true })).toBeVisible();
  await expect(page.locator('.epoch-event')).toContainText(chapters[3].eventDescription);
  expect((await stats(page))?.webgl).toBe(false);
  await page.locator('.event-continue').click();
  await expect(page.locator('.epoch-event')).toHaveCount(0); expect(await stats(page)).toBeFalsy();
});
