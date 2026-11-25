# Task 4 review, 456000e..eabd4f2

**Spec compliance — Issues found. Code quality — Needs fixes.** Three teaching-facing discrepancies remain. No critical findings.

## Strengths

- The three stable claim IDs bind to the intended uncertainty indices and the existing observations (`src/content/inquiries.ts:17`, `:31`, `:45`). The validator accepts missing references, checks supplied IDs against the trusted topic and original answer, and preserves nullable evidence (`src/core/inquiry-record.ts:36`, `:41`, `:64`). The UI derives propositions from activity data (`src/core/inquiry.ts:7`). The tests cover all answers, legacy absence, wrong pairings and HTML escaping (`tests/inquiry-record.test.ts:68`, `:96`, `:107`).
- Quiz selection deduplicates by species after prioritizing unattempted questions, and daily selection uses the date and eligible pool (`src/core/quiz.ts:9`, `:13`, `:20`, `:25`). Read-only grading uses the actual correct answer and awards zero points (`src/modes/quiz.ts:45`). Source links display every declared scope and qualify missing field coverage (`src/modes/quiz.ts:9`).
- The timeline includes the current chapter first and requires pairwise separation of ages (`src/core/quiz.ts:36`, `:38`, `:45`). Sorting restores focus after a move and after verification (`src/modes/quiz.ts:60`). The existing badge method guards writes and duplicates and adds zero points (`src/core/store.ts:289`). Browser assertions cover progression, memory and both save stores (`tests/e2e/teaching-feedback.spec.ts:9`, `:52`, `:99`).

## Important

1. An uncertain learner is told the activity supplied the claim, yet the categories call it “我的判断”. `src/modes/inquiry.ts:59` distinguishes the two correctly, then the card status at `src/modes/inquiry.ts:71`, graph at `src/modes/inquiry-graph.ts:16`, HTML export at `src/modes/inquiry.ts:15`, and comparison reuse the personal labels from `src/core/inquiry.ts:3`. A learner who explicitly withheld judgment can therefore export “支持我的判断” about the activity's proposition. Use reference-neutral visible labels such as “支持归类参照” and “反对归类参照”, keeping the serialized category keys. Assert the category wording on an uncertain route.
2. `src/core/inquiry-comparison.ts:23` compares two display strings. When one record lacks its reference, line 25 concludes “归类参照不同”. The historical file could have used the same proposition. Only the missing provenance is known. Handle missing references before comparing known references, say which side lacks the reference, and explain that agreement cannot be determined. `tests/e2e/teaching-feedback.spec.ts:47` currently requires the unsupported conclusion. Preserve the equal-label reasoning caveat.
3. The field names in quiz feedback do not match the visible sections reached by “打开知识卡”. `src/modes/quiz.ts:8` calls a fact “值得留意” and a misconception “纠正误解”, while the specimen card presents “一个有趣的发现” and “换一个角度认识它” (`src/modes/specimen.ts:27`, `:28`). The question explanation also repeats the mismatched names (`src/content/questions.ts:77`), and `tests/quiz.test.ts:39` enshrines one. Use consistent field labels across the source feedback, explanation and the opened card. Keep the question IDs, options, correct answers and rewards intact.

## Minor

- `src/core/quiz.ts:21` uses a membership set for seen questions. Once every mistake for a species has been shown, equal priorities revert to content order indefinitely. A learner who continues getting the first mistake wrong has no way to revisit the second during that mount. `tests/quiz.test.ts:27` checks only the first two rounds. For continuous mistake practice, prioritize least recently attempted within the seen group and test a full cycle plus one retry.

## Review boundaries

- Focused outside-diff checks were the specimen field headings and generated question wording (whether a learner could locate the cited field), the seeded RNG (deterministic daily ordering, `src/core/lab.ts:2`), and `GameStore.badge` (duplicate/read-only/zero-point handling). No tests were rerun. The implementation report records 39 focused tests and a clean TypeScript check. Browser execution and dist/offline verification remain for the root production pass. Distractor quality, answer-length cues and passage-level scientific validation remain open as documented in the implementation report.
