### Spec compliance

❌ Issues found. A fully prepared fallback can fail to open offline when the cache is full. The upgrade also retains partial downloads from failed releases, which can prevent another upgrade from succeeding under the same quota.

### Strengths

- Installation leaves existing pages on A while B waits. It fetches all B files afresh when the previous manifest is complete, hashes the response bodies, and retires only revision caches belonging to the exact registration scope (`public/sw.js:13`, `public/sw.js:31`, `public/sw.js:55`, `public/sw.js:71`).
- The browser fixture exercises old and new documents fetching different model bytes from the same URL. The worker harness independently reconstructs the worker against persistent caches (`tests/e2e/offline-upgrade.spec.ts:82`, `tests/service-worker.test.ts:103`).
- Download progress accepts only increasing counts against a consistent total, alongside independent inactivity and absolute timers and port cleanup (`src/core/offline.ts:29`, `src/core/offline.ts:45`, `src/core/offline.ts:55`). Worker template changes affect the revision, and the complete release digest covers the delivered worker and manifest (`scripts/build-identity.ts:24`, `scripts/build-identity.ts:28`, `scripts/verify-build.ts:10`).

### Issues

- **Important — fallback navigation requires a successful cache write.** `public/sw.js:85` persists a client pin before serving cached HTML. A focused in-memory run of the actual worker completed A after B installed, activated B offline, then rejected new cache writes. A fresh navigation failed with `QuotaExceededError` while the A cache still returned its intact HTML. Each fallback navigation also leaves a pin until that release cache is retired. Make A the safe default for unidentified clients and persist the selection of B before handing B to a new client. If that write fails, serve A. Keep open documents coherent across recovery and restart. Add a quota case covering navigation and its later model request.
- **Important — failed installations strand release caches.** `public/sw.js:56` creates B’s cache and `public/sw.js:49` writes each verified asset immediately. A fetch, hash, quota or manifest failure skips activation and therefore skips cleanup at `public/sw.js:71`. If a distinct C release replaces the failed B, B’s partial download can leave too little free space to hold A and C even when those two releases alone would fit. Safely remove an installation cache created by the failed attempt, while preserving any existing cache in use (including a matching rollback revision). Add a focused A → failed B → C capacity test. The existing case at `tests/service-worker.test.ts:94` checks A survives but does not check abandoned B storage.
- **Minor — test runner environment.** The implementer reported Playwright color-environment warnings with both Chromium cases passing (`task-2-report.md:27`). The indication concerns terminal output coloring. Align runner color settings if warning-free logs are required.

### Cross-task verification

⚠️ The fresh full build, production browser matrix, and Task 5 reuse of the identity helpers remain for the parent. This diff enumerates the delivered files (`scripts/build-identity.ts:18`, `vite.config.ts:10`). Personal save migration, inquiry export compatibility, classroom isolation, question and reward stability, and preservation of existing report/recovery archives span other tasks. The Task 2 diff touches only settings download feedback in the main application (`src/main.ts:241`). The implementer reports 14 targeted unit tests and two browser passes. The independent review ran only the new fallback-quota probe.

### Code quality

**Needs fixes.** The worker handles normal upgrade ordering and byte verification well. Under storage pressure it can both deny reads of a complete release and retain partial downloads that block future updates.
