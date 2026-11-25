# Task 3 implementation report

Date: 2026-11-25. Workspace: `C:/Users/runner/.codex/worktrees/interaction-enhancement/life`. Base: `a07a93c` on `codex/interaction-enhancement`.

Commit: `14374c9` — `Release shared bitmap allocations and laboratory input listeners` (four scoped implementation/test files).

## Implementation

- Kept the existing `retainObjectResources` / `releaseObjectResources` interface and per-object resource ownership. Added a separate reference count for the underlying `ImageBitmap`, captured when the first owner retains a texture wrapper. Multiple texture wrappers sharing the same bitmap each contribute one bitmap reference; multiple owners of one wrapper keep that wrapper and its bitmap alive until its last owner releases it. The final bitmap reference calls `close()` once. Releasing an object twice remains a no-op.
- Bitmap recognition uses a guarded `image instanceof ImageBitmap`, not the presence of an arbitrary `close` method. Ordinary image sources and unrelated objects with `close` are left alone. Bitmap image arrays are deduplicated per texture wrapper as well.
- Kept existing geometry/material, shadow-target and skeleton reference counts. Lazy bone texture disposal stays with `Skeleton.dispose()`, so a bone texture created after retain is still disposed on the final skeleton release.
- Named the laboratory's delegated input handler and removed it in the returned cleanup function. Existing interval cancellation, observer disconnection and visibility listener removal remain in that cleanup.
- Added a dedicated browser regression that instruments input listener addition/removal on the persistent `#main-content`, enters/leaves the laboratory three times, checks the retained listener count returns to baseline after every departure, and counts exactly one current comparison DOM update per drought input.

## Late GLTF completion ownership examination

Inspected `src/scene/life-scene.ts` without changing it. Its GLTF success callback calls `retainObjectResources(gltf.scene)` before checking `destroyed` and the chapter generation. A stale completion immediately calls `releaseObjectResources(gltf.scene)` and returns. Thus, late decoded bitmap allocations now enter the same retain/release accounting as successfully mounted model resources. Invalid model placement also releases that retained scene in its catch path. Successfully mounted model meshes keep their existing owner entries when moved under the chapter content; later chapter release traverses and releases them. No extra retain is introduced and no loader edit was necessary.

## Validation and exact results

1. RED: `npx vitest run tests/resource-lifetime.test.ts` after adding regressions and before changing runtime resource accounting exited 1. Result: 2 failed, 4 passed. Both new bitmap assertions expected `close` once but received 0 calls, demonstrating the existing code only disposed texture wrappers.
2. GREEN: `npx vitest run tests/resource-lifetime.test.ts` exited 0. Result: 1 file passed, 6/6 tests passed, duration 218 ms, no warnings. Covers distinct wrappers/shared bitmap, shared wrapper/two owners, double release, ordinary images/unrelated close, shared procedural geometry/material and removed placeholders, lazy bone textures, and lazy shadow targets.
3. `npx tsc --noEmit` exited 0 with no output. Includes the new Playwright test under the existing tsconfig.
4. `npm test` exited 0. Result: 25/25 files passed, 195/195 tests passed, duration 857 ms, no warnings.
5. `git diff --check -- src/modes/lab-view.ts src/scene/resource-lifetime.ts tests/resource-lifetime.test.ts tests/e2e/lab-lifecycle.spec.ts` exited 0 with no output. An earlier unrestricted diff check produced only line-ending notices for root-owned documentation; it found no whitespace errors.
6. Browser regression execution and production build remain pending the root agent's final build/browser validation, as explicitly assigned. Intended focused command after that build: `npx playwright test tests/e2e/lab-lifecycle.spec.ts --project=chromium`. No browser pass, memory saving, FPS improvement, or device performance measurement is claimed here.

## Changed task files

- `src/modes/lab-view.ts`
- `src/scene/resource-lifetime.ts`
- `tests/resource-lifetime.test.ts`
- `tests/e2e/lab-lifecycle.spec.ts`
- This report, `.superpowers/sdd/2026-11-25-audit-remediation/task-3-report.md` (local orchestration report; repository ignores `.superpowers`).

## Self-review and ownership limits

- Reviewed the full scoped diff and the loader's late completion control flow. No unrelated cleanup, runtime dependency, storage schema, progress behavior, exports, asset generation, or offline resource enumeration changes were introduced. The only runtime edits are to already-enumerated modules.
- Existing retained-object ownership assumes material texture bindings and texture image sources stay fixed while retained. Bitmap identity is captured at first texture retain so disposal releases that owned allocation rather than an unrelated later replacement. Runtime swapping would require an explicit release/re-retain API transition; this task does not add dynamic rebinding behavior.
- Actual browser `ImageBitmap` allocations from this realm are recognized. Unit tests use a stubbed ImageBitmap constructor and instances because the Vitest environment is Node. Unrelated DOM images and arbitrary closable objects are excluded by the constructor check. Cross-realm bitmap ownership is outside this application's loader path.
- Final close assumes all consumers of a loader-created bitmap participate in this module's existing retain/release ownership contract. Unregistered external consumers are not tracked; the application uses GLTF-created bitmaps through the retained loaded scene, with no image cache enabled by this change.
- `lab-view.ts` retains its existing compact/long-template style; changed only the scoped handler and cleanup.
- No implementation correctness concerns found in self-review. Independent task review is still required before continuation. Root-owned `README.md`, `docs/*`, `evidence/*` and `tmp/` were not edited or staged by this task.
