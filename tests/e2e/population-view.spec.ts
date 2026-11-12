import { test, expect } from '@playwright/test';

for (const width of [1440, 390, 320]) {
  test(`population pools synchronize with keyboard and retain prior inputs at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/#lab');
    await page.locator('#comparison-prediction').selectOption('higher');
    await page.locator('#run-comparison').click();
    const slider = page.locator('#population-generation');
    await expect(slider).toHaveValue('30');
    await expect(page.locator('.population-dots')).toHaveCount(4);
    for (const group of ['control', 'treatment']) {
      await expect(page.locator(`[data-population="${group}"] [data-pool="current"] circle`)).toHaveCount(100);
    }
    await slider.focus(); await page.keyboard.press('Home');
    await expect(slider).toHaveValue('0');
    await expect(page.locator('.population-summary').first()).toContainText('没有上一代');
    await expect(page.locator('#population-previous')).toBeDisabled();
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue('1');
    await expect(page.locator('#population-chart-marker')).toHaveAttribute('data-generation', '1');
    await expect(page.locator('.comparison-table tr[aria-current="true"] th')).toHaveText('1');
    for (const [index, group] of ['control', 'treatment'].entries()) {
      const count = await page.locator(`[data-population="${group}"] [data-pool="current"] circle[data-value="1"]`).count();
      const cell = page.locator('.comparison-table tr[aria-current="true"] td').nth(index);
      await expect(cell).toHaveText(String(count));
      await expect(page.locator(`[data-population="${group}"] .population-summary`)).toContainText(`频率 ${count}%`);
    }
    const oldPools = await page.locator('#population-content').innerHTML();
    await page.locator('#comparison-seed').fill('20261026');
    await page.locator('#comparison-prediction').selectOption('lower');
    await page.locator('#drought').focus(); await page.keyboard.press('Home');
    await expect(page.locator('#comparison-pending')).toBeVisible();
    expect(await page.locator('#population-content').innerHTML()).toBe(oldPools);
    await expect(page.locator('.comparison-record')).toContainText('20261025');
    await page.locator('#population-next').click();
    await expect(slider).toHaveValue('2');
    await expect(page.locator('#comparison-pending')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.population-dots').first().evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    await page.locator('.population-view').screenshot({ path: `evidence/task3-population-${width}.png` });
    await page.locator('#run-comparison').click();
    await expect(slider).toHaveValue('30');
    await expect(page.locator('#comparison-pending')).toBeHidden();
    await expect(page.locator('.comparison-record')).toContainText('20261026');
  });
}
