# Final review fixes

Implemented 2026-10-30 against `evidence/final-code-review.md`.

1. **Storage recovery:** startup reads and validates both localStorage and IndexedDB, then chooses the valid snapshot with the newest original `updatedAt`. Validation preserves that timestamp; new mutations advance it monotonically even within the same millisecond. Invalid records remain untouched during initialization and are copied to recovery keys before a later write replaces them. An invalid database snapshot remains pending until the recovery/current transaction completes, so abort/error cannot discard the source before the next backup attempt. Startup notices queue until `shell()` attaches its toast handler.
2. **Demo isolation:** all specimen entry points route to a nonpersistent preview store while the demo is active, including scene hotspots and the resident cards underneath it. Starting the demo closes any prior normal specimen dialog. Timed demo dialogs close the preceding manual/automatic preview, and takeover closes the tracked preview.
3. **GPU resources:** a shared mesh-resource ownership helper counts live geometry, material, and texture owners across ecosystem scenes and specimen stages. Reconstruction replacement releases its detached procedural placeholder; stage close releases its procedural object. Shared cached resources survive while another view still uses them, and the final owner disposes them once. Chapter replacement stops and uncaches old animation mixers. Late GLTF results are registered and immediately released when obsolete.
4. **Offline preparation:** registration/readiness has a 12-second deadline; the cache reply has a 45-second deadline. Failed registration, redundant installers, unsupported service workers, silent cache replies and failed replies produce retryable status text; the button is restored in `finally`, and MessageChannel ports/listeners are cleaned up. The same-origin service worker asset cache uses exact URL matching with `ignoreVary: true`, because static hosts can return `Vary: Origin` while serving identical local files; this avoids module requests missing assets cached through `cache.add`.
5. **Dialog names:** each modal heading gets a unique ID, referenced by that dialog's `aria-labelledby`.
6. **Short desktop sidebar:** the fixed sidebar now scrolls vertically, with nonshrinking children, so classroom/settings remain reachable at 1280×720 and shorter heights.

## Checks performed

- `npm test` — passed, 4 files / 45 tests (35 store, 4 offline, 2 resource ownership, 4 laboratory).
- `npx tsc --noEmit` — passed.
- Storage regressions execute actual `GameStore.init` and mutation paths with independent in-memory backing stores: stale local/newer database after quota failures across sessions; newer local/older database; same-millisecond actions; malformed and semantically invalid local input with valid database recovery; invalid database with valid local recovery; preserved recovery copies; aborted recovery transaction followed by a successful mutation retaining the original backup; queued startup notices.
- Resource tests create real procedural creatures with shared factory caches, detach an ecosystem placeholder while a specimen still owns the same cached geometry/material, and verify unique-resource disposal, final-owner disposal, idempotent teardown, and texture lifetime across distinct materials.
- Offline unit tests exercise indefinitely pending readiness, failed registration, installer redundancy and a silent cache channel with finite deadlines and closed ports.

Production build and browser regression results are recorded separately by the browser verification task. No claim of measured GPU memory, assistive-technology testing, real-device AR, or external LLM integration is made here. No commit was created.
