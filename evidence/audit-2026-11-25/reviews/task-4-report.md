# Task 4 implementation report

Status: DONE. Commit: `eabd4f2 Clarify inquiry claims and broaden quiz practice coverage`.

## Implemented behavior

- Registered the exact stable uncertainty metadata against existing topics and unchanged initial indices: feathers-multiple-features-v1 (feathers-and-evidence, index 2), sea-classification-evidence-v1 (sea-and-family, index 1), fins-feature-combination-v1 (fins-and-land, index 2). Propositions restate the existing scoped observations/questions; no external scientific facts or validation claims were added.
- Added a session reference getter and shared trusted reference display helper. The original initial answer stays separate from the proposition being examined. Classification, both graph layouts, HTML export and peer columns display that same proposition. The introduction now asks learners to inspect support, contradiction and insufficient evidence. Category values and original answer indices remain unchanged.
- Extended the existing v1 inquiry export with optional classificationReference { kind: activity-claim, claimId }. New uncertain sessions emit the field; definite sessions omit it. Validation rejects unknown/mismatched IDs, invalid kinds and references paired with definite answers. Existing evidence:null remains supported. No export version/type change or new required protocol field.
- Historical uncertain files without the optional field stay unspecified and display “旧记录未记载归类参照”. Comparison explains missing/different references even when all card labels match. Two equally unspecified historical files explicitly cannot establish a shared examined proposition. Peer UI also explains that equal labels do not establish equal reasoning.
- Quiz feedback names the exact species knowledge card and question field and provides links for every listed source. Each scoped source displays its existing scope. Sources without field-specific scope are explicitly described as a species reference entrance needing verification, rather than certifying the whole card through sources[0]. Text and link attributes are HTML escaped.
- Added pure quiz/timeline selection helpers. Quick, daily and mistake rounds contain at most one question per species. Quick rounds prioritize questions absent from both saved correct answers and saved mistakes, including additional locally attempted questions for readonly practice; later rounds reach new fields. Mistake rounds rotate locally displayed questions while retaining every original mistake ID. Daily challenges remain deterministic for the date and unlocked question pool, including retries regardless of reward/answer state. Question IDs, correct options and the GameStore reward path are unchanged.
- Timeline selection starts with the current unlocked chapter, spreads remaining slots over other unlocked chapters, and fills with distinct approximate ages (pairwise difference >0.1 Mya). Existing reverse chronological starting order remains sortable. Move focus restoration stays intact; successful verification now explicitly restores the check button focus. Existing zero-point badge award remains unchanged.
- Updated existing chapter-completion and readonly browser tests to grade the actual displayed stable question IDs instead of assuming consecutive fields for one species. Updated keyboard path coverage to account for reachable feedback source links.

## Validation and exact commands

1. `npx vitest run tests/inquiry.test.ts tests/inquiry-record.test.ts tests/inquiry-comparison.test.ts tests/quiz.test.ts` — exit 0, 4 files passed, 34/34 tests passed (initial implementation pass).
2. `npx tsc --noEmit` — exit 0, no diagnostics (after implementation and again after browser regressions).
3. Final focused command: `npx vitest run tests/inquiry.test.ts tests/inquiry-record.test.ts tests/inquiry-comparison.test.ts tests/inquiry-badges.test.ts tests/quiz.test.ts` — exit 0; 5 files passed, 39/39 tests passed. Vitest duration 364 ms; no warnings/failures.
4. Final `npx tsc --noEmit` — exit 0, no diagnostics.
5. `git diff --check -- src tests` — exit 0, no whitespace errors.
6. `git diff --cached --stat` reviewed exactly the 16 scoped implementation/test files before commit.

Focused units cover all three uncertain routes and both original definite routes per topic; stable IDs/indices; unchanged v1 answers/evidence:null; trusted reference roundtrip and invalid pairings; detached legacy imports without inferred meaning; explicit comparison limitations; graph/report escaping; unchanged personal Progress snapshot; one-species quiz selection; later field coverage; deterministic daily rounds; usable multiple mistakes for one species; original answer identity and one-time +10 rewards; feedback scope/link escaping; current-chapter timeline coverage across all eight chapters; pairwise distinct ages.

Added six browser regressions in teaching-feedback.spec.ts: all three uncertain routes with original choice, reference, HTML/JSON exports, ambiguous legacy peer, rejected unknown reference, and memory/localStorage/IndexedDB equality; one 320px quiz round and next-round field coverage with keyboard-reachable source links; chapter 1 and chapter 8 timeline sorting, focus restoration and zero-point badge behavior. Representative desktop/320px graph screenshots use testInfo.outputPath rather than historical evidence filenames.

Per the delegated task instructions, browser execution, full unit execution, build and production/offline verification are intentionally left to the root's single integration pass. No build/dist output or evidence report was generated or overwritten by this implementation. Browser regressions are authored/typechecked, not yet execution evidence. TDD was not required for this task; no RED/GREEN sequence is claimed.

## Files committed

- src/content/inquiries.ts
- src/core/inquiry.ts
- src/core/inquiry-record.ts
- src/core/inquiry-comparison.ts
- src/core/quiz.ts (new pure selection helpers)
- src/modes/inquiry.ts
- src/modes/inquiry-graph.ts
- src/modes/inquiry-comparison.ts
- src/modes/quiz.ts
- tests/inquiry-record.test.ts
- tests/inquiry-comparison.test.ts
- tests/quiz.test.ts (new)
- tests/e2e/museum.spec.ts
- tests/e2e/save-lifecycle.spec.ts
- tests/e2e/refinement.spec.ts
- tests/e2e/teaching-feedback.spec.ts (new)

## Self-review and boundaries

- Verified that the optional reference is added only for the exact uncertainty index; explicit wrong-answer pairings are rejected; historical missing references are never filled during parsing or peer display.
- Verified preservation of the Task 1 canWrite quiz callback and readonly grading result. Local seen history is temporary and writes no Progress fields.
- Preserved Progress version, storage keys/schema, reward identities and question content. No source data, dependencies or scientific assertions were expanded. No docs, README, tmp or existing evidence files were edited/staged by this task. The report itself is in the existing ignored .superpowers directory as requested.
- Existing dense HTML template renderers remain dense; changes follow their current structure instead of introducing an unplanned renderer architecture.
- Daily selection is deliberately fixed for a given date/unlocked pool; coverage rotation applies to quick and mistake practice. Daily output can change if more chapters are unlocked because the eligible pool changes, matching the existing daily eligibility behavior.
- External content validation is still needed: distractor quality and answer-length cues were not scientifically or psychometrically validated. Species reference entrances without per-field scope still require passage-level review. This change makes that limitation explicit and does not claim psychometric validity or measured teaching improvement.


## Review fix round 1 — three Important findings

Status: DONE. Commit: `231f6c2 Use neutral inquiry references and consistent card field labels` (base eabd4f2).

1. Replaced the shared visible category labels with “支持归类参照”, “与归类参照无关”, “反对归类参照”, and the existing “需要更多信息”. The serialized keys remain support/irrelevant/oppose/more-information. The shared dictionary propagates neutral wording to classification buttons/status/drop zones, both graph layouts, HTML export, comparisons and peer columns. Tests assert neutral wording and absence of “支持我的判断” / “反对我的判断” for uncertain sessions; browser expectations include both support/oppose buttons and peer columns. Updated the existing drag regression's visible irrelevant label without removing the assertion.
2. Comparison now checks missing historical provenance first. It identifies whether my record, the peer record or both lack the reference, states that reference agreement cannot be determined, and preserves the equal-label reasoning caveat. Only two known references are compared by stable reference identity (trusted claim ID or original definite answer identity), rather than by display text. Tests cover all three missing-side combinations, known differences and known agreement. The prior browser assertion requiring an unsupported “归类参照不同” conclusion for a missing peer reference now explicitly rejects that text and expects the missing-peer / inability-to-determine explanation.
3. Added shared specimenFieldLabels used by question explanations, quiz source feedback and the actual opened specimen card. Fact is “一个有趣的发现”; misconception is “换一个角度认识它”; the actual card now also explicitly labels its introductory definition “生命档案”, which makes that reference locatable for every rarity. Diet/habitat/period labels match the card's fact headings. Question ID generation, option arrays, correct indices, prompts and rewards are unchanged. Units assert exact generated IDs, correct-index formula, answer excerpts and explanations for every question; two browser regressions open the actual fact/misconception card section and compare heading and content with the displayed feedback.

Commands and results:

- `npx vitest run tests/inquiry.test.ts tests/inquiry-record.test.ts tests/inquiry-comparison.test.ts tests/inquiry-badges.test.ts tests/quiz.test.ts` — exit 0, 5 files passed, 46/46 tests passed, duration 357 ms; no warnings/failures.
- `npx tsc --noEmit` — exit 0, no diagnostics.
- `git diff --check -- src tests` — exit 0, no whitespace errors.
- `git diff --cached --stat` — reviewed the 11 scoped files below before commit.
- Search reviewed all runtime/test occurrences of the superseded personal category labels and old quiz field labels; remaining personal phrases occur only in negative regression assertions.

Files committed this round:

- src/content/questions.ts
- src/content/specimen-fields.ts (new shared labels)
- src/core/inquiry.ts
- src/core/inquiry-comparison.ts
- src/modes/quiz.ts
- src/modes/specimen.ts
- tests/inquiry-record.test.ts
- tests/inquiry-comparison.test.ts
- tests/quiz.test.ts
- tests/e2e/inquiry-classification.spec.ts
- tests/e2e/teaching-feedback.spec.ts

Self-review: the uncertain original answers and optional v1 reference protocol remain intact; category key validation/serialization is unchanged; known references use identity rather than presentation text; no unknown historical claim is inferred. The new shared field-label module is imported into existing runtime paths for normal build/offline enumeration. No root-owned docs, evidence outputs or tmp files were staged. Browser tests are authored/typechecked but not executed, as requested; full build/full suite/browser remain the root integration step. The minor repeated-mistake-cycle issue from the review remains recorded for final review, per the requested scope of this fix round. External content-validation limitations from the original report remain.
