# Task 1 report — DONE

Implemented only the relationships view and the approved read-only specimen boundary on branch `codex/interaction-enhancement` in this isolated worktree.

## Files and behavior

- `src/content/relationships.ts`: derives editorial chapter groups and source-checked published species by reference to original data; no duplicated years.
- `src/core/relationships.ts`: range union, finite log(1 + MYA) time transform, calculated duration/percentage anchors, immutable expansion toggle.
- `src/modes/relationships.ts` and `.css`: eight expandable chapter rows, all 48 archives, SVG time ranges and labeled MYA ruler, group/list alternative, selection details, narrow default list, responsive wrapping and reduced-motion styles. Chapter and archive periods remain independent; no clamping of long-lived groups into chapter windows. Explicit phylogeny/coexistence disclaimer. No zoom interaction.
- `src/core/types.ts`, `src/main.ts`: route and navigation integration, approved actual readOnly invocation. Existing read-only diagnostics adds cloned Progress for real browser memory-ledger comparisons.
- `src/modes/specimen.ts`: optional fourth options argument, observe/read/collect/compare/lab guarding at invocation; disabled progression controls; sizes, model interaction, guide, knowledge and sources retained. Default callers retain original behavior.
- `src/modes/help.ts`: relationship entry and organization explanation.
- `tests/relationships.test.ts`: five pure-data/time/expansion cases.
- `tests/specimen-readonly.test.ts`: two direct invocation-spy cases, including synthetic actions and default caller regression.
- `tests/e2e/relationships.spec.ts`: six real production-browser cases: graph keyboard/focus/collapse, all 48 exhibits by list, 390px and 320px/reduced-motion, model fallback/recovery, production cache/offline refresh.
- `evidence/interaction-enhancement.md`, relationship screenshots, final e2e JSON and build-verification JSON: durable commands, results, assets, compatibility and limitations.

## Executed checks

- `npm run build`: passed (48 cards/8 chapters/144 questions/13 model assets validated; tsc and Vite passed).
- `npm test`: final 110/110 passed, 15 test files.
- `npm run test:e2e`: final 42/42 passed, Chromium, production preview port 4175, 1.7 minutes.
- `npm run verify:build`: passed. JS/CSS gzip 547,026 bytes; app chunk gzip 427,139 bytes; 13 GLBs totaling 11,989,972 bytes; existing manifest and content revision mechanism includes the new bundled code/CSS.

An earlier 40-case run passed completely. Adding two cases and collapse regression exposed service-worker interception in the forced-network-abort fixture (41 pass, one expected-fallback assertion failed because the real model loaded). Scoped SW blocking to that forced-failure test only, preserving actual SW use for offline, and reran the full suite to 42/42. No existing test changed, no assertions removed, no flaky configuration.

Full in-memory Progress including updatedAt, localStorage and IndexedDB are compared before/after read-only opening, synthetic prohibited clicks, comparison, all 48 exhibit loops and offline/model-recovery flows. Unit spies independently prove no observe/read/collect/compare invocation; lab callback never runs. Existing economy, persistence, release resources, model fallback/recovery, scene disposal and demo guarantees remain in the complete regression suite.

## Self-review and visual evidence

Expanded archive source remains in DOM while detail is visible. Collapsing its epoch clears selection/detail/open action, preventing stale modal focus restoration; tested. Selecting a node highlights its archive and editorial epoch in either presentation. Focus is explicitly returned to the selected source immediately before opening so the existing modal restores that node on Escape/close. Timeline ages use the same union range including cross-chapter archives, while time references use chapter-derived overall duration and first-chapter share.

Opened and visually inspected actual automated captures `relationships-desktop.png`, `relationships-390.png`, `relationships-320.png`, `relationships-model-restored.png`. Desktop labels/ticks/ranges/selected highlight and bottom detail are visible. Narrow layouts wrap long chapter labels and Latin names without document overflow, and default to list. Recovered exhibit visibly displays the Smithsonian Archaeopteryx fossil scan, attribution and disabled progression controls. Automated keyboard, reduced motion, no-overflow, model failure/retry and offline checks passed. No separate manual browser interaction, physical touch device, screen-reader, Firefox or Safari checks were performed.

## Impact and limits

No new dependencies, persistent fields, Progress version or save validation changes. Imports/exports retain current semantics. No new runtime network service. Generated SVG uses the already cached JS/data; production offline preparation then disconnection/refresh was exercised. External source websites, speech and AR retain existing connectivity limits. Diagram can be internally horizontally scrolled if deliberately selected on narrow devices; default list avoids this. Educational grouping is not a phylogenetic tree and does not imply coexistence. No other plan tasks were implemented. No concrete blockers remain.
