import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import type { JSONReport, JSONReportSuite } from '@playwright/test/reporter';

/** Canonical identities include project, relative file and every describe/test title. */
export function browserTestIdentities(value: unknown): string[] {
  const report = value as JSONReport;
  const identities: string[] = [];
  function visit(suite: JSONReportSuite, titles: string[]) {
    for (const spec of suite.specs) {
      for (const test of spec.tests) {
        if (typeof test.projectName !== 'string' || typeof spec.file !== 'string' || !spec.file
          || typeof spec.title !== 'string' || !spec.title) throw new Error('Browser test identity is incomplete.');
        identities.push(JSON.stringify([test.projectName, spec.file.replaceAll('\\', '/'), [...titles, spec.title]]));
      }
    }
    for (const child of suite.suites ?? []) {
      if (typeof child.title !== 'string') throw new Error('Browser suite identity is incomplete.');
      visit(child, [...titles, child.title]);
    }
  }
  for (const suite of report.suites) visit(suite, []);
  return identities.sort();
}

/** Collect current source with Playwright itself, without running tests, setup or server. */
export function discoverBrowserTests(configFile = resolve('playwright.config.ts')): string[] {
  const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
  const config = resolve(configFile);
  const result = spawnSync(process.execPath, [cli, 'test', '--config', config, '--list', '--reporter=json'], {
    cwd: dirname(config), encoding: 'utf8', timeout: 30_000, maxBuffer: 16 * 1024 * 1024,
    // CLI reporter override plus empty output env prevents overwriting release evidence.
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: '', PLAYWRIGHT_JSON_OUTPUT_DIR: '', PLAYWRIGHT_JSON_OUTPUT_NAME: '' },
  });
  if (result.error || result.status !== 0) throw new Error(`Cannot discover the current full browser test inventory: ${result.error?.message ?? result.stderr ?? result.status}`);
  const report = JSON.parse(result.stdout) as JSONReport;
  if (!Array.isArray(report.errors) || report.errors.length) throw new Error('Current browser test discovery reported errors.');
  const inventory = browserTestIdentities(report);
  if (!inventory.length || new Set(inventory).size !== inventory.length) throw new Error('Current browser test inventory is empty or contains duplicate identities.');
  return inventory;
}
