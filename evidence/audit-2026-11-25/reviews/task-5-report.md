# Task 5 implementation report — 2026-11-25

Status: DONE. Commit: `5a39c0a fix: bind browser release evidence to delivered content`.

## Implemented

- Added `scripts/release-evidence.ts`, a shared report validation gate and Playwright global setup with returned teardown. The packager calls this exact exported gate; regressions do not duplicate its implementation.
- `playwright.config.ts` computes `config.metadata.releaseContentSha256` from the actual `dist/` bytes at config load. The default global setup confirms these same bytes before testing.
- Setup initializes `releaseContentUnchanged` to false, records whether the resolved global/project test selection is unfiltered, and recursively observes `dist/` filesystem write/rename events. Teardown computes the final complete digest, records the result and throws if any observed mutation occurred or the final digest differs. An unfinished/failed teardown leaves evidence unacceptable.
- Packaging recomputes the complete digest from current delivered bytes, compares it with build verification and browser report identities, and verifies the copied package site's digest after copying. Removed the old manifest-only concatenation hash and index-file timestamp freshness dependency.
- `verify-build.ts` uses the shared hash-method description. Task 2's digest, worker revision, worker rendering and offline enumeration functions are reused unchanged. Release identity includes final `sw.js`, `offline-manifest.json` and every additional delivered file; the worker cache revision remains a separate calculation.
- Kept document release/PDF/source hash guards, copied-PDF review guard, material reference validation and per-file package hash checks intact. No package was generated.

## Interfaces and report lifecycle

`scripts/release-evidence.ts` exports:

- `releaseContentHashMethod: string` — Task 2's `identityHashMethod` plus the statement that every delivered site file is covered.
- `default captureReleaseEvidence(config)` — configured as Playwright's `globalSetup`. It accepts the needed resolved `FullConfig` fields and returns an async teardown.
- `verifyBrowserEvidence(value: unknown, releaseContentSha256: string, requiredSuites: readonly string[]): void` — throws unless the browser report proves the same current production content, completed teardown, a full unfiltered/unsharded run, all required spec files, positive consistent test counts, no report errors, and passing per-test/per-attempt results without flakes/skips/failures.

Expected Playwright JSON fields, all under `config.metadata`:

- `releaseContentSha256`: complete site digest at configuration load, checked again at global setup.
- `releaseContentHashMethod`: digest description from config.
- `releaseContentSha256AfterRun`: complete site digest at successful teardown calculation.
- `releaseContentUnchanged`: false at setup, true only when teardown observes no mutation and equal start/end content identities. Missing/false is rejected.
- `releaseRunUnfiltered`: selection captured from resolved config before JSON serialization loses RegExp contents; requires the default grep, no grep-invert/shard, default spec matcher, no ignore patterns, and `forbidOnly`.

The report gate also requires the ordinary unfiltered `node ... test` argv, no shard, and `forbidOnly`, and validates report errors, nested result rows and aggregate counts rather than trusting only the aggregate summary. Build `builtAt` and browser `startTime` remain informational rather than content identities.

Mutation-detection boundary: content is hashed at config load, checked at global setup, watched recursively from setup until teardown, then hashed again before the watcher closes. Observed writes/renames invalidate the run even when bytes are restored. Filesystem watcher errors also invalidate it. This is local filesystem observation and boundary comparison, not an adversarial continuous snapshot guarantee; changes wholly outside that interval are covered by the setup/package digest comparisons. The root's actual full browser run must verify these metadata fields survive the real JSON reporter lifecycle; this implementer did not run a browser.

## Tests and exact results

Focused commands only, as assigned:

1. Initial `npm exec vitest run tests/release-evidence.test.ts tests/build-identity.test.ts tests/competition-materials.test.ts`: exit 0; 3 files, 29 tests passed; duration 360 ms.
2. Initial `npm exec tsc -- --noEmit`: exit 1 with three typing errors (optional configFile, an overbroad fixture cast to FullConfig, and JSON empty-array inference for errors). Corrected those by guarding configFile, accepting a structural subset of resolved config fields, and explicitly typing report-error fixtures.
3. Final `npm exec vitest run tests/release-evidence.test.ts tests/build-identity.test.ts tests/competition-materials.test.ts`: exit 0; 3 files, 29 tests passed; start 14:09:36; duration 348 ms (transform 110 ms, import 152 ms, tests 224 ms).
4. Final `npm exec tsc -- --noEmit`: exit 0; no diagnostics.
5. `git diff --cached --check`: exit 0; no whitespace diagnostics.

The 25 new release tests use a compact projection of the actual historic 69-test Playwright JSON report from `evidence/history/2026-11-12/e2e-results.json`. Display/diagnostic fields were removed; nesting, test outcomes and counts were retained. This fixture remains under tests and the historic evidence was only read.

Covered: complete passing B report versus A digest rejection; matching A acceptance despite a future incidental index mtime; old reports rejected after only worker/manifest/additional-file byte changes; missing start/end identity; unfinished teardown; changed end identity; argv/config filtering; sharding; focused-test allowance; missing/empty suite; count mismatch; flaky/skipped/failing summaries; global teardown error; inconsistent failed attempt beneath a passing summary; setup/teardown metadata; config-to-setup mutation; in-run mutation; restored-byte mutation; filter capture before JSON RegExp loss.

TDD was not explicitly required for this task. No RED phase is claimed. Full build, full unit/browser suites, build verification, PDF regeneration/review, package creation and deployment remain root-owned and were not run by this implementer.

## Files changed in the scoped commit

- `playwright.config.ts`
- `scripts/release-evidence.ts`
- `scripts/verify-build.ts`
- `scripts/package-competition.ts`
- `tests/release-evidence.test.ts`
- `tests/fixtures/release-browser-report.json`

This report is in ignored `.superpowers/` as requested, outside the source commit. No root-owned docs, README, evidence or tmp files were edited or staged.

## Self-review and limitations

- Reviewed the committed diff and confirmed shared content identity replaces the legacy package hash, while original document/source/PDF/link/file-hash gates remain intact.
- Gate rejects incomplete teardown and global errors even when completed test rows appear passing. It cross-checks actual nested result rows against aggregate counts.
- No application runtime module, progress storage, inquiry exports, assets, scientific claims or dependencies changed.
- No known implementation defects or deferred code findings. Independent requirements/quality review and actual full Playwright JSON lifecycle validation remain for the root. No new competition package or current deployment evidence is claimed.

## Review fix round 1 — current complete test inventory

Commit: `69dbd90 fix: require the current full browser test inventory`.

Review input: `task-5-review.md`, Important finding that removing one test from a still-nonempty suite and decreasing the report count allowed incomplete evidence through. The original check trusted the report's own row count and only required a nonempty result for each file. That finding is corrected in this round.

### Design and changed interfaces

- Added `scripts/browser-test-inventory.ts` with `discoverBrowserTests(configFile?)`. Packaging invokes a fresh child process using the installed official Playwright CLI: `test --config <current config> --list --reporter=json`. Collection reads current source and resolved projects without executing test bodies, global setup or the web server. The child overrides the configured reporter and clears the three JSON output environment variables so collection emits JSON to stdout instead of overwriting browser evidence. Collection failures, report errors, zero cases and duplicate expected identities reject packaging.
- `browserTestIdentities(report)` produces sorted canonical JSON strings of `[projectName, normalized relative spec file, [...describeTitles, testTitle]]`. It reads identity from the real JSON suite/test shape and includes nested groups and the project rather than using only a file name or aggregate count. The historical regression fixture now retains these identity fields from the same real historic report.
- `verifyBrowserEvidence(report, digest, requiredSuites, expectedTestIdentities)` now requires the independently collected fourth argument. It compares the entire identity inventory and multiplicities, rejecting missing, duplicate and extra cases or changed projects. Report-side metadata claiming an inventory is ignored.
- `package-competition.ts` supplies `discoverBrowserTests()` directly to this gate. It does not use the tested report, its metadata or its counts as the authoritative expected inventory.
- Existing complete site digests, mutation/teardown checks, full/filtered/sharded/flaky/skipped checks, copied-site identity and all PDF/source/material/file-hash guards remain in place. No production build/browser/package was run in this fix round.

Root's actual-report probe should now call `verifyBrowserEvidence(report, completeSiteDigest('dist'), requiredSuites, discoverBrowserTests())`. The already-completed current browser report was read only; it contains equal start/end digests and both true flags, but this implementer did not claim the root integration gate on its behalf.

### Covering tests and exact results

- `npm exec vitest run tests/release-evidence.test.ts tests/build-identity.test.ts tests/competition-materials.test.ts`: exit 0; 3 files and 36 tests passed; start 14:18:21; duration 2.02 s.
- Initial round `npm exec tsc -- --noEmit`: exit 0, no diagnostics.
- After strengthening the duplicate test to replace an existing case while leaving counts unchanged, and adding an ignored report-metadata inventory claim, final `npm exec vitest run tests/release-evidence.test.ts`: exit 0; 1 file, 32 tests passed; start 14:19:17; duration 1.98 s.
- Final `npm exec tsc -- --noEmit`: exit 0, no diagnostics.
- `git diff --cached --check`: exit 0, no whitespace diagnostics.

The seven added regressions cover a missing test within a nonempty file with self-consistent totals; a duplicate replacing a distinct case with unchanged totals; an extra case with adjusted totals; a wrong project; a stale passing report after adding a new nested test to the same source file; all cases in two configured projects; and collection failure. The last three use actual Playwright CLI collection on small temporary source/config fixtures. Throwing test bodies, setup and server scripts prove collection does not execute those paths. None is a browser test run.

### Risks, review scope and deferred observation

- Inventory is collected from current executable test source when packaging starts. As with other local release checks, source/config should remain stable throughout the packaging invocation. This inventory check is not report authentication or a guarantee against adversarial filesystem races.
- Project names are part of the canonical identity. If projects intentionally share a name and identical tests, discovery rejects the resulting ambiguous duplicates rather than accepting indistinguishable results.
- The review's Minor observation about a rejected copy leaving a timestamped partial package directory is deliberately deferred to the root ledger/final review, as instructed. This round does not change output staging or create/remove any competition directory.
- No root-owned docs, README, evidence or tmp changes were made or staged. The source commit contains only the inventory helper, release gate, package call, focused tests and test fixture. Independent review of this correction remains root-owned.
