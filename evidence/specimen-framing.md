# Animated specimen framing regression

2026-10-30. Final in-app browser inspection showed a blank Hallucigenia model-viewer stage even though `loaded` was true. A separate contact sheet using the same viewer settings reproduced it for Opabinia too. The earlier Three.js contact sheet passed because `placeModel` initializes the animation before measuring posed geometry.

The default node transforms differed from the supplied Idle first frame: Hallucigenia's default bounding-box center was approximately `(0.482, 1.305, -0.004)` despite its visible length being about 0.03 units; Opabinia's default center was approximately `(13.291, 3.584, -13.252)`. Their animations moved into different coordinates after the viewer camera was framed.

`prepare-idle-pose.mjs` aligns only default translation/rotation/scale properties to the existing Idle first sample. It retains animation accessor samples, skin inverse-bind matrices, geometry and texture bytes, registers all material extensions and round-trips the result. Detailed node changes, preserved-byte assertions and final hashes are in `idle-pose-preparation.json`. Attribution and processing notices were updated in the manifest, CREDITS and shipped ATTRIBUTION.

Final sizes: Hallucigenia 1,827,404 bytes; Opabinia 772,360 bytes. Triangle/animation counts remain 19,000 / Idle and 4,836 / Idle. All thirteen models total 11,989,972 bytes and pass the release gate.

Verification uses actual model-viewer render output, not the load flag. Opaque model pixels must occupy more than 0.5% of the render area; HTML prompts and CSS backgrounds are absent, and translucent shadows are excluded. The original-pose negative control has **zero** opaque pixels for both affected assets. Corrected files measure approximately **4.08%** and **4.44%**; all thirteen release models pass. This is a blank/offscreen regression check, not an anatomical-quality judgment.

Evidence:

- `model-viewer-inspection-original-pose.json` and `model-viewer-contact-sheet-original-pose.png`: original-pose negative control.
- `model-viewer-inspection.json` and `model-viewer-contact-sheet.png`: corrected actual-component results.
- `browser-hallucigenia.png`: final production exhibit inspected in the in-app browser.
- `tests/e2e/museum.spec.ts`: the model traversal now requires rendered pixels.

Reproduce with the dev server at port 5174: `node evidence/inspect-model-viewer.mjs --original-pose`, then `node evidence/inspect-model-viewer.mjs`. The original-pose run needs ignored research candidate GLBs. Production E2E needs only shipped files.
