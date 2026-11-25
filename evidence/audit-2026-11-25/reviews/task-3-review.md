### Spec Compliance

- ✅ Spec compliant for Task 3: `src/scene/resource-lifetime.ts:6` adds separate texture-to-bitmap and bitmap-reference ownership; `:13` restricts ownership to actual ImageBitmap instances; `:22` closes only the final bitmap reference; `:48` retains the image allocation only for the first texture owner; `:63` releases it only after the final texture owner. Existing public retain/release signatures and per-object idempotence remain intact (`:29`, `:31`, `:54`, `:56`).
- ✅ `tests/resource-lifetime.test.ts:33` covers two owners of one bitmap-backed texture, `:43` covers two different texture wrappers sharing a bitmap with final close exactly once and double release, and `:56` covers ordinary image-like sources and unrelated close methods. The existing procedural geometry/material and lazy skeleton paths remain in the diff context (`src/scene/resource-lifetime.ts:36`, `:39`, `:41`; `tests/resource-lifetime.test.ts:18`, `:68`).
- ✅ `src/modes/lab-view.ts:31` names the delegated handler and `:43` removes that exact handler while preserving interval, observer, and visibility cleanup. `tests/e2e/lab-lifecycle.spec.ts:22` exercises three mounts, checks baseline-plus-one on entry and baseline after departure (`:25`, `:39`), and asserts exactly one current-comparison update plus the expected environment text (`:35`, `:36`).
- ✅ Named concrete risk checked outside the diff: stale GLTF completion could bypass new bitmap ownership. `src/scene/life-scene.ts:110` retains the loaded scene before the stale-generation/destroyed check; `:111` immediately releases stale results and `:128` releases failed placement. No loader change is required for that path.
- ⚠️ Cross-task constraints cannot be fully verified from this scoped diff: storage versions/keys and timestamps, migration and future-version rejection, inquiry export compatibility, isolation of classroom/peer/preview state, stable question/reward data, and the complete dist/offline enumeration. The controller should verify these in the aggregate review. This diff adds no runtime module, dependency, account/backend/telemetry feature, generated asset, export field, or deletion.
- ⚠️ Browser regression execution and production build remain explicitly pending the controller's final validation; this is an execution gap, not an implementation defect found in this review.

### Strengths

- `src/scene/resource-lifetime.ts:6` separates shared decoded image ownership from texture-wrapper ownership without changing callers. Capturing and deduplicating bitmap identities when the first texture owner registers (`:13`–`:15`) makes release use the original allocation rather than a later texture.image replacement.
- `src/scene/resource-lifetime.ts:13` uses guarded ImageBitmap identity rather than invoking arbitrary close methods. `tests/resource-lifetime.test.ts:56` directly guards that distinction while still requiring wrapper disposal.
- `tests/resource-lifetime.test.ts:43` exercises real THREE.Mesh, material, and texture objects; only the unavailable Node ImageBitmap constructor and its close effect are stubbed. Both premature close and omitted close would fail the assertions.
- Named concrete risk checked outside the diff: a DOM mutation count might not represent comparison refresh count. `src/modes/lab-comparison.ts:10`–`:13` performs one synchronous innerHTML replacement of the observed node for each refresh, and `:97` returns that refresh function. Consequently `tests/e2e/lab-lifecycle.spec.ts:28`–`:35` measures the relevant update, while listener registration/removal tracking independently catches retained old mount handlers (`:8`–`:15`).

### Issues

#### Critical (Must Fix)

- None found.

#### Important (Should Fix)

- None found.

#### Minor (Nice to Have)

- None found.

### Assessment

**Task quality:** Approved.

**Reasoning:** The implementation satisfies the scoped ownership and laboratory cleanup requirements with small, cohesive changes and meaningful regressions. The unchanged skeleton ownership keeps lazy bone texture disposal with Skeleton.dispose; the new bitmap accounting applies only to retained texture wrappers. Final browser execution remains a controller validation step.

**Checks performed:** Read the supplied diff once and reviewed the supplied brief/report. Performed focused source checks only for stale GLTF completion ownership and correspondence between comparison refresh calls and the browser mutation assertion. No tests were rerun and no source, index, HEAD, or branch changes were made; this review report is the sole written output.
