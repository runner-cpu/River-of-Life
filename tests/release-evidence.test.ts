import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { completeSiteDigest } from '../scripts/build-identity';
import { browserTestIdentities, discoverBrowserTests } from '../scripts/browser-test-inventory';
import captureReleaseEvidence, { verifyBrowserEvidence } from '../scripts/release-evidence';
// Projected from the real 69-test Playwright JSON report dated 2026-11-12.
// Only display/diagnostic fields were removed; outcomes, nesting and counts are intact.
import recordedReport from './fixtures/release-browser-report.json';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const requiredSuites = recordedReport.suites.map(suite => suite.file);
const requiredTestIdentities = browserTestIdentities(recordedReport);
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'life-release-'));
  roots.push(root);
  const dist = join(root, 'dist');
  mkdirSync(dist);
  writeFileSync(join(dist, 'index.html'), 'site A');
  writeFileSync(join(dist, 'sw.js'), 'worker A');
  writeFileSync(join(dist, 'offline-manifest.json'), '["index.html"]');
  return { root, dist, digest: completeSiteDigest(dist) };
}
function reportFor(digest: string) {
  return { ...structuredClone(recordedReport), errors: structuredClone(recordedReport.errors) as { message: string }[], config: { ...structuredClone(recordedReport.config), metadata: {
    releaseContentSha256: digest, releaseContentSha256AfterRun: digest,
    releaseContentUnchanged: true, releaseRunUnfiltered: true,
  } } };
}
function runConfig(root: string, digest: string): Parameters<typeof captureReleaseEvidence>[0] {
  return {
    configFile: join(root, 'playwright.config.ts'), metadata: { releaseContentSha256: digest },
    forbidOnly: true, shard: null, grep: /.*/, grepInvert: null,
    projects: [{ grep: /.*/, grepInvert: null, testIgnore: [], testMatch: '**/*.@(spec|test).?(c|m)[jt]s?(x)' }],
  };
}

it('accepts the complete recorded passing report only for the same delivered content, regardless of file timestamps', () => {
  const { dist, digest } = fixture();
  const report = reportFor(digest);
  utimesSync(join(dist, 'index.html'), new Date('2030-01-01'), new Date('2030-01-01'));
  expect(completeSiteDigest(dist)).toBe(digest);
  expect(() => verifyBrowserEvidence(report, completeSiteDigest(dist), requiredSuites, requiredTestIdentities)).not.toThrow();
  writeFileSync(join(dist, 'index.html'), 'site B');
  const reportForB = reportFor(completeSiteDigest(dist));
  expect(() => verifyBrowserEvidence(reportForB, digest, requiredSuites, requiredTestIdentities)).toThrow('identify');
});

it.each(['sw.js', 'offline-manifest.json', 'extra-asset.js'])('rejects old evidence after changing only %s', file => {
  const { dist, digest } = fixture();
  const report = reportFor(digest);
  writeFileSync(join(dist, file), 'changed bytes');
  expect(() => verifyBrowserEvidence(report, completeSiteDigest(dist), requiredSuites, requiredTestIdentities)).toThrow('identify');
});

it.each([
  'identity', 'end identity', 'unfinished teardown', 'changed output', 'filter', 'shard', 'configuration filter',
  'focused tests allowed', 'missing suite', 'empty suite', 'incomplete count', 'flaky', 'skipped', 'failure', 'global error', 'row mismatch',
])('rejects %s in actual browser evidence', kind => {
  const { digest } = fixture();
  const report = reportFor(digest);
  switch (kind) {
    case 'identity': delete (report.config.metadata as Partial<typeof report.config.metadata>).releaseContentSha256; break;
    case 'end identity': delete (report.config.metadata as Partial<typeof report.config.metadata>).releaseContentSha256AfterRun; break;
    case 'unfinished teardown': report.config.metadata.releaseContentUnchanged = false; break;
    case 'changed output': report.config.metadata.releaseContentSha256AfterRun = 'b'.repeat(64); break;
    case 'filter': report.config.argv.push('--grep', 'one test'); break;
    case 'shard': Object.assign(report.config, { shard: { current: 1, total: 2 } }); break;
    case 'configuration filter': report.config.metadata.releaseRunUnfiltered = false; break;
    case 'focused tests allowed': report.config.forbidOnly = false; break;
    case 'missing suite': report.suites.pop(); break;
    case 'empty suite': report.suites[0] = { ...report.suites[0], specs: [], suites: [] }; break;
    case 'incomplete count': report.stats.expected++; break;
    case 'flaky': report.stats.flaky++; break;
    case 'skipped': report.stats.skipped++; break;
    case 'failure': report.stats.unexpected++; break;
    case 'global error': report.errors.push({ message: 'teardown failed' }); break;
    case 'row mismatch': report.suites[0].specs[0].tests[0].results[0].status = 'failed'; break;
  }
  expect(() => verifyBrowserEvidence(report, digest, requiredSuites, requiredTestIdentities)).toThrow();
});

it('captures start/end metadata through the configured Playwright setup and teardown', async () => {
  const { root, digest } = fixture();
  const config = runConfig(root, digest);
  const teardown = captureReleaseEvidence(config);
  expect(config.metadata.releaseContentUnchanged).toBe(false);
  expect(() => verifyBrowserEvidence({ ...reportFor(digest), config: { ...reportFor(digest).config, metadata: config.metadata } }, digest, requiredSuites, requiredTestIdentities)).toThrow();
  await teardown();
  const report = reportFor(digest);
  Object.assign(report.config.metadata, config.metadata);
  expect(() => verifyBrowserEvidence(report, digest, requiredSuites, requiredTestIdentities)).not.toThrow();
});

it('rejects an output change between config loading and run setup', () => {
  const { root, dist, digest } = fixture();
  writeFileSync(join(dist, 'sw.js'), 'new worker');
  expect(() => captureReleaseEvidence(runConfig(root, digest))).toThrow('configuration loaded');
});

it.each([false, true])('rejects output mutations during the run, including restored bytes: %s', async restore => {
  const { root, dist, digest } = fixture();
  const config = runConfig(root, digest);
  const teardown = captureReleaseEvidence(config);
  writeFileSync(join(dist, 'sw.js'), 'worker changed during run');
  if (restore) {
    await new Promise(resolve => setTimeout(resolve, 20));
    writeFileSync(join(dist, 'sw.js'), 'worker A');
  }
  await expect(teardown()).rejects.toThrow('during the browser run');
  expect(config.metadata.releaseContentUnchanged).toBe(false);
  const report = reportFor(digest);
  Object.assign(report.config.metadata, config.metadata);
  expect(() => verifyBrowserEvidence(report, digest, requiredSuites, requiredTestIdentities)).toThrow();
});

it('records configuration filters before the JSON reporter loses regular expressions', async () => {
  const { root, digest } = fixture();
  const config = runConfig(root, digest);
  config.projects[0].grep = /one test/;
  await captureReleaseEvidence(config)();
  expect(config.metadata.releaseRunUnfiltered).toBe(false);
  const report = reportFor(digest);
  Object.assign(report.config.metadata, JSON.parse(JSON.stringify(config.metadata)));
  expect(() => verifyBrowserEvidence(report, digest, requiredSuites, requiredTestIdentities)).toThrow('without filters');
});

it.each(['missing', 'duplicate', 'extra', 'wrong project'])('rejects %s test identities despite internally consistent passing totals', kind => {
  const { digest } = fixture();
  const report = reportFor(digest);
  const specs = report.suites[0].specs;
  expect(specs.length).toBeGreaterThan(1);
  switch (kind) {
    case 'missing': specs.pop(); report.stats.expected--; break;
    case 'duplicate': specs[1] = structuredClone(specs[0]); break;
    case 'extra': specs.push({ ...structuredClone(specs[0]), title: 'unrecognized test' }); report.stats.expected++; break;
    case 'wrong project': specs[0].tests[0].projectName = 'another-project'; break;
  }
  // The remaining file is nonempty and aggregate totals still match its rows.
  expect(specs.length).toBeGreaterThan(0);
  Object.assign(report.config.metadata, { claimedTestInventory: browserTestIdentities(report) });
  expect(() => verifyBrowserEvidence(report, digest, requiredSuites, requiredTestIdentities)).toThrow('test inventory');
});

function discoveryFixture(projects = ['chromium']) {
  const { root, digest } = fixture();
  const report = reportFor(digest);
  report.suites = [{ ...report.suites[0], specs: report.suites[0].specs.slice(0, 2), suites: [] }];
  report.stats.expected = 2;
  const cases = join(root, 'cases');
  mkdirSync(cases);
  const testModule = createRequire(import.meta.url).resolve('@playwright/test');
  const file = join(cases, report.suites[0].file);
  const source = `import { test } from ${JSON.stringify(testModule)};\n`
    + report.suites[0].specs.map(spec => `test(${JSON.stringify(spec.title)}, () => { throw new Error('Tests must only be listed'); });`).join('\n');
  writeFileSync(file, source);
  const config = join(root, 'playwright.config.cjs');
  writeFileSync(join(root, 'must-not-run.cjs'), "throw new Error('Setup and server must not run during test discovery');");
  writeFileSync(config, `module.exports = ${JSON.stringify({
    testDir: './cases', forbidOnly: true, projects: projects.map(name => ({ name })),
    globalSetup: './must-not-run.cjs', webServer: { command: 'node must-not-run.cjs', url: 'http://127.0.0.1:45999' },
  })};`);
  return { root, digest, report, file, source, config };
}

it('independently discovers the current source and rejects a previous report after a new case is added', () => {
  const { digest, report, file, source, config } = discoveryFixture();
  const suites = report.suites.map(suite => suite.file);
  const current = discoverBrowserTests(config);
  expect(current).toHaveLength(2);
  expect(() => verifyBrowserEvidence(report, digest, suites, current)).not.toThrow();
  writeFileSync(file, `${source}\ntest.describe('new group', () => { test('new case', () => {}); });`);
  const afterAddition = discoverBrowserTests(config);
  expect(afterAddition).toHaveLength(3);
  expect(afterAddition.some(identity => JSON.stringify(JSON.parse(identity)[2]) === '["new group","new case"]')).toBe(true);
  expect(() => verifyBrowserEvidence(report, digest, suites, afterAddition)).toThrow('test inventory');
});

it('discovers each configured project and refuses a report missing the other project', () => {
  const { digest, report, config } = discoveryFixture(['chromium', 'firefox']);
  const current = discoverBrowserTests(config);
  expect(current).toHaveLength(4);
  expect(new Set(current.map(identity => JSON.parse(identity)[0]))).toEqual(new Set(['chromium', 'firefox']));
  expect(() => verifyBrowserEvidence(report, digest, report.suites.map(suite => suite.file), current)).toThrow('test inventory');
});

it('fails closed when current-source discovery fails', () => {
  const { file, config } = discoveryFixture();
  writeFileSync(file, 'throw new Error("discovery failure");');
  expect(() => discoverBrowserTests(config)).toThrow('Cannot discover');
});
