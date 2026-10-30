import { test, expect, type Page } from '@playwright/test';
import { species } from '../../src/content/species';

const saveKey = 'life-museum-save-v1';
async function openClassroom(page: Page) {
  await page.goto('/');
  const menu = page.getByRole('button', { name: '打开导航', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.locator('#classroom').click();
  await page.locator('[data-classroom="6"]').click();
  await expect(page.locator('.classroom-exhibit')).toBeVisible();
}

test('classroom focus, labels, pause and specimen reading preserve personal progress', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openClassroom(page);
  const before = await page.evaluate(key => localStorage.getItem(key), saveKey);
  const exhibit = page.locator('.classroom-exhibit');
  await expect(exhibit.locator('[data-preview-focus]')).toHaveCount(6);
  const fit = await exhibit.evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth, height: element.clientHeight, scrollHeight: element.scrollHeight }));
  expect(fit.scrollWidth).toBeLessThanOrEqual(fit.width + 1);
  expect(fit.scrollHeight).toBeLessThanOrEqual(fit.height + 1);
  await page.locator('[data-preview-focus="archaeopteryx"]').click();
  await expect(page.locator('[data-preview-focus="archaeopteryx"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#preview-selected-summary')).toContainText('长骨尾');
  await expect(page.locator('#classroom-scene')).toHaveAttribute('data-view', 'inspection');
  await expect(page.locator('#preview-read')).toBeInViewport();
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await page.locator('#classroom-scene canvas').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#classroom-scene .hotspot:focus')).toHaveCSS('opacity', '1');
  await page.locator('#preview-labels').click();
  await expect(page.locator('#classroom-scene .scene-hotspots')).toHaveCSS('opacity', '0');
  await page.locator('#preview-pause').click();
  await expect(page.locator('#preview-pause')).toHaveAttribute('aria-label', '继续课堂动画');
  await page.locator('#preview-read').click();
  const card = page.getByRole('dialog', { name: '始祖鸟', exact: true });
  await expect(card).toBeVisible();
  await card.locator('#mark-read').click();
  await card.locator('.close-modal').click();
  await page.locator('#preview-event').click();
  await page.locator('.event-continue').click();
  await expect(page.locator('#preview-pause')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#preview-reset').click();
  await expect(page.locator('[data-preview-focus][aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('#preview-read')).toBeHidden();
  await page.locator('#preview-labels').click();
  await expect(page.locator('#classroom-scene .scene-hotspots')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'evidence/classroom-desktop.png' });
  await page.getByRole('button', { name: '选择纪元', exact: true }).click();
  await expect(page.locator('[data-classroom]')).toHaveCount(8);
  expect(await page.evaluate(key => localStorage.getItem(key), saveKey)).toBe(before);
});

test('mobile classroom provides every resident and keeps exit and teaching actions reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openClassroom(page);
  const exhibit = page.locator('.classroom-exhibit');
  expect(await exhibit.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  const ids = await page.locator('[data-preview-focus]').evaluateAll(elements => elements.map(element => (element as HTMLElement).dataset.previewFocus!));
  for (const id of ids) {
    await page.locator(`[data-preview-focus="${id}"]`).click();
    await expect(page.locator(`[data-preview-focus="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#classroom-scene')).toHaveAttribute('data-species', id);
    await expect(page.locator('#classroom-scene canvas')).toBeInViewport({ ratio: .95 });
    await expect(exhibit.locator('.close-modal')).toBeInViewport();
  }
  await page.locator('#preview-sheet').scrollIntoViewIfNeeded();
  await expect(page.locator('#preview-event')).toBeInViewport();
  await expect(page.locator('#preview-sheet')).toBeInViewport();
  await page.screenshot({ path: 'evidence/classroom-mobile-guide.png' });
  await page.locator('#preview-reset').click();
  await page.screenshot({ path: 'evidence/classroom-mobile-scene.png' });
  await page.keyboard.press('Escape');
  await expect(exhibit).toHaveCount(0);
});

test('inspection cycles through six species with matching facts and restores the overview', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openClassroom(page);
  const residents = species.filter(entry => entry.chapter === 6 && entry.status === 'published');
  await page.locator(`[data-preview-focus="${residents[0].id}"]`).click();
  await page.locator('#preview-previous').click();
  await expect(page.locator('#classroom-scene')).toHaveAttribute('data-species', residents.at(-1)!.id);
  for (const resident of residents) {
    await page.locator('#preview-next').click();
    await expect(page.locator('#classroom-scene')).toHaveAttribute('data-species', resident.id);
    await expect(page.locator('#preview-heading')).toHaveText(resident.name);
    await expect(page.locator('#preview-selected-summary')).toHaveText(resident.definition);
    await expect(page.locator('#preview-facts')).toContainText(resident.sizeLabel);
    await expect(page.locator('#preview-facts')).toContainText(resident.period);
    await expect(page.locator('#preview-fact')).toHaveText(resident.fact);
    await expect(page.locator('#classroom-scene .hotspot:not([hidden])')).toHaveCount(1);
    await expect(page.locator('#preview-read')).toBeInViewport();
  }
  await page.locator('#preview-overview').click();
  await expect(page.locator('#classroom-scene')).toHaveAttribute('data-view', 'overview');
  await expect(page.locator('#preview-heading')).toHaveText('巨影与羽翼');
  await expect(page.locator('#classroom-scene .hotspot:not([hidden])')).toHaveCount(6);
  await expect(page.locator('.classroom-selected')).toBeHidden();
  await expect(page.locator('[data-preview-focus][aria-pressed="true"]')).toHaveCount(0);
});
