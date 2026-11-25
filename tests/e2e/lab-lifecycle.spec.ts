import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('leaving each laboratory mount releases delegated input and one change refreshes the current comparison once', async ({ page }) => {
  await page.addInitScript(() => {
    const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
    const listeners = new Set<EventListenerOrEventListenerObject>();
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (this instanceof HTMLElement && this.id === 'main-content' && type === 'input' && listener) listeners.add(listener);
      return add.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      if (this instanceof HTMLElement && this.id === 'main-content' && type === 'input' && listener) listeners.delete(listener);
      return remove.call(this, type, listener, options);
    };
    Object.assign(window, { laboratoryInputListenerCount: () => listeners.size });
  });
  await page.goto('/');
  const listenerCount = () => page.evaluate(() => (window as unknown as { laboratoryInputListenerCount: () => number }).laboratoryInputListenerCount());
  const baseline = await listenerCount();
  for (let mount = 0; mount < 3; mount++) {
    await page.locator('[data-mode="lab"]').click();
    await expect(page.locator('#comparison-current')).toBeVisible();
    expect(await listenerCount()).toBe(baseline + 1);
    const updates = await page.evaluate(() => {
      const current = document.querySelector('#comparison-current')!;
      const observer = new MutationObserver(() => {});
      observer.observe(current, { childList: true });
      const drought = document.querySelector<HTMLInputElement>('#drought')!;
      drought.value = '62'; drought.dispatchEvent(new Event('input', { bubbles: true }));
      const count = observer.takeRecords().length; observer.disconnect();
      return count;
    });
    expect(updates).toBe(1);
    await expect(page.locator('#comparison-current')).toContainText('实验组干旱 62%');
    await page.locator('[data-mode="codex"]').click();
    await expect(page.locator('#codex-grid')).toBeVisible();
    expect(await listenerCount()).toBe(baseline);
  }
});
