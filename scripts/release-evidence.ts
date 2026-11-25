import { watch } from 'node:fs';
import { dirname, join } from 'node:path';
import type { FullConfig } from '@playwright/test';
import type { JSONReport, JSONReportSuite, JSONReportTest } from '@playwright/test/reporter';
import { completeSiteDigest, identityHashMethod } from './build-identity';
import { browserTestIdentities } from './browser-test-inventory';

export const releaseContentHashMethod = `${identityHashMethod} Covers every delivered site file, including sw.js and offline-manifest.json.`;

type ReleaseRunConfig = Pick<FullConfig, 'configFile' | 'metadata' | 'forbidOnly' | 'shard' | 'grep' | 'grepInvert'> & {
  projects: Pick<FullConfig['projects'][number], 'grep' | 'grepInvert' | 'testIgnore' | 'testMatch'>[];
};

// JSON serializes RegExp values as {}, so record filter status before serialization.
function unfiltered(config: ReleaseRunConfig): boolean {
  const defaultGrep = (grep: RegExp | RegExp[]) => grep instanceof RegExp && grep.source === '.*' && grep.flags === '';
  const defaultMatch = '**/*.@(spec|test).?(c|m)[jt]s?(x)';
  return config.forbidOnly && !config.shard && defaultGrep(config.grep) && config.grepInvert === null
    && config.projects.every(project => defaultGrep(project.grep) && project.grepInvert === null
      && Array.isArray(project.testIgnore) && project.testIgnore.length === 0
      && (project.testMatch === defaultMatch || (Array.isArray(project.testMatch)
        && project.testMatch.length === 1 && project.testMatch[0] === defaultMatch)));
}

// Playwright global setup returns a teardown that runs before the JSON reporter ends.
export default function captureReleaseEvidence(config: ReleaseRunConfig) {
  if (!config.configFile) throw new Error('Release browser evidence requires a production Playwright configuration file.');
  const root = join(dirname(config.configFile), 'dist');
  const metadata = config.metadata;
  metadata.releaseContentUnchanged = false;
  metadata.releaseRunUnfiltered = unfiltered(config);
  if (metadata.releaseContentSha256 !== completeSiteDigest(root)) {
    throw new Error('Production output changed after Playwright configuration loaded. Rebuild and rerun the full browser suite.');
  }
  let changed = false;
  // Observe writes/renames too: a change restored before teardown still invalidates evidence.
  const watcher = watch(root, { recursive: true }, () => { changed = true; });
  watcher.on('error', () => { changed = true; });
  return async () => {
    try {
      // Let queued filesystem events arrive before stopping observation.
      await new Promise<void>(resolve => setImmediate(resolve));
      metadata.releaseContentSha256AfterRun = completeSiteDigest(root);
      metadata.releaseContentUnchanged = !changed && metadata.releaseContentSha256AfterRun === metadata.releaseContentSha256;
      if (!metadata.releaseContentUnchanged) {
        throw new Error('Production output changed during the browser run. Rebuild and rerun the full browser suite.');
      }
    } finally {
      watcher.close();
    }
  };
}

/** The same fail-closed gate is used by packaging and release regression tests. */
export function verifyBrowserEvidence(value: unknown, releaseContentSha256: string, requiredSuites: readonly string[], expectedTestIdentities: readonly string[]): void {
  const report = value as JSONReport & { config: { argv?: string[] } };
  const metadata = report?.config?.metadata;
  if (!/^[a-f0-9]{64}$/.test(releaseContentSha256) || metadata?.releaseContentSha256 !== releaseContentSha256
    || metadata.releaseContentSha256AfterRun !== releaseContentSha256 || metadata.releaseContentUnchanged !== true) {
    throw new Error('Browser evidence must identify this production output and complete without output changes.');
  }
  const argv = report.config.argv;
  if (!Array.isArray(argv) || argv.length !== 3 || argv[2] !== 'test' || report.config.shard || report.config.forbidOnly !== true
    || metadata.releaseRunUnfiltered !== true || !Array.isArray(report.suites)
    || requiredSuites.length === 0 || requiredSuites.some(file => !report.suites.some(suite => suite.file === file))) {
    throw new Error('Run npm run test:e2e without filters or sharding before packaging.');
  }
  const stats = report.stats;
  const tests: JSONReportTest[] = [];
  const visit = (suite: JSONReportSuite): boolean => Array.isArray(suite.specs)
    && suite.specs.every(spec => spec.ok === true && Array.isArray(spec.tests) && spec.tests.length > 0
      && spec.tests.every(test => { tests.push(test); return true; }))
    && (suite.suites === undefined || (Array.isArray(suite.suites) && suite.suites.every(visit)));
  if (!report.suites.every(visit) || !Array.isArray(report.errors) || report.errors.length !== 0
    || !stats || !Number.isFinite(Date.parse(stats.startTime)) || !Number.isFinite(stats.duration) || stats.duration < 0
    || tests.length === 0 || stats.expected !== tests.length || stats.unexpected !== 0 || stats.flaky !== 0 || stats.skipped !== 0
    || requiredSuites.some(file => !report.suites.some(suite => suite.file === file && hasTests(suite)))
    || tests.some(test => test.status !== 'expected' || test.expectedStatus !== 'passed'
      || !Array.isArray(test.results) || test.results.length === 0
      || test.results.some(result => result.status !== 'passed' || !Array.isArray(result.errors) || result.errors.length !== 0 || result.error))) {
    throw new Error('A complete passing browser run without failures, flakes or skipped tests is required before packaging.');
  }
  const actual = browserTestIdentities(report);
  const expected = new Set(expectedTestIdentities);
  if (!expected.size || expected.size !== expectedTestIdentities.length || actual.length !== expected.size
    || new Set(actual).size !== actual.length || actual.some(identity => !expected.has(identity))) {
    throw new Error('Browser evidence test inventory differs from the current full test inventory (missing, duplicate or extra tests).');
  }
}

function hasTests(suite: JSONReportSuite): boolean {
  return suite.specs.some(spec => spec.tests.length > 0) || Boolean(suite.suites?.some(hasTests));
}
