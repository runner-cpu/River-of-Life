# Final implementation code review

Reviewed 2026-10-30. Read-only review of `docs/design-spec.md`, `src/main.ts`, `src/core/store.ts`, `src/core/ui.ts`, `src/scene/life-scene.ts`, all four `src/modes/` modules, `public/sw.js`, `vite.config.ts`, and the store/lab unit tests. Known model-count, real-device AR, external-LLM and simplified-lab limitations are excluded.

## Findings

### 1. [P1] A stale localStorage copy overrides newer IndexedDB progress

**Location:** `src/core/store.ts:110` (related write path at lines 118–119).

`init()` reads IndexedDB only when the localStorage value is absent. If localStorage starts rejecting writes while IndexedDB continues accepting them, every later session loads the older localStorage copy. Its next mutation overwrites the newer database record, permanently rolling back progress. A truthy but invalid localStorage record also prevents recovery from a valid database record. Startup warnings cannot alert the user in the actual app because `store.onNotice(toast)` is installed in `shell()` at `src/main.ts:38`, after `await store.init()` at line 185.

**Reproduction verified with an in-memory storage/IDB probe against the actual GameStore:** initialize a store, observe the first species (both stores contain 5 points), make subsequent localStorage writes throw a quota error, then read that species (IndexedDB now contains 8 points). Construct and initialize a second GameStore. Observed output:

```json
{"before":{"localPoints":5,"databasePoints":8,"databaseReadCount":1},"after":{"loadedPoints":5,"read":[],"databaseReadCount":1}}
```

Read and validate both backing records, select the latest valid record using the original saved timestamps, and preserve/recover invalid records rather than silently replacing the good copy. Queue notices until the shell is ready.

### 2. [P2] Manual interactions during the demo still mutate the real save

**Location:** `src/main.ts:76`, with demo scene substitution at line 168 and preview routing at lines 42–44.

The normal scene callback remains `s => openSpecies(s)` after `startDemo()` changes its chapter to Cambrian. Only timer-driven specimen dialogs explicitly pass `true` to use the isolated preview store. A manually clicked demo hotspot opens a real-store dialog and records observation/reading/collection if chapter 2 is unlocked. The demo continues running, so it can subsequently open its own dialog on top of the user's dialog. The chapter-1 resident cards beneath the scene likewise remain active on a fresh save.

**Reproduction:** unlock chapter 2 while leaving a resident unobserved; start the 90-second demo; click that resident's hotspot before second 25; read its card. The main points and save change while the demo bar still says the demo is running. On a fresh save, click an underlying chapter-1 resident card during the same interval to reproduce live-save mutation.

Route manual specimen interactions through a demo preview while the demo is active, or explicitly stop/take over the demo before allowing live-store interaction. Ensure the original dialog is also tracked/closed appropriately.

### 3. [P2] Removed procedural models bypass geometry/material disposal

**Location:** `src/scene/life-scene.ts:92` and `src/scene/life-scene.ts:194`.

When a reconstruction GLB replaces a procedural creature, `root.remove(body)` detaches the old body without `disposeObject(body)`. Subsequent chapter teardown traverses only attached content, so it can no longer release those resources. The procedural `SpecimenStage.dispose()` also stops controls and disposes the renderer without disposing `this.object` geometry/materials. Both paths create fresh objects repeatedly during normal museum browsing.

**Reproduction / inspection:** repeatedly switch an existing LifeScene between a chapter containing reconstruction assets and another chapter, waiting for models to load each time; previously rendered placeholders never receive geometry/material `dispose` calls. Repeatedly opening/closing a procedural species card exercises the second omission. The stage omission is directly visible by comparing it with the existing `disposeObject(this.content)` in LifeScene's own teardown. This review did not measure GPU memory or claim a device crash.

Dispose the detached placeholder at replacement time and the procedural stage object before disposing its renderer. Also stop old mixers when replacing a chapter.

### 4. [P2] Offline preparation has an indefinitely pending failure state

**Location:** `src/main.ts:133` (related registration failure swallowed at line 190).

The button is disabled before awaiting `navigator.serviceWorker.ready`. If the worker fails to install, `ready` remains pending rather than rejecting, so the catch branch never restores the button or explains the failure. The subsequent MessageChannel response also has no deadline. This is a user-visible failure precisely when offline preparation is needed after an installation/network/cache failure.

**Reproduction:** use a fresh production origin with no active worker; block `sw.js` or cause an asset requested by the worker's installation `cache.addAll()` to fail; load the app and click “准备离线展馆”. It remains at “正在保存展馆与模型…” with a disabled button indefinitely. This is a code-path reproduction, not an executed browser test in this review.

Track registration/install failures and provide bounded waits for both readiness and the cache reply, restoring the button and reporting retryable failure.

### 5. [P2] All generated dialogs lack an accessible name

**Location:** `src/core/ui.ts:16–18`.

The shared modal helper creates a native dialog with a visual `h2`, but never assigns `aria-labelledby` or `aria-label`. Consequently the dialog's accessible name is empty, affecting species, settings, classroom, and chapter-unlock dialogs. The visual title alone does not label a dialog in the accessibility tree.

**Reproduction:** open any species card or settings dialog and inspect the accessibility tree: role `dialog` has an empty name although a heading is displayed. Give each generated heading a unique ID and assign it through the dialog's `aria-labelledby` attribute. This finding is based on the generated markup; no screen-reader session was run.

## Validation inspected and performed

- `npm test` passed: 2 files, 32 tests (28 store and 4 lab tests).
- Store coverage includes one-time reward idempotence, locked/unknown content guards, atomic import rejection, finite-reward completion of all eight chapters and all 48 collections, preview persistence isolation, localStorage failure notices, and corrupted-local handling. It does not cover precedence/recovery between two existing backing stores or UI-level demo callbacks.
- Lab tests cover exact seeded replay, selection across multiple seeds, neutral-drift variance, and energy/population accounting.
- Executed the focused stale-localStorage/newer-IndexedDB probe above without modifying application files.
- Inspected SW install/activate/fetch/CACHE_ALL flow and build manifest generation. No full browser, assistive-technology, device-AR, or GPU memory test was performed by this reviewer.
- No application files changed. Findings refer to the implementation as reviewed; subsequent fixes should be rechecked independently.
