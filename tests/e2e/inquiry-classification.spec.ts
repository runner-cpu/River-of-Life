import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

for (const width of [1440, 390, 320]) {
  test(`classification keyboard revision and exports at ${width}px reduced motion`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.locator('#start-inquiry').click();
    await page.locator('[data-inquiry="feathers-and-evidence"]').click();
    await page.locator('input[value="0"]').check();
    await page.locator('.inquiry-question button[type="submit"]').click();
    await page.locator('#inquiry-text').click(); await page.locator('#inquiry-continue').click();
    await expect(page.locator('#inquiry-show-graph')).toBeDisabled();
    await page.locator('details summary').first().click();
    await expect(page.locator('details').first()).toContainText('核对范围');
    for (let i = 0; i < 2; i++) {
      await page.locator('[data-category="more-information"]').nth(i).focus();
      await page.keyboard.press('Enter');
    }
    await page.locator('#inquiry-show-graph').focus(); await page.keyboard.press('Enter');
    await expect(page.locator('#inquiry-graph-title')).toBeFocused();
    await expect(page.locator('svg:visible path[stroke-dasharray]')).toHaveCount(1);
    await page.locator('#inquiry-explanation').fill('我还需要更多信息。');
    await page.locator('#inquiry-revise').click();
    await page.locator('[data-category="oppose"]').first().click();
    await page.locator('#inquiry-show-graph').click();
    await expect(page.locator('#inquiry-explanation')).toHaveValue('我还需要更多信息。');
    expect(await page.locator('.modal-body').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: `evidence/task2-graph-${width}.png` });
    await page.locator('#inquiry-transfer').click(); await page.locator('input[value="0"]').check();
    await page.locator('.inquiry-question button[type="submit"]').click();
    await expect(page.locator('#inquiry-explanation')).toHaveValue('我还需要更多信息。');
    for (const id of ['inquiry-export', 'inquiry-export-json']) {
      const downloaded = page.waitForEvent('download');
      await page.locator(`#${id}`).focus(); await page.keyboard.press('Enter');
      const content = readFileSync((await (await downloaded).path())!, 'utf8');
      expect(content).toContain('我还需要更多信息。');
      if (id.endsWith('json')) { const r = JSON.parse(content); expect(r.answers.evidence).toBeNull(); expect(r.classifications[0].category).toBe('oppose'); }
      else expect(content).toContain('证据归类');
    }
  });
}

test('desktop dragging uses the same categories without inventing a legacy evidence answer', async ({ page }) => {
  await page.goto('/'); await page.locator('#start-inquiry').click();
  await page.locator('[data-inquiry="sea-and-family"]').click();
  await page.locator('input[value="1"]').check();
  await page.locator('.inquiry-question button[type="submit"]').click();
  await page.locator('#inquiry-text').click(); await page.locator('#inquiry-continue').click();
  await page.locator('[data-card]').first().dragTo(page.locator('[data-drop-category="irrelevant"]'));
  await expect(page.locator('[data-card] .card-status').first()).toHaveText('与判断无关');
  await page.locator('[data-card]').nth(1).dragTo(page.locator('[data-drop-category="support"]'));
  await expect(page.locator('#inquiry-show-graph')).toBeEnabled();
});
