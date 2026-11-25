# Task 2 implementation report

Commit `c3187f8` preserves complete offline releases across worker updates.

## Behavior

A visitor with only the app shell receives a shell update. When an older release is completely cached, installation downloads and verifies every file in the new release before B starts waiting. The worker recognizes legacy caches using the stored manifest and the presence of each listed URL. New downloads use the hashes embedded in their worker. A model that still has the same URL but now belongs to another release cannot enter the old cache. Installation failure leaves the active release intact. Cache retirement matches only revision caches for this registration’s exact path.

Activation checks completeness again. If A finished after B started waiting and B still lacks models, B durably records A as its fallback. No network is necessary for activation or a fallback navigation. When connectivity returns, the existing “prepare offline” action downloads B within the normal time budget and records its completion. The next navigation uses B immediately, even offline. A fallback document’s client ID is recorded when serving its navigation, so its later resource requests keep using A across a restart and while B documents are open. The fallback cache is retained until a later worker activates and safely retires it. This can temporarily cost one additional release of storage. Offline availability still depends on the browser retaining its CacheStorage. Files preserved by a legacy worker can be checked for presence, but the legacy manifest contains no original content hashes.

An opportunistic write that fails for lack of storage leaves the successful network response usable. Explicit preparation still reports failure. The progress UI allows 90 seconds of inactivity per item and ten minutes overall. Only newly completed items in a single consistent total renew the inactivity timer. All reply handlers, both ports, readiness listeners, and timers are released on settlement.

`scripts/build-identity.ts` exports `completeSiteDigest(root)`, `serviceWorkerRevision(root, template)`, `offlineAssetHashes(root)` and `renderServiceWorker(template, revision, assets)`. Full site evidence includes every delivered file, including the final worker and offline manifest. Build verification independently reconstructs and checks the worker and manifest and records `serviceWorkerRevision` separately. The worker template directly participates in the cache revision.

## Files

- `public/sw.js`, `src/core/offline.ts`, `src/main.ts` implement the update and download behavior.
- `vite.config.ts`, `scripts/build-identity.ts`, `scripts/verify-build.ts` implement build identity and evidence.
- `tests/service-worker.test.ts`, `tests/build-identity.test.ts`, `tests/offline.test.ts`, `tests/e2e/offline-upgrade.spec.ts` cover the regressions.

## Tests

RED `node_modules/.bin/vitest.cmd run tests/service-worker.test.ts tests/offline.test.ts --reporter=dot` gave **7 failed, 5 passed** against the initial implementation. B lacked `models/shared.glb`, a failed full migration unexpectedly resolved, late offline activation returned `B index.html` instead of `A index.html`, and a quota rejection discarded a successful network fetch. Progress tests observed the initial deadline firing during active transfer, four callbacks for one valid advance, and the inactivity error in place of the required absolute limit. The initial build identity test failed to import the missing helper.

GREEN `node_modules/.bin/vitest.cmd run tests/service-worker.test.ts tests/offline.test.ts tests/build-identity.test.ts --reporter=dot` gave **3 files passed, 14 tests passed**. The final run included a wrong-release model rejection and a successful retry after the matching bytes returned. `node_modules/.bin/tsc.cmd --noEmit` exited 0. `git diff HEAD^ HEAD --check` exited 0.

Chromium `node_modules/.bin/playwright.cmd test tests/e2e/offline-upgrade.spec.ts --reporter=line --output=.superpowers/sdd/2026-11-25-audit-remediation/task-2-browser-check` gave **2 passed (6.1s)** on the delivered commit. Both cases exercised a disposable localhost server, production worker rendering, actual registration updates, real tab closure and true browser offline mode. The late case additionally kept the original fallback document open and read A’s model alongside a new B tab reading B’s model from the same URL. Unit coverage recreates the worker global against persistent caches to exercise worker restarts deterministically. Only the Playwright runner’s color-environment warnings appeared. Full build, unit suite and production browser suite remain assigned to the parent.

## Review fix round 1 — `a07a93c`

Quota exhaustion exposed three failures in `c3187f8`. It could prevent activation from recording the fallback, prevent a fallback navigation from recording its client, and strand a partial B cache that consumed the space required by C.

`public/sw.js` now reserves possible fallback entries during shell installation. Activation checks cached manifests again and keeps the entry for the complete fallback solely by deleting the other candidates. Serving A needs no write, including after a worker restart. Once preparation finishes, a new navigation receives B after the worker successfully persists its client ID. A failed write or missing ID serves A. Already-open documents continue reading their original release across worker restarts. The worker retains client pins in B’s cache until that cache retires. A failed installation deletes its target cache only when it created that cache. A preexisting cache for the same revision survives rollback attempts.

`tests/service-worker.test.ts` covers full storage before and after activation, fresh workers reading each document’s shell and models, navigation with no client ID, and recovery once quota is available. A capacity test allocates exactly enough entries for complete A, complete C, and an unrelated cache. It makes B fail after several verified writes and then installs C. A separate rollback test checks the identity and contents of an existing matching cache after verification fails.

Before the fix, `node_modules/.bin/vitest.cmd run tests/service-worker.test.ts --reporter=dot` produced **3 failed, 6 passed**. The failures were `Error: quota` during activation, navigation and C installation. After the fix, `node_modules/.bin/vitest.cmd run tests/service-worker.test.ts tests/offline.test.ts tests/build-identity.test.ts --reporter=dot` produced **3 files passed, 18 tests passed**. `node_modules/.bin/tsc.cmd --noEmit` and `git diff --cached --check` exited 0. After removing `Env:NO_COLOR` from the runner process, `node_modules/.bin/playwright.cmd test tests/e2e/offline-upgrade.spec.ts --reporter=line --output=.superpowers/sdd/2026-11-25-audit-remediation/task-2-browser-check` reported **2 passed (6.2s)** with no warnings. Quota injection is covered by the real worker in the CacheStorage harness. Chromium covers registration, offline navigation, recovery and simultaneous A/B documents.
