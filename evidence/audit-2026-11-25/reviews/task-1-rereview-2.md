**Rollback at the 9998–9999 boundary — ADDRESSED.** Startup includes both valid replicas in the same comparison. The allocator and the loader use the same ordering, so a write that advances the revision by one millisecond into year 9999 wins over its stale predecessor regardless of which backend saved it. See `src/core/store.ts:21`, `src/core/store.ts:31`, `src/core/store.ts:159` and `src/core/store.ts:179`.

The regression at `tests/store.test.ts:297` forces the exact boundary, separately fails localStorage and IndexedDB, checks the surviving copy for the new read, reloads, makes a second change, and reloads again. The comparator also preserves equality for differently formatted timestamps representing the same instant and defines the exact half-range tie. The endpoint test covers wrapping the last supported millisecond to the first. See `tests/store.test.ts:178` and `tests/store.test.ts:194`.

**New breakage in the fix diff.** None found within the agreed revision span. The half-range limit applies to the distance between the two surviving replica revisions, including any forward jump taken from the wall clock. At or beyond approximately 5,000 years, deterministic selection does not establish absolute chronology. This limit is explicit in `src/core/store.ts:7` and the task clarification in `progress.md:9`.

**Out-of-scope observations.** None.

**Fix round approved.** All findings are addressed, with no new Critical or Important issue. The implementer's round-two report records 84 of 84 focused unit tests passing and a clean TypeScript check. This re-review verified the regression assertions and the code paths they exercise.
