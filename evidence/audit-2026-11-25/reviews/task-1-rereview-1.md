### Finding verdicts

1. **Near-terminal startup timestamp — ADDRESSED.** At `src/core/store.ts:140` startup separates year-9999 replicas, and at `src/core/store.ts:160` it recovers the newest such ledger with a local timestamp when it has no ordinary replica. The original `.998Z` scenario now supports repeated writes and reload, covered at `tests/store.test.ts:220` and `tests/store.test.ts:232`. A distinct replica-ordering regression at the new cutoff remains below.
2. **Read-only chapter navigation — ADDRESSED.** The reader's chapter is transient at `src/main.ts:151`. `src/main.ts:73` uses that selection to display chapters and species, and `src/main.ts:103` supplies it to the quiz. The browser case navigates between unlocked chapters, checks the visible species and verifies the export and both replicas at `tests/e2e/save-lifecycle.spec.ts:103`.
3. **Read-only quiz grades correct answers as wrong — ADDRESSED.** `src/modes/quiz.ts:43` grades the temporary answer against the question and returns zero reward. `src/modes/quiz.ts:46` labels correct read-only attempts accordingly. The browser case checks each correct response, the final score and persistence invariance at `tests/e2e/save-lifecycle.spec.ts:116`.
4. **File picker cancellation closes Settings — ADDRESSED.** `src/main.ts:222` stops the input's cancel event and invalidates the pending selection. Dialog-targeted cancellation still disposes the importer at `src/main.ts:221`. The stale read, open dialog, retry and dialog dismissal are covered at `tests/e2e/save-lifecycle.spec.ts:130`.

### New breakage in the fix diff

**Important — A successful save can roll back when its timestamp crosses the new recovery cutoff.** With both replicas at `9998-12-31T23:59:59.999Z`, the loader considers both ordinary. If localStorage starts rejecting writes, the next action successfully writes IndexedDB with `9999-01-01T00:00:00.000Z`, the exact revision allocated by `src/core/store.ts:17`. On reload `src/core/store.ts:140` classifies the updated IndexedDB copy as dangerous. `src/core/store.ts:159` then selects the stale local copy unconditionally. The reverse storage failure has the same effect. Under the prior ordering the newer replica won. `tests/store.test.ts:250` exercises the opposite ordering, where the stale copy is the one classified as dangerous. Make revision allocation and replica comparison preserve the order of successful writes across this transition. Add a unit test that starts one millisecond below the new cutoff, writes to only one surviving backend and reloads with the new action intact. Simply moving the threshold would move this case with it.

The focused date check confirmed the transition from an ordinary input to a recovery-classified output after one increment. The implementer reports 71/71 focused unit tests passed and TypeScript passed. The two browser regressions await the root's fresh-build run.

### Out-of-scope observations

None.

### Verdict

**Findings remain open.** All four original findings are addressed. The fix introduced one Important replica rollback at the new clock cutoff.
