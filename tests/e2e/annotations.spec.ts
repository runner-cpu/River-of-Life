import { test, expect, type Page } from "@playwright/test";
import { species } from "../../src/content/species";
const snapshot = (page: Page) =>
  page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("life-museum", 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const saved = await new Promise<unknown>((resolve, reject) => {
      const r = db
        .transaction("progress")
        .objectStore("progress")
        .get("current");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    db.close();
    return {
      memory: (
        window as unknown as { __lifeDiagnostics: () => unknown }
      ).__lifeDiagnostics(),
      local: localStorage.getItem("life-museum-save-v1"),
      indexed: saved,
    };
  });

async function open(page: Page, id: string) {
  await page.goto("/#relationships");
  await page.getByRole("button", { name: "分组列表", exact: true }).click();
  const s = species.find((s) => s.id === id)!;
  await page.locator(`[data-epoch="${s.chapter}"]`).click();
  await page.locator(`[data-archive="${id}"]`).click();
  await page.locator("#relationship-open").click();
}
for (const id of ["archaeopteryx", "mosasaurus", "tiktaalik"])
  test(`annotations ${id} keyboard and projection`, async ({ page }) => {
    await open(page, id);
    await expect(page.locator("#model-stage")).toHaveAttribute(
      "data-state",
      id === "tiktaalik" ? "diagram" : "loaded",
    );
    await expect(page.locator("#toggle-annotations")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    const ledgerBefore = await snapshot(page);
    await page.locator("#toggle-annotations").click();
    await expect(page.locator(".annotation-hotspot")).toHaveCount(3);
    if (id === "mosasaurus") {
      await expect(
        page.locator(".annotation-hotspot[data-surface]"),
      ).toHaveCount(3);
      await page.locator("model-viewer").evaluate((el: any) => {
        el.currentTime = 2;
        el.pause();
      });
      await page.screenshot({
        path: "evidence/annotations-mosasaurus-animation-2.png",
        fullPage: true,
      });
      await page.locator("model-viewer").evaluate((el: any) => {
        el.currentTime = 6;
      });
      await page.screenshot({
        path: "evidence/annotations-mosasaurus-animation-6.png",
        fullPage: true,
      });
    }
    for (const button of await page.locator(".annotation-hotspot").all()) {
      await button.focus();
      await page.keyboard.press("Enter");
      await expect(page.locator(".annotation-description")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(button).toBeFocused();
      await expect(page.locator("dialog")).toBeVisible();
    }
    await page.locator("#toggle-annotations").click();
    await page.locator("#toggle-annotations").click();
    await expect(
      page.locator('.annotation-list button[aria-expanded="true"]'),
    ).toHaveCount(0);
    await page.locator(".annotation-list button").first().click();
    await page.screenshot({
      path: `evidence/annotations-${id}-external.png`,
      fullPage: true,
    });
    expect(await snapshot(page)).toEqual(ledgerBefore);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(page.locator(`[data-archive="${id}"]`)).toBeFocused();
  });
test.describe("fallback", () => {
  test.use({ serviceWorkers: "block" });
  for (const id of ["archaeopteryx", "mosasaurus", "tiktaalik"])
    test(`annotations ${id} diagram fallback`, async ({ page }) => {
      await page.route("**/models/manifest.json", (r) => r.abort());
      await open(page, id);
      await expect(page.locator("#model-stage")).toHaveAttribute(
        "data-state",
        "fallback",
      );
      await page.locator("#toggle-annotations").click();
      await expect(page.locator(".annotation-hotspot")).toHaveCount(3);
      const mark = page.locator(".annotation-hotspot").first();
      const before = await mark.getAttribute("style");
      await page.locator("#rotate-model").click();
      await expect.poll(() => mark.getAttribute("style")).not.toBe(before);
      await page.locator("#rotate-model").click();
      await page.locator(".annotation-list button").first().click();
      await page.screenshot({
        path: `evidence/annotations-${id}-fallback.png`,
        fullPage: true,
      });
      await page.unroute("**/models/manifest.json");
      await page.locator("#retry-model").click();
      await expect(page.locator("#model-stage")).toHaveAttribute(
        "data-state",
        id === "tiktaalik" ? "diagram" : "loaded",
      );
      await expect(page.locator(".annotation-hotspot")).toHaveCount(3);
      await expect(page.locator(".annotation-description")).toContainText(
        id === "archaeopteryx"
          ? "扫描"
          : id === "mosasaurus"
            ? "艺术复原"
            : "结构示意",
      );
      await expect(
        page.locator(".annotation-list button").first(),
      ).toHaveAttribute("aria-expanded", "true");
    });
});
for (const width of [390, 320])
  test(`annotations ${width}px readable without overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await open(page, "tiktaalik");
    await expect(page.locator("#model-stage")).toHaveAttribute(
      "data-state",
      "diagram",
    );
    await page.locator("#toggle-annotations").click();
    await page.locator(".annotation-list button").last().click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator(".annotation-hotspot")
        .first()
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
    await page.screenshot({
      path: `evidence/annotations-${width}.png`,
      fullPage: true,
    });
    await page.locator(".annotation-close").scrollIntoViewIfNeeded();
    await expect(page.locator(".annotation-description a")).toBeInViewport();
    await expect(page.locator(".annotation-close")).toBeInViewport();
    await page.screenshot({
      path: `evidence/annotations-${width}-description.png`,
    });
  });
test("no annotation data explains disabled switch", async ({ page }) => {
  await open(page, "trilobite");
  await expect(page.locator("#toggle-annotations")).toBeDisabled();
  await expect(page.locator(".annotation-caution")).toContainText("尚无经核对");
});

test("production prepared cache supports offline annotations and first Escape", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  await page.goto("/#relationships");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await page.locator("#settings").click();
  await page.locator("#cache-offline").click();
  await expect(page.locator("#offline-status")).toContainText(
    "展馆、知识卡与本地模型已缓存",
    { timeout: 60000 },
  );
  await page.keyboard.press("Escape");
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "分组列表", exact: true }).click();
  const s = species.find((s) => s.id === "archaeopteryx")!;
  await page.locator(`[data-epoch="${s.chapter}"]`).click();
  await page.locator('[data-archive="archaeopteryx"]').click();
  const before = await snapshot(page);
  await page.locator("#relationship-open").click();
  await expect(page.locator("#model-stage")).toHaveAttribute(
    "data-state",
    "loaded",
  );
  await page.locator("#toggle-annotations").click();
  await page.locator(".annotation-list button").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".annotation-description")).toContainText(
    "核对范围",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".annotation-description")).toBeHidden();
  await expect(page.locator(".annotation-list button").first()).toBeFocused();
  await page.keyboard.press("Escape");
  expect(await snapshot(page)).toEqual(before);
  await context.setOffline(false);
});
test.describe("no 3D", () => {
  test.use({ serviceWorkers: "block" });
  test("equivalent text remains when WebGL and model load unavailable", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.getContext = (() =>
        null) as typeof HTMLCanvasElement.prototype.getContext;
    });
    await page.route("**/models/manifest.json", (r) => r.abort());
    await open(page, "tiktaalik");
    await expect(page.locator("#model-stage")).toHaveAttribute(
      "data-state",
      "unavailable",
    );
    await page.locator("#toggle-annotations").click();
    await expect(page.locator(".annotation-hotspot")).toHaveCount(0);
    await expect(page.locator(".annotation-list button")).toHaveCount(3);
    await page.locator(".annotation-list button").first().click();
    await expect(page.locator(".annotation-description")).toContainText("颅骨");
  });
});
