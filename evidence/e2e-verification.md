# Browser verification

The suites in tests/e2e/museum.spec.ts, tests/e2e/epochs.spec.ts tests/e2e/classroom.spec.ts, tests/e2e/audit.spec.ts tests/e2e/learning.spec.ts and tests/e2e/refinement.spec.ts launch disposable Chromium through @playwright/test. They start an exclusive production preview at 127.0.0.1:4175 without attaching to the user's browser. Reproduce with npm run build followed by npm run test:e2e.

## Final production run — 2026-10-30

**36/36 passed**, zero failures, skips or flaky tests. Started at 2026-10-30 20:11:43 Asia/Shanghai; **106.5 seconds**. Strict TypeScript passed with tests included; the unit suite passed **103 tests in thirteen files**.

Build time: 2026-10-30 20:04:26. HTML SHA-256: 93c05684611fb3a4f38db68f3d196670d95be26dc8c30e375ffa88f15c11b49f. Full release-content SHA-256: 784388bd0d9579fe7144deb0b19eb6163c91ca6f0fe89303d800e71f6d8139ee. See build-verification.json for fingerprint and compression methods.

## Coverage

- Refinement: browser history and contextual titles, retained catalog search, closing obsolete dialogs, immediate collection count/card sync and focus restoration, recovering a failed manifest request, 320px non-color quiz feedback and keyboard continuation, paused experiments while a guide is open, and help routes without personal save changes. Comparison pending state now covers environment, seed and prediction; old CSV remains frozen.
- Five offline unit tests include bounded streaming progress and completion only on the final response.

- Interface polish: combined catalog reset and search focus, explanation character count, current experiment conditions and stale-result notice, mobile experiment navigation without changing route or generation, and independent specimen scrolling with a visible close action and preserved background position/focus.
- The section-navigation test accounts for the document scroll limit: the last section stays in the upper half of the viewport even when it cannot align to the top. See interface-polish.md for manual desktop, tablet and phone evidence.

- Three evidence inquiries: real exhibit and scoped sources, nested-dialog focus return, escaped printable explanations, unchanged personal save, and all text routes at a 390×844 viewport.
- Controlled comparison: required prediction, reproducible seed, frozen run parameters, 31 data rows (generations 0 through 30), CSV export and identical-environment equality.

- Mobile navigation inert state, focus cycling and restoration; codex filter focus and result count; quiz tab arrow/Home/End keyboard navigation.
- Deliberately failed GLB loads show original-diagram attribution, then recover the external model and its credit after retry. Fault-injection tests block service workers to ensure requests reach the injected failure.
- Cancelling the reset confirmation and keyboard-importing an oversized file leave the saved learning unchanged.
- Actual scene frame counts remain unchanged while paused, obscured by a modal or completely offscreen, and resume after interaction or return. Six phone-screen labels do not overlap. See audit-render-scheduling.json.

- Classroom inspection/overview restoration, previous/next wrapping through all six residents with matching descriptions and facts, one visible specimen hotspot, reachable full-card action, mobile selection returning the canvas into view and sticky close action. Existing keyboard-visible hotspots, label toggle, pause retention across an epoch event, preview reading without save changes and chapter chooser also pass.

- First observation/free collection, reading, comparison, reload persistence and duplicate-reward prevention.
- Chapter 1 → 2 through observation, reading, quizzes, epoch event and unlocking in the UI. Tests use authored card/question data to select correct answers.
- Newer IndexedDB learning surviving a failed localStorage write and reload.
- Real pointer excavation and accessible cleaning, unique rewards and persistence.
- Demo learning, excavation, manual hotspots in unlocked chapters, event takeover and the full fixed 90-second timeline leaving the personal save unchanged. This uses a virtual clock, not a real-time recording.
- Five-mode navigation at 390×844 without horizontal overflow; reachable desktop settings at 1280×720.
- Local guide quotations, reference links, supported questions and honest unsupported-question fallback without reward changes.
- All **13 GLB exhibits** loading with correct representation, author, title, license and modification record. Each must also produce opaque model pixels occupying more than 0.5% of its exported render; CSS backgrounds, HTML prompts and translucent shadows cannot satisfy this check.
- Eight chapter scenes with six sourced residents, named specimen dialogs and all 48 eligible cards. Triangle counts wait for actual reconstruction models in chapters 2, 4, 5 and 6; all sampled scenes remain below 150,000 triangles.
- Eight distinct classroom epoch scenes without save changes; pause/resume, focus trap/restoration, summary and Escape cleanup.
- Reduced-motion highlighter at 390×600, replay with no reward or save-timestamp mutation, and narration/exit controls when WebGL is unavailable.
- Offline preparation caching all 13 model URLs; offline shell reload, cached mammoth loading, local guide answers, a complete mosasaur text inquiry and a two-environment comparison.

Scene-budget and unlocked-preview tests use valid domain-created fixtures for prerequisites. Tests do not modify application source. Machine records: e2e-results.json, e2e-scene-budgets.json, epoch-scene-budgets.json; HTML report: e2e-report/. The final run has no failure traces.

## Corrected regressions

Earlier runs found unreachable short-desktop settings, preview learning leaking into a personal save, Vary: Origin offline cache misses, and replay updating the save timestamp. Those regressions now pass.

Final manual inspection additionally found Hallucigenia and Opabinia animation poses outside model-viewer's default framing. Their default node poses now match the supplied Idle first frame, retaining animation/accessor/texture bytes. The new render-pixel check catches both original files and passes all 13 release files; see specimen-framing.md for negative-control evidence.

## Limits

This run uses headless desktop Chromium with software WebGL, not a physical mobile GPU. Triangle counts cannot establish real-device FPS, thermals or memory stability. Actual Android/iOS AR, device speech/audio, Safari/WebKit, Firefox, screen-reader combinations and a 60–90 minute classroom study remain unverified. Screenshots and the virtual-clock demo do not constitute a competition video.
