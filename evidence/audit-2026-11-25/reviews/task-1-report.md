# Task 1 report — save ownership and atomic imports

Status: DONE_WITH_CONCERNS (browser regressions await root's fresh production build).

Initial code commit: `9af600a` — `fix: guard progress ownership and cancel stale save imports`. Latest fix: `f4d1d50`; current behavior and final verification are recorded in Fix round 2 below.

## Changes

- Added `createProgressAccess`: origin-scoped exclusive Web Lock `life-museum-progress-writer`, with `ifAvailable: true`, explicit busy/unsupported/failure reasons, synchronous revocation before release, and retry after release. No localStorage locking or merging.
- The application acquires access before initializing its persistent GameStore; its optional write guard additionally remains closed until initialization finishes. A second window reads a snapshot and visibly explains reloading to retry. Export/navigation remain available. `pagehide` revokes access before releasing; restored pages reload before saving; background tabs retain ownership.
- Every public GameStore mutation checks the guard before touching progress. Existing constructor callers keep default behavior; `persist: false` preview stores stay independent. Revision allocation also occurs before mutations so allocation errors cannot partially award points or overwrite settings/import/reset.
- Timestamp validation preserves accepted original timestamp strings, including ordinary legacy formatting, throughout years 0000–9999. Extended-year extremes, malformed input, maximum JS date and maximum-minus-one reject. A single bounded revision comparator now orders all valid replicas and allocator outputs within an effective span of half the supported range (about 5000 years). Allocation chooses the local wall clock only when that comparator finds it newer; otherwise it increments one millisecond, wrapping the terminal endpoint to year 0000. Imports receive a revision allocated from current state and cannot advance the clock to the file's future timestamp.
- Startup selects all valid replicas with that same comparator and keeps the selected timestamp string unchanged. Year-9999 originals are retained for recovery archives on a later write and receive a notice, but are neither disqualified nor changed during startup. Invalid timestamps use the existing corrupt-copy recovery path. There are no startup writes.
- Added a settings import controller with a request generation, active/connected dialog check, read-failure handling, writer recheck after reads, 400000-byte file cap and 250000-character text cap. Empty/oversized selections invalidate previous reads; closing/disposal/reset cancels; the input clears after every selection. Reading and result status are visible.
- Reset wording now says it replaces current progress and retains corrupt-record recovery archives. Tests verify both existing and newly recovered archives survive.
- Added six browser cases for same-context owner/reader, takeover after owner close and reader reload, stale snapshot after reset, unsupported locks/export, delayed import after close/reset, and exit/restoration permission lifecycle (ownership/takeover is combined in one case).
- Data version, keys, IndexedDB schema and exports remain unchanged. New runtime modules are statically referenced by main and use the existing Vite/offline enumeration.

## Actual verification

Final command:

```text
npx vitest run tests/progress-access.test.ts tests/progress-import.test.ts tests/store.test.ts
Test Files  3 passed (3)
Tests       65 passed (65)
Duration    269ms
Exit code   0
```

```text
npx tsc --noEmit
Exit code 0; no diagnostics
```

```text
git diff --cached --check
Exit code 0; no diagnostics
```

Initial unit run found Node's actual `navigator.locks` affected the unsupported-browser fixture; fixed the fixture to explicitly stub an unsupported navigator and reran successfully. No build, browser suite, full unit suite, dependency install or image generation was run.

## Boundaries / risks for review

- Root must run the six new Playwright cases against its fresh production build. The `pagehide`/`pageshow` regression dispatches persisted transition events; it verifies application permission behavior rather than claiming genuine browser BFCache eligibility.
- Unsupported/failed locks deliberately leave the main store read-only. This is a snapshot, not live synchronization.
- The effective revision ordering span is strictly less than half the supported range (about 5000 years). At exactly half the range, the numerically greater timestamp wins deterministically; beyond the supported span the serial order is not absolute civil-time order. `updatedAt` is a local revision as well as a displayable date, not a trusted civil clock. Terminal values wrap safely rather than saturating or exhausting. Ordinary near-present/history comparisons and legacy strings keep their existing behavior.
- The report lives in the repository's ignored `.superpowers/` directory and was written after the scoped code commit so it can name the actual commit. Unrelated plans, reports, teacher-review documents and `tmp/` were not staged or modified by this task.

## Fix round 1 — independent review's four Important findings

Commit: `150d407` — `fix: recover extreme save clocks and preserve read-only interactions` (base `893a399`). This section supersedes the earlier description of rejecting the final supported millisecond during validation.

1. **Dangerous startup clocks:** Round 1 accepted valid four-digit timestamps and retained originals for recovery archives. Its initial partition preference and startup time rebasing were found inconsistent at the partition boundary and are superseded by the unified comparator in Round 2. Current initialization preserves the selected original timestamp, and the first actual action allocates a newer local revision under that same relation. Startup never rebuilds the timestamp or writes either storage copy.
2. **Read-only chapter browsing:** Added a transient chapter choice in main. Scene chapter, selected chapter species/cards, digging context and quiz use it, while `Progress.chapter`, exported JSON, localStorage and IndexedDB stay unchanged. Diagnostics report the displayed chapter separately from their `progress` snapshot.
3. **Read-only quiz attempts:** Main supplies its live ownership predicate to quiz. Read-only attempts grade against the question's correct answer and count toward the temporary round score, skip the personal answer action, and say the attempt does not save progress or rewards. They do not claim a previous reward. Store's denied mutation contract remains unchanged.
4. **Native file cancellation:** The file input handles and stops its bubbling `cancel`, clears the input and calls `select(undefined)` to invalidate any old read. Dialog-targeted cancellation still disposes/closes Settings normally.

Focused verification after all fixes:

```text
npx vitest run tests/progress-access.test.ts tests/progress-import.test.ts tests/store.test.ts
Test Files  3 passed (3)
Tests       71 passed (71)
Duration    264ms
Exit code   0
```

```text
npx tsc --noEmit
Exit code 0; no diagnostics
```

```text
git diff --cached --check
Exit code 0; no diagnostics
```

New focused unit coverage initializes with `.998Z` in either storage position, prefers an ordinary valid replica, writes repeatedly and reloads. Another case supplies two dangerous replicas with different ledgers, preserves the newer ledger, checks zero startup writes and preservation/archival of both raw originals, writes and reloads. A quota failure case leaves the dangerous local snapshot unchanged while IndexedDB alone succeeds, then reloads and verifies no progress rollback. Future imports now explicitly exercise year-9999 start, `.998Z`, and `.999Z`. Existing historical legacy-format and ordinary two-replica ordering cases still pass.

Two browser cases were added for root's fresh-build run: unlocked chapter 1 → 2 → 1 navigation as a reader, corresponding chapter-2 species and full quiz score with export/snapshot/both storage copies unchanged; and bubbling file-input cancellation during a delayed read, Settings remaining open, ignored old read, successful same-file retry, plus genuine dialog-target cancellation. The file now contains eight browser cases total. No build, browser/full suite or dependency installation was run by this fix round.

The recovery threshold initially introduced in Round 1 no longer controls replica ordering; see Round 2's final rule and explicit span. Browser runtime verification remains root-owned. Unrelated `AI_USAGE.md`, competition documents and `tmp/` changes were left outside this commit.

## Fix round 2 — consistent ordering across recovery transitions

Commit: `f4d1d50` — `fix: unify bounded progress revision ordering across recovery` (base `5f1d4e5`). Only `src/core/store.ts` and `tests/store.test.ts` were committed.

The independent reviewer correctly identified a rollback when a successful single-backend save crossed the ordinary/dangerous-year partition. Two new focused cases first reproduced this failure in both directions: localStorage rejected the write while IndexedDB succeeded, and an IndexedDB transaction aborted while localStorage succeeded. Both failed on reload with the newly completed read missing.

The fix removes partition-based replica priority entirely. `compareProgressRevisions` compares the forward distance on the bounded millisecond ring for years 0000–9999. Its span is `MAX - MIN + 1` milliseconds; all arithmetic stays within safe integers. A positive forward distance below half the ring means newer; a larger distance means older. At exactly half, the larger numeric timestamp wins consistently in both argument orders. Equal timestamps, including differently formatted legacy strings for the same instant, compare equal.

`allocateProgressRevision` uses exactly that relation. If the wall clock compares newer it allocates that ISO timestamp; otherwise it increments once, wrapping the terminal supported millisecond to the first. Every allocated B compares newer than its predecessor A, including both endpoints and half-range wall-clock cases. Allocation still occurs before ledger mutation. Imports use this current-store allocation rather than the file's clock.

Initialization validates both ledgers, compares every valid candidate using the same comparator, and preserves the winning original timestamp string. The year-9999 check now controls only notices and delayed recovery archiving, not selection or allocation. There is no in-memory startup rebasing and no startup write. A later successful action can move year 9999 to the current local wall clock when that clock is newer in the bounded order; the same comparison then lets this successful copy beat a stale extreme copy on reload.

Tests now explicitly force the actual transition `9998-12-31T23:59:59.999Z` → `9999-01-01T00:00:00.000Z` by placing the wall clock at the predecessor. Each backend-failure direction preserves the new read on reload, supports another write, and preserves both actions on a further reload. Other focused cases cover ordinary historical/legacy comparisons, forward/reverse directional comparison, terminal-to-first wrapping, allocator output validity and strict direction, equal-instant formats, deterministic half-range behavior, previous `.998Z`/`.999Z` startup and import scenarios, dual-dangerous ledgers, delayed archives, and one surviving modern-time backend after extreme-clock recovery. The prior guards, import lifecycle, preview isolation and recovery-archive tests remain in the same passing focused run.

Final commands/results:

```text
npx vitest run tests/progress-access.test.ts tests/progress-import.test.ts tests/store.test.ts
Test Files  3 passed (3)
Tests       84 passed (84)
Duration    281ms
Exit code   0
```

```text
npx tsc --noEmit
Exit code 0; no diagnostics
```

```text
git diff --cached --check
Exit code 0; no diagnostics
```

Remaining explicit limit: serial comparisons promise chronological direction only within a span strictly below half the ring, approximately 5000 years. `updatedAt` also serves as a bounded local revision and is not a trustworthy civil-time measurement. Comparisons at or beyond that span are deterministic but cannot encode an unlimited absolute chronology without changing the format/protocol. No Progress fields, storage keys/schema, auxiliary records, arbitrary-precision counter, dependencies or browser behavior changed in Round 2. Root still owns the fresh-build browser/full-suite run. Unrelated plan edits and `tmp/` were not staged.
