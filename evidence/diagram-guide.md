# Diagram and local guide corrections

Verified 2026-10-30.

- `stromatolites` now uses layered domed rock structures in both Three.js and SVG; `cooksonia` uses naked branching axes with terminal sporangia; `lepidodendron` uses a branching tree with diamond leaf-base marks. These remain original educational diagrams. Shapes follow the existing card descriptions; no new reconstruction claims were added. All three have no animation joints and are excluded from the scene's swimming-form list.
- The specimen's collapsible **达尔文导览** uses **384 deterministic rules across 48 published cards**, with eight suggested topics per card and a text input. Answers quote the current card's fields and expose its existing reference links, levels and check dates. Exact supported question forms are matched locally. Unsupported questions and questions about other cards receive a conservative fallback. No model, network call or new biological claim is involved. References are explicitly card-level, not newly verified sentence-level citations.
- Native buttons, details/summary, form labels, focus outlines and a polite live answer region support keyboard use. An AbortController removes guide handlers when the specimen dialog is removed.
- Size comparison now says **代表尺寸**, identifies the adult reference as height and explains the card's different measurement axes. The collection button says **免费收藏** when no specimen has been collected.

Checks: `npx tsc --noEmit` passed. A Node/tsx assertion run verified all 384 answers quote their original fields and references; all **3,312 supported phrasings** route to the expected topic; unrelated, cross-species and invented-claim questions fall back; the three corrected forms produce finite bounds, zero animated joints and SVG artwork. Full browser/build verification is handled by the parent task.
