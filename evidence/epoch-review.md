# Epoch cinematic scoped review

Reviewed on 2026-10-30 against `docs/epoch-cinematics-brief.md`. This was a read-only source review apart from this report. No implementation files were changed and no whole-project legacy test suite was rerun.

## Verdict

No actionable correctness defect found in the reviewed implementation after the replay completion guard was added. This verdict is scoped to the epoch implementation and integration paths described below, not a certification of physical-device performance or all pre-existing application behavior.

The previously observed replay mutation is addressed at `src/main.ts:121`: `store.complete` is called only for a first journey completion. Replays, classroom previews, and demo highlights do not invoke that save-mutating method. The caller captures and restores a replacement trigger after the first completion refreshes the task buttons. The final browser replay rerun is owned by the main agent; this report does not claim its result.

## Review evidence

- `src/scene/epoch-timeline.ts` defines eight distinct themes, palettes and three-stage captions, a ten-second normal duration, and smooth clamped camera interpolation. `src/scene/epoch-cinematic.ts` implements the requested bubbles/water color, radial branching, three anoxia pulses, volcano/ash, fissure/ecological replacement, asteroid/ring/dust, cooling/grass expansion, and ice/migration illustrations. Impact behavior uses smooth object, opacity and scale changes rather than a screen flash. Scientific source text remains in the existing chapter records; the dialog explicitly labels time compression and abstract teaching imagery.
- `src/modes/epoch-event.ts` owns one playback clock, its interval and RAF. Pause and visibility handling exclude paused time. Skip ends at a readable summary outside demo mode. The closed guard, explicit timer/RAF cancellation, listener removal, and idempotent scene/audio disposal prevent a removed event from continuing to update. `src/main.ts:115` clears the active reference before disposal and the close callback checks object identity before touching current global state.
- Graphics teardown disconnects the resize observer, disposes tracked geometries and materials, clears update closures and scene children, and disposes/loses the owned renderer context. Constructor and context-loss paths retain readable fallback content. Geometry and draw-call tests cover all eight scenes. Existing headless measurements in `evidence/epoch-scene-budgets.json` show 1,236–6,032 rendered triangles and 12–59 draw calls at the sampled reduced-motion keyframes; these are structural samples, not FPS measurements or full-animation peak measurements.
- Reduced-motion playback holds camera, object and shader time at one static keyframe and does not start the animation RAF. System preference changes update that choice. Source tests cover desktop/mobile/low-quality pixel-ratio caps and the static keyframe behavior.
- The native dialog has an accessible name, `aria-modal`, Escape handling, focus wrap, and restoration to the trigger or main content. Its scrollable body and fixed controls support reading long copy while retaining exit controls. The scoped E2E file checks named dialogs, chapter text, keyboard containment, trigger restoration, summary behavior, mobile horizontal fit and WebGL fallback; the main agent owns the browser execution and screenshots.
- `src/modes/epoch-audio.ts` creates no context with sound disabled, uses local synthesis only, and catches unavailable/resume-failed audio. Pause survives asynchronous context resume. Teardown fades running oscillators, then disconnects and closes the context, with an idempotent 120 ms fallback if the audio clock stops before `onended`. The normal short fade means audio graph release is deliberately bounded rather than synchronous.
- Journey completion preserves the original store reward mechanism. Classroom preview closes back to its paused preview scene and resumes it. Demo takeover routes through `stopDemo`, clears the demo interval, closes the epoch, and restores the user's chapter without using the persistent store for demo progress.

## Verification performed by this review

- `npx vitest run tests/epoch-timeline.test.ts tests/epoch-scene.test.ts tests/epoch-audio.test.ts`: **32 passed**, 3 files.
- `npx tsc --noEmit`: **passed**.
- Read the four current cases in `tests/e2e/epochs.spec.ts`. Did not rerun them concurrently with the main agent's final browser run. The main agent reported that its earlier all-eight-scenes, pause/keyboard and fallback runs passed and that its replay case identified the now-fixed save mutation.

## Explicit boundaries and remaining verification limits

- The parent demo remains a fixed 90-second presentation. Pausing its epoch stops that epoch clock, but the parent timer in `src/main.ts:219` still closes the whole demo at 90 seconds. This is consistent with the existing fixed-duration demo design; it is not an indefinite pause of the entire presentation. A future change to that product behavior would need coordinated clocks.
- Unit renderer mocks prove ownership calls and geometry bounds, not absence of every browser/driver allocation. The headless scene budgets cannot establish mobile thermals, memory stability, real-device FPS, or visual quality on every GPU.
- The checked-in mobile E2E validates horizontal fit at 390 × 600 and reaches the controls; it does not prove every narrow/short viewport or screen-reader combination. The CSS has a separate short-desktop layout, but this review did not perform manual browser/device accessibility testing.
- No physical-device audio listening, mobile browser test, AR behavior, or cross-browser engine test was performed by this review. No new precise scientific statistics were introduced by these modules; specialist review of the existing chapter science remains outside this task.
