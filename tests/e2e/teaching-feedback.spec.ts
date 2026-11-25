import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { inquiries } from '../../src/content/inquiries';
import { species } from '../../src/content/species';
import { questions } from '../../src/content/questions';
import { GameStore } from '../../src/core/store';

test.use({ serviceWorkers: 'block' });
const progress = (page: Page) => page.evaluate(async () => {
  const memory = (window as unknown as { __lifeDiagnostics: () => { progress: unknown } }).__lifeDiagnostics().progress;
  const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('life-museum', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  const saved = await new Promise(resolve => { const r = db.transaction('progress').objectStore('progress').get('current'); r.onsuccess = () => resolve(r.result); });
  db.close(); return { memory, saved, local: localStorage.getItem('life-museum-save-v1') };
});

for (const activity of inquiries) {
  test(`uncertain ${activity.id} keeps original judgment, explicit reference and historical ambiguity`, async ({ page }, testInfo) => {
    const width = activity.id === 'sea-and-family' ? 320 : 1440;
    await page.setViewportSize({ width, height: 1000 }); await page.goto('/');
    await page.locator('#start-inquiry').click();
    await page.locator('[data-inquiry="' + activity.id + '"]').click();
    const before = await progress(page);
    await page.locator('input[value="' + activity.uncertainClaim.answerIndex + '"]').check();
    await page.locator('.inquiry-question button[type="submit"]').click();
    await page.locator('#inquiry-text').click(); await page.locator('#inquiry-continue').click();
    await expect(page.getByRole('button', { name: '支持归类参照', exact: true })).toHaveCount(activity.cards.length);
    await expect(page.getByRole('button', { name: '反对归类参照', exact: true })).toHaveCount(activity.cards.length);
    await expect(page.getByRole('button', { name: '支持我的判断', exact: true })).toHaveCount(0);
    await expect(page.locator('.inquiry-reference')).toHaveText('归类参照：' + activity.uncertainClaim.proposition);
    await expect(page.locator('#inquiry-step')).toContainText(activity.initial.options[activity.uncertainClaim.answerIndex]);
    for (let i = 0; i < activity.cards.length; i++) await page.locator('[data-category="support"]').nth(i).click();
    await page.locator('#inquiry-show-graph').click();
    await expect(page.locator('.inquiry-graph')).toContainText('支持归类参照');
    await expect(page.locator('.inquiry-graph')).not.toContainText('支持我的判断');
    await expect(page.locator('.inquiry-graph .inquiry-reference')).toContainText(activity.uncertainClaim.proposition);
    expect(await page.locator('.modal-body').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    if (activity.id !== 'fins-and-land') await page.screenshot({ path: testInfo.outputPath(`uncertain-reference-${width}.png`) });
    await page.locator('#inquiry-transfer').click();
    await page.locator('input[value="' + activity.transfer.correct + '"]').check();
    await page.locator('.inquiry-question button[type="submit"]').click();
    const downloading = page.waitForEvent('download'); await page.locator('#inquiry-export-json').click();
    const record = JSON.parse(readFileSync((await (await downloading).path())!, 'utf8'));
    expect(record.classificationReference).toEqual({ kind: 'activity-claim', claimId: activity.uncertainClaim.id });
    expect(record.answers.initial).toBe(activity.uncertainClaim.answerIndex); expect(record.answers.evidence).toBeNull(); expect(record.version).toBe(1);
    const htmlDownload = page.waitForEvent('download'); await page.locator('#inquiry-export').click();
    const html = readFileSync((await (await htmlDownload).path())!, 'utf8');
    expect(html).toContain('支持归类参照'); expect(html).not.toContain('支持我的判断'); expect(html).toContain(activity.uncertainClaim.proposition); expect(html).toContain(activity.initial.options[record.answers.initial]);
    const legacy = { ...record }; delete legacy.classificationReference;
    await page.locator('#inquiry-peer-file').setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(legacy)) });
    await expect(page.locator('#inquiry-peer-status')).toContainText('已导入');
    await expect(page.locator('.inquiry-peer-column').nth(1)).toContainText('旧记录未记载归类参照');
    await expect(page.locator('.inquiry-peer-column').nth(1)).toContainText('支持归类参照');
    await expect(page.locator('.inquiry-peer-differences')).toContainText('同伴旧记录未记载归类参照');
    await expect(page.locator('.inquiry-peer-differences')).toContainText('无法确定双方归类参照是否一致');
    await expect(page.locator('.inquiry-peer-differences')).not.toContainText('归类参照不同');
    const accepted = await page.locator('#inquiry-peer-result').textContent();
    await page.locator('#inquiry-peer-file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...record, classificationReference: { kind: 'activity-claim', claimId: 'unknown' } })) });
    await expect(page.locator('#inquiry-peer-status')).toContainText('参照');
    await expect(page.locator('#inquiry-peer-result')).toHaveText(accepted!);
    expect(await progress(page)).toEqual(before);
  });
}

test('quick rounds cover unique species then new fields with reachable scoped feedback at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 }); await page.goto('/#quiz');
  const firstIds: string[] = [], residents: string[] = [];
  for (let i = 0; i < 6; i++) {
    const id = await page.locator('.question-card').getAttribute('data-question-id');
    const q = questions.find(q => q.id === id)!;
    firstIds.push(q.id); expect(residents).not.toContain(q.speciesId); residents.push(q.speciesId);
    await page.locator('[data-answer="' + q.correct + '"]').click();
    await expect(page.locator('#answer-feedback')).toContainText(species.find(s => s.id === q.speciesId)!.name);
    await expect(page.locator('#answer-feedback')).toContainText('核对范围');
    await expect(page.locator('#answer-feedback a').first()).toHaveAttribute('href', /^https:\/\//);
    await expect(page.locator('#quiz-feedback-heading')).toBeFocused();
    await page.keyboard.press('Tab'); await expect(page.locator('#answer-feedback a').first()).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#next-question').click();
  }
  await expect(page.locator('.quiz-complete')).toBeVisible(); await page.locator('#quiz-restart').click();
  const next = await page.locator('.question-card').getAttribute('data-question-id'); expect(firstIds).not.toContain(next);
});

for (const chapter of [1, 8]) {
  test(`timeline includes chapter ${chapter}, restores keyboard focus and awards no points`, async ({ page }) => {
    const fixture = new GameStore(species, questions, { persist: false });
    for (let id = 1; id < chapter; id++) {
      for (const s of species.filter(s => s.chapter === id).slice(0, 3)) { fixture.observe(s.id); fixture.read(s.id); }
      for (const q of questions.filter(q => q.chapter === id).slice(0, 3)) fixture.answer(q.id, q.correct);
      fixture.complete(id); fixture.unlock(id + 1);
    }
    fixture.setChapter(chapter);
    await page.addInitScript(raw => localStorage.setItem('life-museum-save-v1', raw), fixture.export());
    await page.goto('/#quiz'); await page.locator('[data-kind="timeline"]').click();
    const ids = await page.locator('.sort-item').evaluateAll(elements => elements.map(el => (el as HTMLElement).dataset.speciesId!));
    const selected = ids.map(id => species.find(s => s.id === id)!);
    expect(selected.some(s => s.chapter === chapter)).toBe(true);
    expect(new Set(selected.map(s => s.startMya)).size).toBe(selected.length);
    const desired = selected.sort((a, b) => b.startMya - a.startMya).map(s => s.id);
    for (let position = 0; position < desired.length; position++) {
      let current = (await page.locator('.sort-item').evaluateAll(elements => elements.map(el => (el as HTMLElement).dataset.speciesId!))).indexOf(desired[position]);
      while (current > position) {
        await page.locator('[data-move="' + current + ',-1"]').focus(); await page.keyboard.press('Enter'); current--;
        await expect(page.locator('[data-move="' + current + ',' + (current === 0 ? 1 : -1) + '"]')).toBeFocused();
      }
    }
    const before = await progress(page);
    await page.locator('#check-order').focus(); await page.keyboard.press('Enter');
    await expect(page.locator('#sort-feedback')).toContainText('顺序正确'); await expect(page.locator('#check-order')).toBeFocused();
    const after = await page.evaluate(() => (window as unknown as { __lifeDiagnostics: () => { progress: { points: number; totalEarned: number; badges: string[] } } }).__lifeDiagnostics().progress);
    const baseline = before.memory as { points: number; totalEarned: number };
    expect(after.points).toBe(baseline.points); expect(after.totalEarned).toBe(baseline.totalEarned); expect(after.badges).toContain('深时观察者');
    await page.locator('#check-order').click();
    expect((await progress(page)).memory).toEqual(after);
  });
}


for (const [field, label] of [['fact', '一个有趣的发现'], ['misconception', '换一个角度认识它']] as const) {
  test(`quiz ${field} feedback and explanation point to the opened card heading`, async ({ page }) => {
    const fixture = new GameStore(species, questions, { persist: false });
    questions.filter(q => q.chapter === 1 && q.field !== field).forEach(q => fixture.answer(q.id, q.correct));
    await page.addInitScript(raw => localStorage.setItem('life-museum-save-v1', raw), fixture.export());
    await page.goto('/#quiz');
    const id = await page.locator('.question-card').getAttribute('data-question-id');
    const question = questions.find(q => q.id === id)!;
    expect(question.field).toBe(field);
    await page.locator(`[data-answer="${question.correct}"]`).click();
    await expect(page.locator('#quiz-explanation')).toContainText(`展品卡“${label}”`);
    await expect(page.locator('#answer-feedback')).toContainText(`知识卡：${species.find(s => s.id === question.speciesId)!.name} · ${label}`);
    await page.locator('#quiz-card').click();
    await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
    await expect(page.locator(field === 'fact' ? '.fact-block:not(.misconception) p' : '.misconception p')).toHaveText(question.options[question.correct]);
  });
}
