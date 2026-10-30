# Six-model integration review — 2026-10-30

Final integration addendum: this review predates the root's actual model-viewer inspection. That check found blank Hallucigenia and Opabinia exhibits despite successful loads. Default poses were subsequently aligned to the existing Idle first frame and a rendered-pixel regression added, with original-pose negative controls. See `specimen-framing.md`. Final release bytes are **11,989,972**, with current hashes in `model-validation.json`. The original review below is retained as its own scope/time record, not proof of final exhibit framing; the two corrected release hashes now intentionally differ from their candidate hashes.

Verdict: no unresolved findings in the reviewed integration after the skeletal resource cleanup fix.

Scope: `src/scene/model-placement.ts`, the imported-model loading and cleanup paths in `src/scene/life-scene.ts`, `src/scene/resource-lifetime.ts`, specimen attribution in `src/modes/specimen.ts`, optional asset fields in `src/core/types.ts`, `scripts/validate-models.ts`, the release manifest and attribution, and the six additions' saved source/provenance evidence. This is a targeted integration review, not a blanket audit of earlier project work.

## Resolved finding

**P2 — release skeleton bone textures when removing imported models.** Chapter replacement (`src/scene/life-scene.ts:60-61`) and scene disposal (`src/scene/life-scene.ts:176`) stopped mixers and released mesh resources, but the original resource tracker omitted `THREE.Skeleton`. Five of the six additions use skinning. Once rendered, their lazily allocated bone textures could survive chapter replacement. A direct reproduction initially returned `geometryDisposed: 1`, `boneTextureDisposed: 0`, `boneTextureStillPresent: true`.

The implementation now retains `THREE.Skeleton` (`src/scene/resource-lifetime.ts:3,15`) and uses the existing reference count to call its disposal only after its final mesh owner is released. The same reproduction after the fix returned `geometryDisposed: 1`, `boneTextureDisposed: 1`, `boneTextureStillPresent: false`. The new shared-skeleton regression test (`tests/resource-lifetime.test.ts:29`) also passes, including lazy allocation after retain, preservation for the first owner, final disposal, and safe repeated release. Finding resolved.

## Review evidence

- `npm test -- --run tests/model-placement.test.ts tests/resource-lifetime.test.ts`: 2 test files, 5 tests passed. Initial animated transforms remain owned by their animation tracks; external-wrapper framing accounts for an initialized skinned pose. The lifecycle tests cover shared mesh resources, textures, and skeletons.
- `npm run validate:models`: all 13 release GLBs passed, 11,989,184 bytes total. This verifies declared triangle/byte budgets against binary contents, embedded resources, absence of required decoder extensions, clip inventory, and release-directory/manifest agreement.
- All six source-binary SHA-256 values match `provenance.json`; all six released binaries match their candidate hashes and the hashes printed in `public/models/ATTRIBUTION.md`. Original artist names and downstream preparation/animation contributor credit are preserved. Manifest modification records exactly combine the saved downstream and local modification records.
- Original saved Sketchfab metadata consistently identifies the six models and records CC Attribution 4.0. The saved downstream licensing guide explicitly preserves CC BY 4.0 for model GLBs and their modifications separately from other content. Runtime credits include title, credited contributors, original source link, license link, modifications, and derivative source link. The supplied full license text and attribution file accompany the release.
- Compared source and release material records, including side flags, metallic/roughness factors, normal-map settings, and the retained IOR/specular extensions. Texture-index renumbering is consistent with conversion; no material-setting regression was found. Source clip names and skinning remain present in release files.
- The saved research contact sheet shows recognizable reconstructions consistent with the six source identities. Meganeura and Dalmanites remain excluded from the release manifest and GLB directory as intended.

No final application browser rendering or interaction validation was performed by this reviewer. Final model-viewer and ecosystem UI proof remains with the integrating agent.
