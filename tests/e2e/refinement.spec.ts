import {test,expect} from '@playwright/test';
import {questions} from '../../src/content/questions';

test.use({serviceWorkers:'block'});

test('browser back and forward preserve navigation, filters and close obsolete dialogs',async({page})=>{
  await page.goto('/');await page.locator('[data-mode="codex"]').click();await page.locator('#codex-search').fill('始祖鸟');
  await page.locator('[data-mode="lab"]').click();await page.locator('#help').click();await expect(page.locator('.help-dialog')).toBeVisible();
  await page.goBack();await expect(page).toHaveURL(/#codex$/);await expect(page.locator('dialog')).toHaveCount(0);
  await expect(page.locator('#codex-search')).toHaveValue('始祖鸟');await expect(page.locator('#codex-results')).toContainText('1 个');
  await expect(page).toHaveTitle('物种图鉴 · 生命长河');await page.goBack();await expect(page).toHaveURL(/#journey$/);
  await page.goForward();await expect(page.locator('[data-mode="codex"]')).toHaveAttribute('aria-current','page');
});

test('first catalog observation immediately synchronizes count, card label and keyboard focus',async({page})=>{
  await page.goto('/#codex');const card=page.locator('[data-codex-id="cyanobacteria"]');
  await card.click();await page.locator('.close-modal').click();
  await expect(page.locator('#codex-collected-count')).toHaveText('1');await expect(card.locator('.codex-card-bottom')).toContainText('已收藏');
  await expect(card).toBeFocused();await page.locator('[data-filter="collected"]').click();await expect(page.locator('.codex-card')).toHaveCount(1);
});

test('a failed model catalog can recover without a page reload and without false attribution',async({page})=>{
  await page.route('**/models/manifest.json',route=>route.abort());await page.goto('/#codex');
  await page.locator('[data-codex-id="archaeopteryx"]').click();await expect(page.locator('#model-stage')).toHaveAttribute('data-state','fallback');
  await expect(page.locator('#model-credit')).toContainText('原创结构示意');
  await page.unroute('**/models/manifest.json');await page.locator('#retry-model').click();
  await expect(page.locator('#model-stage')).toHaveAttribute('data-state','loaded');await expect(page.locator('#model-credit')).toContainText('Smithsonian');
});

test('quiz feedback names the selected and correct choices and keeps a keyboard path forward',async({page})=>{
  await page.setViewportSize({width:320,height:640});await page.goto('/#quiz');const q=questions.find(q=>q.chapter===1)!;
  await page.locator(`[data-answer="${(q.correct+1)%q.options.length}"]`).click();
  await expect(page.locator('.answers .correct')).toContainText('本题答案');await expect(page.locator('.answers .incorrect')).toContainText('你的选择');
  await expect(page.locator('#quiz-feedback-heading')).toBeFocused();await page.keyboard.press('Tab');await expect(page.locator('#next-question')).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#next-question').click();await expect(page.locator('.question-card h2')).toBeFocused();
  await page.locator('[data-kind="match"]').click();await expect(page.locator('.match-list select').first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('opening a guide pauses the experiment and only an explicit action resumes it',async({page})=>{
  await page.clock.install();await page.goto('/#lab');await page.locator('#lab-play').click();await page.clock.fastForward(1000);
  const before=await page.locator('#generation').textContent();expect(Number(before)).toBeGreaterThan(0);
  await page.locator('#help').click();await expect(page.locator('#lab-play')).toHaveAttribute('aria-pressed','false');
  await page.clock.fastForward(5000);await expect(page.locator('#generation')).toHaveText(before!);
  await page.locator('.help-dialog .close-modal').click();await expect(page.locator('#lab-run-status')).toContainText('已暂停');
  await page.clock.fastForward(1000);await expect(page.locator('#generation')).toHaveText(before!);
  await page.locator('#lab-step').click();await expect(page.locator('#generation')).toHaveText(String(Number(before)+1));
});

test('help offers working inquiry and settings routes without modifying personal learning',async({page})=>{
  await page.goto('/');const before=await page.evaluate(()=>localStorage.getItem('life-museum-save-v1'));
  await page.locator('#help').click();await page.locator('[data-help="onInquiry"]').click();await expect(page.locator('.inquiry-topics')).toBeVisible();
  await page.locator('.close-modal').click();await page.locator('#help').click();await page.locator('[data-help="onSettings"]').click();
  await expect(page.locator('#cache-offline')).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('life-museum-save-v1'))).toBe(before);
});
