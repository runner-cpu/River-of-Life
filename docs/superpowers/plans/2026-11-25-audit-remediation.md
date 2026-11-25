# 生命长河十维核查修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复独立复核发现的存档覆盖、异步导入、离线更新和资源生命周期缺陷，完善教学反馈与发布证据。

**Architecture:** 保持静态前端、同步 GameStore API 与现有路由。把跨窗口写入所有权、文件读取生命周期、构建身份计算提取为小模块；不进行无证据的大规模框架重写。

**Tech Stack:** TypeScript、Vite、Three.js、model-viewer、Vitest、Playwright、Service Worker、Web Locks。

## Global Constraints

- Progress data version remains 2; localStorage key remains `life-museum-save-v1`; IndexedDB `life-museum`, schema 1, object store `progress`, key `current` remain unchanged.
- Validate v1 before migration; preserve ordinary saved timestamps on startup; reject unsupported future versions atomically; no retroactive badge awards or repeated points.
- Preserve inquiry export `type: "life-inquiry-record"`, version 1, existing answer indices and evidence categories; `answers.evidence: null` remains supported. Do not add required export fields.
- Relationship/classroom exhibits and peer records must not mutate personal Progress, timestamps, localStorage or IndexedDB. Preview stores remain isolated.
- Inquiry explanations, classifications, peer records and lab notes remain temporary. No account, backend, telemetry or new runtime dependencies.
- Existing question IDs, correct answers and rewards remain stable. No invented teaching outcomes, scientific review, device measurements or contest eligibility.
- All changed runtime modules enter the existing dist/offline enumeration; user exports and external source URLs do not become cached site resources.
- Preserve unrelated `tmp/`, existing reports, source attribution and recovery archives. No asset generation or unsolicited data deletion.

## Verified scope and order

Source baseline: `273e731`. The supplied Claude run ended with 0/10 usable reports after API errors; this plan follows a new source audit, small reproductions and live-site checks. Findings and independent review decisions are consolidated in `docs/audits/2026-11-25-improvement-report.md` after verification.

### Task 1: 存档写入所有权与原子导入

**Files:** modify `src/core/store.ts`, `src/main.ts`, `src/polish.css`; create `src/core/progress-access.ts`, `src/core/progress-import.ts`; test `tests/progress-access.test.ts`, `tests/progress-import.test.ts`, `tests/store.test.ts`, `tests/e2e/save-lifecycle.spec.ts`.

**Interfaces:** retain all public GameStore actions and their existing return shapes. Add an optional `canWrite: () => boolean` guard, used by the application's persistent store, checked before every mutation; isolated preview stores do not use this guard. A small browser access object exposes `writable`, `reason`, `acquire()` and `release()`; acquire resolves promptly even when another window owns the lock. UI holds a single origin-scoped exclusive Web Lock named `life-museum-progress-writer` for its active lifetime.

- [ ] Add failing boundary tests: two access objects share one lock; only one is writable; release permits a new attempt. Missing/failed locks resolve read-only, never pretend to coordinate. Test each GameStore mutation with a denied guard, including settings/import/reset/badges, asserting exact state and storage invariance.

```ts
const before = store.export();
store.observe(species[0].id);
store.settings({ projection: true });
expect(store.export()).toBe(before);
expect(storage.setItem).not.toHaveBeenCalled();
```

- [ ] Acquire ownership before persistent store initialization. Keep second windows as explicit read-only snapshots with a visible explanation and retry/reload action; exports and navigation remain usable. Releasing on page exit must revoke mutation permission first. Restored pages must reacquire/reload before writing. Do not merge points or use a localStorage read-then-write as an atomic lock. Unsupported browsers may read/export, with an explanation of why saving is unavailable.
- [ ] Validate dangerous timestamp boundaries before replacing live state. Reject extended-year extreme dates or normalize them without overflow; preserve ordinary historical dates, including legacy formatting. Allocate a valid revision before committing imports; finite far-future input must never strand later actions. Test maximum JS date, maximum-minus-one, malformed timestamp and a far-future date; rejected imports leave exports and storage unchanged and a later valid action succeeds.

```ts
const before = store.export();
expect(() => store.import(JSON.stringify({ ...JSON.parse(before), updatedAt: '+275760-09-13T00:00:00.000Z' }))).toThrow();
expect(store.export()).toBe(before);
expect(() => store.observe(species[0].id)).not.toThrow();
```

- [ ] Isolate settings file import with a request generation and dialog lifecycle check. Increment generation before every selection, including empty/oversized files; after `await file.text()` check current request and active/connected dialog, then commit. Catch read failures without losing a good save. Size cap stays 400000 bytes / parsed save 250000 chars. Show reading/result status; clear file input to allow same-file retry. Closing/reset cancels pending work.
- [ ] Clarify reset wording: it replaces current progress while retaining corrupt-record recovery archives; do not silently erase recovery history.
- [ ] Unit tests cover reverse-order reads, read rejection, close/dispose and denied writer. Add browser tests with two same-context pages, read-only no-op, close first/reload second ownership, and delayed import crossing close/reset. Run targeted unit tests now; root runs browser suite against fresh build.
- [ ] Commit scoped files and provide report with actual commands/results.

### Task 2: 离线更新生命周期与下载状态

**Files:** modify `public/sw.js`, `src/core/offline.ts`, settings offline feedback in `src/main.ts`; create `tests/service-worker.test.ts`, `tests/e2e/offline-upgrade.spec.ts`; modify `tests/offline.test.ts`.

**Interfaces:** keep `CACHE_ALL` request/reply and progress messages compatible; retain `prepareOffline` callers, with current cacheTimeout parameter interpreted as inactivity timeout and a bounded absolute maximum added with a safe default.

- [ ] Load actual worker source in a small fake CacheStorage/network harness. Demonstrate A→B losing A chunks/models before change, plus HTTP 200 followed by quota rejection.
- [ ] Remove forced `skipWaiting`; use normal waiting until old clients close. Keep unrelated origin/path caches intact. Identify previous full-offline preparation (existing caches must be detected using their cached manifest and presence of all listed resources; new versions may store an explicit completion marker). If A was fully prepared, B install must fetch all B resources afresh and finish before old cache retirement. Never copy same-URL model bytes blindly. If B fails, A stays usable; partial/new visitors keep shell-only installation. Handle user completing A preparation while B waits conservatively and document the transition.

```js
expect(await oldCache.match(oldLazyChunk)).toBeTruthy();
expect(await newCache.match(updatedModelUrl)).toHaveBody('model B');
expect(await caches.has(unrelatedCache)).toBe(true);
```

- [ ] Catch opportunistic cache.put failures only in fetch path and return successful network responses. Keep explicit full-preparation failures visible; failed network fetches must still fail.
- [ ] Offline download timeout resets only on validated forward progress, includes an absolute maximum (10 minutes), and clears all timers/ports/listeners. Duplicate or decreasing progress cannot keep a stalled worker alive. Extend the per-resource inactivity allowance if needed for a large GLB; no claim that a browser hang completed successfully.
- [ ] Tests cover complete vs partial A, B changed/add/remove URLs and bytes, failed B installation preserving A, unrelated cache, quota fallback, increasing progress beyond 45s, stalled/duplicate progress and cleanup. Browser integration serves two small controlled versions through a disposable localhost server using actual SW code; old page remains usable while B waits, B activates after A closes, fresh B model works offline.
- [ ] Run targeted units, commit and report. Root owns full build/browser run.

### Task 3: 视图与图形资源生命周期

**Files:** modify `src/modes/lab-view.ts`, `src/scene/resource-lifetime.ts`; modify `tests/resource-lifetime.test.ts`; add focused browser lifecycle case in `tests/e2e/audit.spec.ts` or dedicated file.

**Interfaces:** retain `mountLab` cleanup signature and retain/releaseObjectResources APIs. Resource ownership accounts for both texture wrappers and the shared underlying closable image object.

- [ ] Add a regression with two different Texture objects sharing one closable image: releasing first view does not close; releasing final view closes once; double-release stays idempotent. Also test two owners of one texture and ordinary images without close.

```ts
releaseObjectResources(first);
expect(close).not.toHaveBeenCalled();
releaseObjectResources(second);
releaseObjectResources(second);
expect(close).toHaveBeenCalledTimes(1);
```

- [ ] Reference-count loader-owned image bitmaps separately from texture references, only closing on final release. Preserve shared procedural geometries/materials, skeletons and lazy bone textures. Do not call arbitrary close on unrelated DOM images. Check late stale GLTF completion uses retain/release cleanup.
- [ ] Give delegated laboratory input a named handler (or mount-scoped AbortController) and remove it in cleanup. Keep timer/observer/visibility cleanup. Browser regression mounts/leaves repeatedly and proves retained input-listener count returns to baseline; current comparison updates once.
- [ ] Run targeted units, commit and report. No unsupported memory saving or FPS claim.

### Task 4: 教学反馈与练习覆盖

**Files:** modify `src/content/inquiries.ts`, `src/core/inquiry.ts`, inquiry graph/report/comparison renderers as needed, `src/modes/inquiry.ts`, `src/modes/quiz.ts`; add focused tests in existing inquiry/quiz suites and browser suite.

**Interfaces:** add internal explicit reference-claim metadata/helper only; exports retain existing version and required fields. Old imported records lacking metadata remain readable; unknown old "不确定" classifications are not silently reinterpreted in peer comparison.

- [ ] Define for each uncertain option a clear proposition to examine, derived from the existing scientifically scoped question content. Show original uncertainty separately from that proposition. Use the same reference in categorization, graph, HTML export and peer display. Change introductory wording from finding support to checking support/contradiction/insufficient evidence. Keep category enum values and initial answer indices.
- [ ] Test all three uncertain routes and original definite routes, JSON roundtrip with unchanged schema, HTML escaping, original answer preservation and personal Progress invariance. Where the old protocol cannot distinguish historical uncertain categories, explicitly mark the reference as unspecified rather than asserting new meaning.
- [ ] Quiz feedback states the corresponding species card/field, provides reachable source links with declared scope, and does not imply sources[0] validates every field. Escape rendered content.
- [ ] Mitigate repeated-distractor novelty within one quiz round: each species appears at most once, unattempted questions get priority on later rounds, original IDs and rewards remain. Track honest limitation: distractor quality and answer-length cues still need content review; do not claim psychometric validity.
- [ ] Timeline exercises choose distinct approximate ages across unlocked chapters and include current chapter when possible, rather than always the oldest five. Preserve first-chapter completion, keyboard focus restoration and zero-point badge behavior.

```ts
expect(new Set(round.map(q => q.speciesId)).size).toBe(round.length);
expect(timeline.some(s => s.chapter === currentChapter)).toBe(true);
```

- [ ] Run targeted units, commit and report with remaining external content-validation work.

### Task 5: 发布证据绑定构建内容

**Files:** create small shared digest/report validation module under `scripts/`; modify `playwright.config.ts`, `scripts/verify-build.ts`, `scripts/package-competition.ts`; add `tests/release-evidence.test.ts`.

**Interfaces:** shared release hash matches the existing sorted offline-manifest paths plus bytes method. Browser report config metadata records `releaseContentSha256` for its actual production output. Packaging requires full passing run and identical digest, rather than relying on index mtime as identity.

- [ ] Add regression fixtures: valid A digest with complete passing B browser report is rejected; matching A is accepted regardless of incidental file timestamps; missing identity, filtered/sharded/incomplete/flaky/skipped runs remain rejected.

```ts
expect(() => verifyBrowserEvidence(reportForB, digestA, requiredSuites)).toThrow();
expect(() => verifyBrowserEvidence(reportForA, digestA, requiredSuites)).not.toThrow();
```

- [ ] Compute the production hash at browser configuration/run setup, record it with test-source identity if useful, and detect output changes during the run. Packaging recomputes current bytes and compares. Preserve document hashes and all existing package checks.
- [ ] Run focused tests/typecheck, commit and report. No new competition package is claimed without separately refreshing and reviewing its PDF/materials.

## Completion and evidence

- [ ] Independent task review for requirements and quality; resolve concrete findings and record deferred items.
- [ ] Root runs species/model validation, TypeScript/build, full units, full browser suite, build verification. Repeat only after a material change or failure.
- [ ] Produce the ten-dimension report with finding IDs, evidence, peer verdicts, changed files, test results, limitations and follow-up priorities. Add a single-theme teacher review sheet and current dated document/README entry; preserve historic PDF as a dated artifact unless regenerated and inspected.
- [ ] Push and update Pages under existing user authorization if network/authentication permits; verify deployed bytes and actual workflow status. Never substitute historic deployment success for current evidence.
