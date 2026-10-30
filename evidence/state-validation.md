# State and simulation verification

Follow-up on 2026-10-30: the two historical parent-file type errors noted at the end are fixed. Storage precedence/recovery, offline timeout, and shared model resource regressions were subsequently added; the final suite has **45 passing tests**. See `review-fixes.md`, `final-rereview.md`, and `acceptance.md` for the current verification. The original detailed evidence below is retained.

Verified with `npm test` (Vitest 3.2.7): **2 files, 32 tests passed** (28 store tests, 4 lab tests). Vitest runs in Node with a localStorage mock and includes only `tests/*.test.ts`, leaving Playwright tests to their own runner.

## Store fixes

- `new GameStore(species, questions, { persist: false })` disables all localStorage and IndexedDB reads/writes, including actions taken before `init()`. The default remains persistent. Preview call sites must opt out.
- Save validation derives all reward event identities, including five chapter task rewards, from completed actions. Removing event entries or the event array cannot replay rewards. Unknown event identities cannot prevent future real actions from earning their points.
- Total earned points must exactly match unique observed/read/answered/dig/chapter/task actions. Balance must match chapter unlock spending and possible paid collections. First discovery and free fossil collections remain valid, including a fossil collected without reading. Read, comparison, and collection records require observation; ordinary paid collections require reading; completed chapters require the three learning tasks. Locked species, questions (including mistakes), and chapter actions are rejected.
- Legacy exports do not encode whether a fossil was bought before excavation or granted by excavation. Validation therefore accepts only the bounded set of balances possible from those specific fossil costs; it cannot identify which historical ordering occurred. An unread fossil must have been free. It never trusts arbitrary event metadata or an unchecked point count.
- Unlock calls accept only integer chapters 2 through 8 and always charge 150 points, regardless of a caller's price argument. Invalid or negative species collection costs are rejected.
- Optional purchases reserve 150 points while a future chapter remains locked. The collection message explains the reserve. This prevents optional collecting from permanently blocking the next chapter.
- Repeated actions cannot duplicate action IDs or reward IDs. Save imports validate fully before replacing live state. Storage errors report a notice without breaking learning, and a corrupt stored record is not overwritten during initialization.

## Finite economy calculation

Each chapter has six species and eighteen questions. Completing all finite rewards gives `6 × (5 + 3) + 18 × 10 + 5 × 50 + 20 + 100 = 598` points per chapter, or **4,784** across eight chapters.

All species' listed prices total **1,965**. In the tested route, the first discovered species is also chapter one's fossil; eight free specimens save **320**, leaving **1,645** in paid collection costs. Seven chapter unlocks cost **1,050**. All 48 species are collected, all eight chapters completed, and **2,089 points remain**.

| Chapter completed | Total earned | Balance before next unlock | Species collected |
| --- | ---: | ---: | ---: |
| 1 | 598 | 413 | 6 |
| 2 | 1,196 | 651 | 12 |
| 3 | 1,794 | 929 | 18 |
| 4 | 2,392 | 1,167 | 24 |
| 5 | 2,990 | 1,445 | 30 |
| 6 | 3,588 | 1,643 | 36 |
| 7 | 4,186 | 1,866 | 42 |
| 8 | 4,784 | 2,089 | 48 |

The minimum opening loop also passes: observe/read three species, answer three questions correctly, and complete the chapter. It earns 304 points before optional actions and can pay the 150-point unlock. First observation grants a free collection immediately.

## Lab tests

- Identical seeds produce identical organisms and all generation state after thirty steps.
- Sixty paired seeds, populations of 80, twenty generations, zero mutation and predation: strong drought gives mean locus-zero frequency **1.0000**, versus **0.05854** with no drought.
- Neutral locus-zero selection uses drought `1/7`, where `0.9d - 0.15(1-d) = 0`; zero drought includes an existing trait cost and is not neutral. Across 160 independent seeds, populations of 60, thirty generations: mean frequency change **+0.02417**, variance **0.09591**, with large positive and negative replicate changes. Thresholds require variance and reject systematic directional bias.
- The exact energy identity stays zero for 100 generations, with birth/death totals and energy inputs/outputs checked each generation.

## Type checking

`npx tsc --noEmit` reported no errors in the owned store, unit tests, or Vitest configuration. At the last check, two errors remained outside this task's scope: `src/core/ui.ts:5` (createElement argument count) and `src/scene/life-scene.ts:152` (void expression used as a condition). The parent is handling these files.

No commit was created.
