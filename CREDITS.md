# Model credits

Model inventory checked on 2026-10-30. Thirteen models are shipped: seven under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) and six under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). These credits and the in-app attribution preserve original and derivative authors, source links, modifications and scientific limits.

| Release file | Creator / collection | Exact source identity | Source |
| --- | --- | --- | --- |
| `public/models/apatosaurus.glb` | Quaternius | Apatosaurus, stylized genus-level reconstruction | [Animated Dinosaurs](https://quaternius.com/packs/animateddinosaurs.html) |
| `public/models/stegosaurus.glb` | Quaternius | Stegosaurus, stylized genus-level reconstruction | [Animated Dinosaurs](https://quaternius.com/packs/animateddinosaurs.html) |
| `public/models/tyrannosaurus.glb` | Quaternius | TRex, stylized Tyrannosaurus reconstruction | [Animated Dinosaurs](https://quaternius.com/packs/animateddinosaurs.html) |
| `public/models/triceratops.glb` | Quaternius | Triceratops, stylized genus-level reconstruction | [Animated Dinosaurs](https://quaternius.com/packs/animateddinosaurs.html) |
| `public/models/archaeopteryx.glb` | Smithsonian Institution, National Museum of Natural History | PAL509743, catalogued as Archaeopteryx siemensii Dames; fossil slab | [Voyager object document](https://3d-api.si.edu/content/document/3d_package:391660da-7c49-499c-91f5-88a298686c09/document.json) |
| `public/models/mammoth.glb` | Smithsonian Institution, National Museum of Natural History | Mammuthus primigenius; skeleton scan | [Voyager object document](https://3d-api.si.edu/content/document/3d_package:341c96cd-f967-4540-8ed1-d3fc56d31f12/document.json) |
| `public/models/megalodon.glb` | Smithsonian Institution, National Museum of Natural History | USNM V 10333, catalogued as Carcharocles megalodon; tooth scan (now often Otodus megalodon) | [Voyager object document](https://3d-api.si.edu/content/document/3d_package:106e215b-a829-40c6-8e4d-dfba37350f36/document.json) |

Quaternius models were converted from the author's FBX files into GLB with FBX2glTF v0.9.7. Materials, skinning and six supplied animation clips per model were retained. The Apatosaurus file's death clip is named `Armature|Stegosaurus_Death` in the source; this name has been retained and does not indicate a second species model. Colors, jumping, attacks and other actions are artistic choices, not fossil evidence. The author's pack page explicitly labels the pack CC0; a copy of the accompanying license is in `public/models/LICENSE-Quaternius.txt`.

In the interactive habitat, the FBX-derived Phong materials use non-metallic, matte surface response (metalness 0, roughness 0.82); source colors and textures are preserved. The GLB files and scanned exhibits retain their supplied materials.

Smithsonian models came from the 20k thumbnail GLB derivatives in the Smithsonian Open Access S3 bucket. Draco geometry was decoded into ordinary glTF geometry and serialized with glTF Transform; original embedded images were retained. A parent node applies the orientation from each source Voyager document and a uniform 0.001 scale to convert millimetres to metres. No living body, missing skeleton parts or animations were invented. These files depict a slab, skeleton and tooth respectively. The [Smithsonian Open Access registry](https://registry.opendata.aws/smithsonian-open-access/) explicitly licenses the named bucket CC0; see its [registry source](https://raw.githubusercontent.com/awslabs/open-data-registry/main/datasets/smithsonian-open-access.yaml) and `public/models/LICENSE-Smithsonian.txt`.

Exact original download URLs, file sizes, source identities, current HTTP results, excluded candidates and verification details are in `evidence/asset-research.md`. `public/models/manifest.json` is the shipped inventory. `evidence/model-validation.json` records hashes and measured budgets. Four unused research candidates are outside the release directory under the ignored `evidence/tmp/candidates/` directory; they are not shipped assets.

## CC BY 4.0 additions (2026-10-30)

The following binaries were obtained from the publicly distributed model derivatives of Prehistoric Animal Museum. Its model-specific notices and licensing guide explicitly retain CC BY 4.0 for models and derivative animation, separately from its other content. Each original Sketchfab record was also checked. Only the model binaries were reused; no upstream application code, backgrounds, narration or brand assets were copied.

| Release | Original title | Attribution | Original source | Derivative |

| --- | --- | --- | --- | --- |

| `anomalocaris.glb` | Anomalocaris 3D Model | Skache; derivative animation/preparation: Prehistoric Animal Museum contributors | [model](https://sketchfab.com/3d-models/anomalocaris-3d-model-dad76e60589a41e18a42db1e979f81f8) | [derivative](https://leon-made-this.work/museum/en/animals/anomalocaris/) |

| `hallucigenia.glb` | Hallucigenia Cambrian Animal | huykhoi2407; derivative animation/preparation: Prehistoric Animal Museum contributors | [model](https://sketchfab.com/3d-models/hallucigenia-cambrian-animal-fad8306e863a4960b48e49c16c3806cf) | [derivative](https://leon-made-this.work/museum/en/animals/hallucigenia/) |

| `opabinia.glb` | Cambrian Alien (Alien Weekly Challenge) | billionlioe; derivative animation/preparation: Prehistoric Animal Museum contributors | [model](https://sketchfab.com/3d-models/cambrian-alien-alien-weekly-challenge-d2111e360cdc4243aac23871836c49f5) | [derivative](https://leon-made-this.work/museum/en/animals/opabinia/) |

| `dimetrodon.glb` | Dimetrodon | cp4096; derivative animation/preparation: Prehistoric Animal Museum contributors | [model](https://sketchfab.com/3d-models/dimetrodon-3ac7c6aada5e4c03849f9544bbc1afed) | [derivative](https://leon-made-this.work/museum/en/animals/dimetrodon/) |

| `mosasaurus.glb` | Mosasaurus | Lukiethewesly13; derivative animation/preparation: Prehistoric Animal Museum contributors | [model](https://sketchfab.com/3d-models/mosasaurus-fe0c25c4ed4e4d4aa05312121e2f68df) | [derivative](https://leon-made-this.work/museum/en/animals/mosasaurus/) |

| `lystrosaurus.glb` | lystrosaurus | seth the yutyrannus; derivative animation/preparation: Prehistoric Animal Museum contributors | [model](https://sketchfab.com/3d-models/lystrosaurus-32ea6a3bedd948638f9add8da7483b28) | [derivative](https://leon-made-this.work/museum/en/animals/lystrosaurus/) |

Original and downstream changes, acquisition hashes and license evidence are preserved in `evidence/assets-next/invertebrates/provenance.json` and the model-only notices excerpts. The complete shipped attribution is `public/models/ATTRIBUTION.md`; the full license text is `public/licenses/CC-BY-4.0.txt`. Runtime knowledge cards expose the source, license and modification record.

Local conversion decoded meshopt/quantized geometry where present, deduplicated and welded geometry, reduced meshes to at most 20,000 triangles, resized images to 512px, preserved supplied materials, skinning and named clips, then serialized self-contained GLBs. Anomalocaris and Mosasaurus textures use JPEG quality 82 to fit 2 MiB; the other four retain PNG. These are artistic reconstructions, not exact preserved appearances.

Hallucigenia and Opabinia additionally align their default node transforms to the existing Idle's first frame, preventing the animated model from leaving model-viewer's initial camera framing. Animation samples, inverse-bind matrices, geometry and texture bytes are preserved; the conversion and per-node record are in `evidence/prepare-idle-pose.mjs` and `evidence/idle-pose-preparation.json`.

Meganeura was excluded because its CC-labelled upload explicitly references Dinoraul, whose original commercial model leaves relicensing authority unresolved. A real CC0 Dalmanites scan was also acquired but its fragmented/decimated shape was not suitable for the current introductory stage, so it is research-only. Neither counts toward the shipped thirteen.

## Application libraries and original diagrams

The production application uses Three.js 0.183.2 (MIT), Google model-viewer 4.4.0 (Apache-2.0), and Lucide 0.468.0 (ISC). Draco decoder files supplied by the installed Three.js package are included for the loader's supported compressed formats; Draco uses Apache-2.0. Copies of the license texts are shipped in `public/licenses/`. The thirteen current models use embedded uncompressed geometry and do not require Draco. Package versions and the complete dependency graph are recorded in `package-lock.json`.

The remaining procedural meshes and SVG card illustrations were authored for this project with AI programming assistance. They are educational structure diagrams, not external museum scans or verified scientific reconstructions, and do not count toward the specification's minimum of 24 licensed 3D assets. No new raster image was generated. See `AI_USAGE.md` for the development disclosure and `docs/delivery-status.md` for remaining review and asset requirements.
