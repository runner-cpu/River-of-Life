import { test, expect, type Page } from '@playwright/test';
import { species } from '../../src/content/species';
import { questions } from '../../src/content/questions';
import { readFileSync, writeFileSync } from 'node:fs';
import { GameStore } from '../../src/core/store';
import { chapters } from '../../src/content/chapters';

const models: { speciesId: string; url: string; author: string; representation: string; license: string; licenseUrl?: string; title?: string; modifications?: string }[] = JSON.parse(readFileSync(new URL('../../public/models/manifest.json', import.meta.url), 'utf8'));

const saveKey = 'life-museum-save-v1';
const chapterOne = species.filter(entry => entry.chapter === 1 && entry.status === 'published');
const readSave = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), saveKey);
const navigate = async (page: Page, mode: string) => {
  const menu = page.getByRole('button', { name: '打开导航', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.locator(`[data-mode="${mode}"]`).click();
  await expect(page.locator(`[data-mode="${mode}"]`)).toHaveAttribute('aria-current', 'page');
};
const closeCard = async (page: Page) => page.locator('dialog[open] .close-modal').last().click();
const openCard = async (page: Page, id: string) => page.locator(`[data-codex-id="${id}"]`).click();
const advanceDemo = async (page: Page, seconds: number) => {
  // Advance each demo interval once while skipping thousands of irrelevant WebGL frames.
  for (let second = 0; second < seconds; second++) await page.clock.fastForward(1_000);
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#chapter-event')).toBeVisible();
});

test('first observation is a free collection; reading and reload preserve the ledger without duplicate rewards', async ({ page }) => {
  await page.screenshot({ path: 'evidence/e2e-desktop-journey.png', fullPage: true });
  await page.locator(`[data-open-species="${chapterOne[0].id}"]`).click();
  await expect(page.locator('#collect-species')).toHaveText('已加入图鉴');
  await expect.poll(async () => (await readSave(page))?.points).toBe(5);
  await page.locator('#mark-read').click();
  await page.locator('#compare-model').click();
  await expect(page.locator('#size-comparison')).toBeVisible();
  const saved = await readSave(page);
  expect(saved.observed).toEqual([chapterOne[0].id]);
  expect(saved.collected).toEqual([chapterOne[0].id]);
  expect(saved.read).toEqual([chapterOne[0].id]);
  expect(saved.points).toBe(58); // 5 observation + 3 reading + 50 first comparison task.
  await closeCard(page);
  await page.reload();
  await expect(page.locator('#points')).toHaveText('58');
  await page.locator(`[data-open-species="${chapterOne[0].id}"]`).click();
  await expect(page.locator('#mark-read')).toHaveText('已阅读');
  await page.locator('#mark-read').click();
  expect((await readSave(page)).points).toBe(58);
  await closeCard(page);
  await navigate(page, 'codex');
  await page.locator('[data-filter="collected"]').click();
  await expect(page.locator('[data-codex-id]')).toHaveCount(1);
});

test('complete chapter one through real learning actions and unlock chapter two', async ({ page }) => {
  await expect(page.locator('#chapter-event')).toBeDisabled();
  for (const entry of chapterOne.slice(0, 3)) {
    await page.locator(`[data-open-species="${entry.id}"]`).click();
    await page.locator('#mark-read').click();
    await closeCard(page);
  }
  await navigate(page, 'quiz');
  for (const question of questions.filter(entry => entry.chapter === 1).slice(0, 3)) {
    await expect(page.locator('.question-card h2')).toHaveText(question.prompt);
    await page.locator(`[data-answer="${question.correct}"]`).click();
    await expect(page.locator('#answer-feedback .feedback')).toHaveClass(/is-correct/);
    await page.locator('#next-question').click();
  }
  await navigate(page, 'journey');
  await expect(page.locator('#chapter-event')).toBeEnabled();
  await page.locator('#chapter-event').click();
  await expect(page.locator('.epoch-event')).toBeVisible();
  await page.locator('.event-continue').click();
  await page.locator('#chapter-event').click();
  await page.locator('#unlock-chapter').click();
  await expect(page.locator('.scene-title .scene-eyebrow')).toContainText('CHAPTER 02');
  const saved = await readSave(page);
  expect(saved.completedChapters).toEqual([1]);
  expect(saved.unlockedChapters).toEqual([1, 2]);
  expect(saved.points).toBe(154); // 24 reading/observing + 30 answers + 150 tasks + 100 event - 150 unlock.
  await page.reload();
  await expect(page.locator('.scene-title .scene-eyebrow')).toContainText('CHAPTER 02');
});

test('IndexedDB preserves newer learning when localStorage writes fail', async ({ page }) => {
  await page.locator(`[data-open-species="${chapterOne[0].id}"]`).click();
  await expect.poll(async () => (await readSave(page))?.points).toBe(5);
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Simulated storage quota failure', 'QuotaExceededError');
      return original.call(this, name, value);
    };
  }, saveKey);
  await page.locator('#mark-read').click();
  await expect(page.locator('#points')).toHaveText('8');
  await expect.poll(() => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('life-museum', 1);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const result = await new Promise<{ points?: number } | undefined>(resolve => {
      const request = db.transaction('progress').objectStore('progress').get('current');
      request.onsuccess = () => resolve(request.result);
    });
    db.close(); return result?.points;
  })).toBe(8);
  await page.reload();
  await expect(page.locator('#points')).toHaveText('8');
  await page.locator(`[data-open-species="${chapterOne[0].id}"]`).click();
  await expect(page.locator('#mark-read')).toHaveText('已阅读');
});

test('excavation accepts pointer strokes and accessible cleaning, rewards once, and survives reload', async ({ page }) => {
  await navigate(page, 'dig');
  const canvas = page.locator('#scratch-canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 10, box!.y + 20);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width - 10, box!.y + 20, { steps: 25 });
  await page.mouse.up();
  await expect(page.locator('#dig-percent')).not.toHaveText('0%');
  for (let step = 0; step < 12 && await page.locator('#dig-accessible').isEnabled(); step++) await page.locator('#dig-accessible').click();
  await expect(page.locator('#dig-percent')).toHaveText('100%');
  await expect(page.locator('#open-dig-species')).toBeVisible();
  const saved = await readSave(page);
  expect(saved.excavated).toEqual([1]);
  expect(saved.collected).toContain(chapterOne[0].id);
  expect(saved.points).toBe(75); // observation + excavation + its chapter task.
  await page.reload();
  await expect(page.locator('#dig-percent')).toHaveText('100%');
  expect((await readSave(page)).points).toBe(75);
});

test('demo preview learning, takeover, and full 90-second playback leave the personal save unchanged', async ({ page }) => {
  await page.locator(`[data-open-species="${chapterOne[0].id}"]`).click();
  await page.locator('#mark-read').click();
  await closeCard(page);
  const saved = await page.evaluate(key => localStorage.getItem(key), saveKey);
  await page.clock.install();
  await page.locator('#start-demo').click();
  await advanceDemo(page, 25);
  await expect(page.locator('dialog[open] #mark-read')).toBeEnabled();
  await page.locator('dialog[open] #mark-read').click();
  await page.locator('dialog[open] #compare-model').click();
  await page.locator('.demo-dialog-takeover').click();
  await expect(page.locator('.demo-bar')).toHaveCount(0);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), saveKey)).toBe(saved);
  await expect(page.locator('.scene-title .scene-eyebrow')).toContainText('CHAPTER 01');
  await page.locator('#start-demo').click();
  await advanceDemo(page, 69);
  await expect(page.locator('#demo-dig #dig-percent')).toHaveText('100%');
  await advanceDemo(page, 6);
  await expect(page.locator('.epoch-event')).toBeVisible();
  await advanceDemo(page, 15);
  await expect(page.locator('.demo-bar')).toHaveCount(0);
  await expect(page.locator('.epoch-event')).toHaveCount(0);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('.scene-title .scene-eyebrow')).toContainText('CHAPTER 01');
  expect(await page.evaluate(key => localStorage.getItem(key), saveKey)).toBe(saved);
  await page.locator('#start-demo').click();
  await advanceDemo(page, 75);
  await page.locator('[data-epoch-takeover]').click();
  await expect(page.locator('.epoch-event')).toHaveCount(0);
  await expect(page.locator('.demo-bar')).toHaveCount(0);
  await page.clock.fastForward(20_000);
  expect(await page.evaluate(key => localStorage.getItem(key), saveKey)).toBe(saved);
});

test('a manually selected demo hotspot in an unlocked chapter remains a preview', async ({ page }) => {
  // Establish a valid chapter-two prerequisite save using the same domain ledger;
  // the separate progression test above verifies that prerequisite through the UI.
  const fixture = new GameStore(species, questions, { persist: false });
  fixture.settings({ reducedMotion: true });
  for (const entry of chapterOne.slice(0, 3)) { fixture.observe(entry.id); fixture.read(entry.id); }
  for (const question of questions.filter(entry => entry.chapter === 1).slice(0, 3)) fixture.answer(question.id, question.correct);
  fixture.complete(1); fixture.unlock(2);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: saveKey, value: fixture.export() });
  await page.reload();
  await expect(page.locator('.scene-title .scene-eyebrow')).toContainText('CHAPTER 02');
  const saved = await page.evaluate(key => localStorage.getItem(key), saveKey);
  await page.locator('#start-demo').click();
  await page.locator('.hotspot[data-species="trilobite"]').click();
  await page.locator('dialog[open] #mark-read').click();
  expect(await page.evaluate(key => localStorage.getItem(key), saveKey)).toBe(saved);
  await expect(page.locator('.demo-dialog-takeover')).toBeVisible();
  await page.locator('.demo-dialog-takeover').click();
  expect(await page.evaluate(key => localStorage.getItem(key), saveKey)).toBe(saved);
});

test('mobile navigation closes the drawer and principal screens have no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const mode of ['codex', 'dig', 'quiz', 'lab', 'journey']) {
    await navigate(page, mode);
    await expect(page.locator('body')).not.toHaveClass(/menu-open/);
    const width = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(width.content, `${mode} must fit the mobile viewport`).toBeLessThanOrEqual(width.viewport + 1);
  }
  await page.screenshot({ path: 'evidence/e2e-mobile-journey.png', fullPage: true });
});

test('desktop navigation settings stay reachable at 1280 by 720', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator('#settings').click({ timeout: 8_000 });
  await expect(page.locator('#cache-offline')).toBeVisible();
});

test('local guide answers supported questions from the card and gives an honest fallback', async ({ page }) => {
  const card = chapterOne[0];
  await page.locator(`[data-open-species="${card.id}"]`).click();
  const saved = await readSave(page);
  await page.locator('.darwin-guide > summary').click();
  await expect(page.locator('.guide-answer')).toContainText(card.definition);
  await page.locator('[data-guide-topic="diet"]').click();
  await expect(page.locator('.guide-answer q')).toHaveText(card.diet);
  await page.locator('.guide-references > summary').click();
  await expect(page.locator('.guide-references a').first()).toHaveAttribute('href', card.sources[0].url);
  await page.locator('#darwin-question').fill('请问蓝细菌生活在哪里？');
  await page.getByRole('button', { name: '查找答案', exact: true }).click();
  await expect(page.locator('.guide-answer q')).toHaveText(card.habitat);
  await page.locator('#darwin-question').fill('它和霸王龙打架谁会赢？');
  await page.getByRole('button', { name: '查找答案', exact: true }).click();
  await expect(page.locator('.guide-answer')).toContainText('没有足够信息回答这个问题');
  expect(await readSave(page)).toEqual(saved);
});

test('all manifest GLB exhibits visibly render in codex model-viewer with attribution', async ({ page }) => {
  test.setTimeout(120_000);
  await navigate(page, 'codex');
  for (const asset of models) {
    await test.step(asset.speciesId, async () => {
      await openCard(page, asset.speciesId);
      const viewer = page.locator('dialog[open] model-viewer');
      await expect(viewer).toHaveAttribute('src', `.${asset.url}`);
      await expect.poll(() => viewer.evaluate(element => (element as HTMLElement & { loaded?: boolean }).loaded), { timeout: 25_000 }).toBe(true);
      // A successful load alone misses clips whose pose moves outside the
      // default camera frame. Count opaque rendered model pixels, excluding
      // the CSS background, HTML interaction prompt, and translucent shadow.
      await expect.poll(() => viewer.evaluate(async element => {
        const model = element as HTMLElement & { toBlob: () => Promise<Blob> };
        const bitmap = await createImageBitmap(await model.toBlob());
        try {
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width; canvas.height = bitmap.height;
          const context = canvas.getContext('2d')!;
          context.drawImage(bitmap, 0, 0);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          let opaque = 0;
          for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 250) opaque++;
          return opaque / (canvas.width * canvas.height);
        } finally { bitmap.close(); }
      }), { timeout: 10_000, message: `${asset.speciesId} must occupy a visible part of its 3D viewport` }).toBeGreaterThan(.005);
      await expect(page.locator('#model-credit')).toContainText(asset.author);
      if (asset.license === 'CC-BY-4.0') {
        await expect(page.locator('#model-credit')).toContainText(asset.title!);
        await expect(page.locator('#model-credit')).toContainText(asset.modifications!);
        await expect(page.locator('#model-credit a', { hasText: 'CC-BY-4.0' })).toHaveAttribute('href', asset.licenseUrl!);
      }
      await expect(page.locator('#representation')).toHaveText(asset.representation === 'fossil' ? '馆藏化石 · 3D 扫描' : '开放许可 · 3D 复原');
      await closeCard(page);
    });
  }
});

test.describe('structural scene verification', () => {
test.use({ serviceWorkers: 'block' }); // Ensure GLB routes observe the actual page loads.
test('all eight chapter scenes expose six sourced residents and stay within the structural triangle budget', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const published = species.filter(entry => entry.status === 'published' && entry.sources.length > 0 && entry.sources.every(source => source.url.startsWith('https://') && source.level !== 'D'));
  const fixture = new GameStore(species, questions, { persist: false });
  fixture.settings({ reducedMotion: true });
  for (const chapter of chapters) {
    for (const resident of published.filter(entry => entry.chapter === chapter.id).slice(0, 3)) { fixture.observe(resident.id); fixture.read(resident.id); }
    for (const question of questions.filter(entry => entry.chapter === chapter.id).slice(0, 3)) fixture.answer(question.id, question.correct);
    expect(fixture.complete(chapter.id)).toBe(true);
    if (chapter.id < 8) expect(fixture.unlock(chapter.id + 1)).toBe('');
  }
  fixture.setChapter(1);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: saveKey, value: fixture.export() });
  await page.reload();
  const sceneStats = () => page.evaluate(() => {
    const diagnostics = (window as typeof window & { __lifeDiagnostics: () => { chapter: number; scene?: { triangles: number; drawCalls: number } } }).__lifeDiagnostics();
    return { chapter: diagnostics.chapter, triangles: diagnostics.scene?.triangles || 0, drawCalls: diagnostics.scene?.drawCalls || 0 };
  });
  const budgets: { chapter: number; name: string; triangles: number; drawCalls: number; hotspots: string[]; loadedSceneModels: string[] }[] = [];
  // Hold each chapter's live reconstructions so each GLB's completed render can
  // be observed as a structural-stat change, rather than measuring placeholders.
  const pending = new Map<string, import('@playwright/test').Route>();
  let holdModels = true;
  await page.route('**/models/*.glb', async route => {
    const id = route.request().url().split('/').at(-1)!.replace('.glb', '');
    if (holdModels && models.some(asset => asset.speciesId === id && asset.representation === 'reconstruction')) pending.set(id, route);
    else await route.continue();
  });
  for (const chapter of chapters) {
    await test.step(`${chapter.id}: ${chapter.name}`, async () => {
      holdModels = true;
      await page.locator(`[data-chapter="${chapter.id}"]`).click();
      await expect(page.locator('.scene-title .scene-eyebrow')).toContainText(`CHAPTER ${String(chapter.id).padStart(2, '0')}`);
      const residents = published.filter(entry => entry.chapter === chapter.id).slice(0, 6);
      expect(residents).toHaveLength(6);
      const hotspots = page.locator('#life-scene .hotspot');
      await expect(hotspots).toHaveCount(6);
      expect(await hotspots.evaluateAll(elements => elements.map(element => (element as HTMLElement).dataset.species))).toEqual(residents.map(entry => entry.id));
      for (const resident of residents) {
        const hotspot = page.locator(`#life-scene .hotspot[data-species="${resident.id}"]`);
        await expect(hotspot).toBeEnabled();
        await expect(hotspot).toHaveAttribute('aria-label', `观察${resident.name}`);
        expect(resident.sources.length).toBeGreaterThan(0);
      }
      await expect.poll(async () => (await sceneStats()).triangles).toBeGreaterThan(0);
      const loadedSceneModels: string[] = [];
      const reconstructions = models.filter(asset => asset.representation === 'reconstruction' && residents.some(resident => resident.id === asset.speciesId));
      if (reconstructions.length) {
        await expect.poll(() => pending.size).toBe(reconstructions.length);
        for (const asset of reconstructions) {
          const before = await sceneStats();
          const response = page.waitForResponse(response => response.url().endsWith(asset.url) && response.request().resourceType() === 'fetch');
          await pending.get(asset.speciesId)!.continue();
          const received = await response; expect(received.ok()).toBe(true); await received.finished();
          pending.delete(asset.speciesId);
          await expect.poll(async () => {
            const after = await sceneStats();
            return after.triangles !== before.triangles || after.drawCalls !== before.drawCalls;
          }).toBe(true);
          loadedSceneModels.push(asset.speciesId);
        }
      }
      holdModels = false;
      // Repeated identical samples establish that model replacement and the
      // camera/render loop have settled; these are counts, never device FPS.
      let prior = '', stable = 0;
      await expect.poll(async () => {
        const stats = await sceneStats(); const value = JSON.stringify(stats);
        stable = value === prior ? stable + 1 : 0; prior = value;
        return stable;
      }, { intervals: [100, 200, 250] }).toBeGreaterThanOrEqual(3);
      const stats = await sceneStats();
      expect(stats.chapter).toBe(chapter.id);
      expect(stats.triangles).toBeGreaterThan(0);
      expect(stats.triangles).toBeLessThan(150_000);
      expect(stats.drawCalls).toBeGreaterThan(0);
      budgets.push({ chapter: chapter.id, name: chapter.name, triangles: stats.triangles, drawCalls: stats.drawCalls, hotspots: residents.map(entry => entry.id), loadedSceneModels });
      const visibleHotspot = hotspots.filter({ visible: true }).first();
      const selectedId = await visibleHotspot.getAttribute('data-species');
      const selected = residents.find(resident => resident.id === selectedId)!;
      await visibleHotspot.click();
      await expect(page.getByRole('dialog', { name: selected.name, exact: true })).toBeVisible();
      await closeCard(page);
    });
  }
  await navigate(page, 'codex');
  await expect(page.locator('[data-codex-id]')).toHaveCount(published.length);
  expect(await page.locator('[data-codex-id]').evaluateAll(elements => elements.map(element => (element as HTMLElement).dataset.codexId))).toEqual(published.map(entry => entry.id));
  const evidence = { measuredAt: new Date().toISOString(), kind: 'structural render counts only; headless FPS deliberately excluded', triangleBudget: 150_000, scenes: budgets };
  writeFileSync('evidence/e2e-scene-budgets.json', JSON.stringify(evidence, null, 2));
  await testInfo.attach('all-eight-scene-structural-budgets', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
});
});

test('production service worker caches the gallery and loads a cached model after offline reload', async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.locator('#settings').click();
  await page.locator('#cache-offline').click();
  await expect(page.locator('#offline-status')).toContainText('展馆、知识卡与本地模型已缓存', { timeout: 60_000 });
  await closeCard(page);
  const cached = await page.evaluate(async modelUrls => {
    const keys = await caches.keys();
    const cache = await caches.open(keys.find(key => key.startsWith('life-museum-'))!);
    return { keys, models: await Promise.all(modelUrls.map(async url => !!await cache.match(new URL(url.replace(/^\//, ''), location.href).href))), shell: !!await cache.match(new URL('index.html', location.href).href) };
  }, models.map(asset => asset.url));
  expect(cached.models).toEqual(models.map(() => true));
  expect(cached.shell).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#chapter-event')).toBeVisible();
  await navigate(page, 'codex');
  await openCard(page, 'mammoth');
  const viewer = page.locator('model-viewer');
  await expect.poll(() => viewer.evaluate(element => (element as HTMLElement & { loaded?: boolean }).loaded), { timeout: 25_000 }).toBe(true);
  await expect(page.locator('#model-credit')).toContainText('Smithsonian');
  await page.locator('.darwin-guide > summary').click();
  await page.locator('[data-guide-topic="diet"]').click();
  await expect(page.locator('.guide-answer q')).toHaveText(species.find(entry => entry.id === 'mammoth')!.diet);
  await closeCard(page);
  await navigate(page, 'journey');
  await page.locator('#start-inquiry').click();
  await page.locator('[data-inquiry="sea-and-family"]').click();
  await page.locator('input[value="2"]').check();
  await page.locator('.inquiry-question button[type="submit"]').click();
  await page.locator('#inquiry-text').click();
  await page.locator('#inquiry-continue').click();
  await page.locator('input[value="1"]').check();
  await page.locator('.inquiry-question button[type="submit"]').click();
  await page.locator('input[value="0"]').check();
  await page.locator('.inquiry-question button[type="submit"]').click();
  await expect(page.locator('#inquiry-export')).toBeVisible();
  await page.locator('#inquiry-finish').click();
  await navigate(page, 'lab');
  await page.locator('#comparison-prediction').selectOption('higher');
  await page.locator('#run-comparison').click();
  await expect(page.locator('.comparison-chart polyline')).toHaveCount(2);
  await expect(page.locator('.comparison-record')).toContainText('20261025');
  await context.setOffline(false);
});
