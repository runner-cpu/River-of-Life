# Final scoped re-review

Reviewed 2026-10-30 after the fix wave documented in `evidence/review-fixes.md`. Scope: the original five code-review findings, their fixes and new supporting helpers, plus the service-worker `Vary: Origin` matching and short-height sidebar changes. No broader feature audit was performed.

**Result: all five original findings are addressed. No unresolved material findings remain in this scoped re-review.**

| Original finding | Re-review result |
| --- | --- |
| Stale localStorage overrides newer IndexedDB | Addressed. `src/core/store.ts:106–128` reads and validates both records and compares their preserved revision timestamps. Mutations advance timestamps monotonically, including same-millisecond actions. Startup notices queue until a handler is attached. Invalid originals remain untouched during initialization and are copied to recovery keys before replacement. |
| Manual demo interactions mutate the real save | Addressed. `src/main.ts:49` checks `demoActive` centrally, so manual hotspot and resident-card entry points use a nonpersistent preview store. Timed/manual preview dialogs share the tracked close function; starting a demo also closes a prior normal specimen dialog. |
| Removed procedural models bypass disposal | Addressed. `src/scene/life-scene.ts:90` releases detached placeholder resources, and line 193 releases the procedural specimen object. `src/scene/resource-lifetime.ts` counts ownership per mesh, with resources deduplicated within each mesh, so geometry/material/texture caches shared by simultaneously live views are not disposed until the final owner releases them. Chapter changes stop and uncache old mixers; obsolete GLTF results are retained then immediately released. |
| Offline preparation waits indefinitely | Addressed. `src/core/offline.ts` bounds readiness and cache-response waits, observes installer failure, and closes ports/listeners. `src/main.ts:139–149` restores the button in `finally`, reports errors and permits registration retry. |
| Dialogs lack accessible names | Addressed. `src/core/ui.ts:18–19` generates a unique heading ID and assigns it through `aria-labelledby`. |

## Preservation edge case found and resolved during this re-review

The first version of the recovery fix cleared `invalidDatabase` after queuing its backup request. An aborted IndexedDB transaction rolled that backup back while leaving the in-memory flag cleared. A later successful save could then replace the invalid original without preserving it.

The follow-up now clears the flag only in `transaction.oncomplete`, with an identity check; transaction abort/error retains the pending original (`src/core/store.ts:140–149`). An independent probe exercised the actual GameStore with atomic queued-write simulation:

- First recovery transaction aborts: database `current` remains `{ "version": 1, "points": 50000 }`, with no committed backup.
- Next mutation commits: database `current` has 13 valid earned points, and a `recovery-*` record contains the original invalid 50000-point snapshot.
- Probe result changed from `invalidBackedUp: false` before correction to `invalidBackedUp: true` afterward.

The new store regression covers the same abort/retry sequence and checks preservation of the reading progress. The localStorage recovery path remains synchronous: a failed backup write prevents replacement of its original.

## Additional scoped fixes

- **Offline cache matching:** `public/sw.js:33–34,43` retains exact URL matching and ignores response `Vary` fields when checking this same-origin static-asset cache. It addresses the difference between module requests and `cache.add` requests on static hosts that emit `Vary: Origin`. No new issue found in this change.
- **Short-height sidebar:** the fixed sidebar now uses vertical overflow scrolling and nonshrinking children. This allows controls below the fold to remain reachable instead of being compressed/clipped. No new issue found in the changed CSS. Actual production browser geometry checks belong to the independent browser-verification run.

## Verification and limits

- Independently ran `npm test`: **45 tests passed across 4 files** (35 store, 4 offline, 2 resource ownership, 4 laboratory).
- Read the real-creature resource tests: shared factory geometry/materials survive a placeholder's release while a specimen owns them; unique geometry is disposed; final-owner disposal occurs once; repeated release is safe; a shared texture survives until its final material owner closes.
- Executed the focused aborted-IDB-transaction probe before and after the follow-up correction.
- Inspected the updated storage, demo routing, modal helper, offline helper, resource helper and call sites, service worker and sidebar CSS.
- No server or competing browser session was started. Build/typecheck and production browser results are reported separately by their executing tasks. This review does not claim GPU memory profiling, a screen-reader session or real-device AR testing.
- Only this report was written by the re-reviewer; application changes were made by the implementation task.
