# Licensed paleo model research

## Current release update — 2026-10-30

The current release contains **13 models**: the seven documented below plus six CC BY 4.0 reconstructions (Anomalocaris, Hallucigenia, Opabinia, Dimetrodon, Mosasaurus and Lystrosaurus). There are ten animated reconstructions and three scans, totaling **11,989,972 release bytes**; 35 content entries still use procedural diagrams. The minimum 24-model target remains open.

The additions' authors, acquisition and license chain are in `assets-next/invertebrates/REPORT.md` and `provenance.json` in that directory. Final release hashes/counts are in `model-validation.json`. Hallucigenia and Opabinia received an additional default-pose correction retaining animation samples and texture bytes; see `specimen-framing.md`. All thirteen pass actual model-viewer visible-pixel checks and production E2E. Meganeura and Dalmanites remain excluded for the reasons recorded with the new research.

## Original seven-model research record

The following sections preserve the earlier acquisition results, byte totals and search limitations as history, not the current inventory. The old statement about no additional museum scans does not exclude the later licensed reconstructions.

Research began on 2026-10-25 and was completed/rechecked on 2026-10-30. The result is **seven exact taxon models for the 48 content entries**, not the requested ideal of 24 or more. Four are stylized animated dinosaur reconstructions; three are static museum scans of the named taxon. No generic animal has been renamed to fill a missing taxon.

## Shipped assets and measured limits

The actual release GLBs pass the limit of **20,000 triangles and 2,097,152 bytes per file**. Triangle counts include instantiated meshes in the default scene. All images and buffers are embedded, there are zero external resources, and none requires a decoder extension. All files loaded in Three.js and rendered without page errors. The current contact sheet is `evidence/model-contact-sheet.png`; the load results are `evidence/model-inspection.json`.

| Species ID | Exact source identity / representation | Author | Triangles | Release bytes | Animation |
| --- | --- | --- | ---: | ---: | --- |
| apatosaurus | Apatosaurus; stylized genus-level reconstruction | Quaternius | 1,438 | 380,792 | 6 clips |
| stegosaurus | Stegosaurus; stylized genus-level reconstruction | Quaternius | 2,282 | 423,020 | 6 clips |
| tyrannosaurus | TRex / Tyrannosaurus reconstruction | Quaternius | 1,820 | 336,568 | 6 clips |
| triceratops | Triceratops; stylized genus-level reconstruction | Quaternius | 1,332 | 309,680 | 6 clips |
| archaeopteryx | Archaeopteryx siemensii Dames, PAL509743; fossil slab | Smithsonian NMNH | 19,999 | 711,172 | Static |
| mammoth | Mammuthus primigenius (source spells author “Blumbach”); skeleton | Smithsonian NMNH | 20,000 | 848,344 | Static |
| megalodon | Carcharocles megalodon, USNM V 10333; tooth | Smithsonian NMNH | 20,000 | 543,096 | Static |

Total release model bytes: **3,552,672**. The three museum scans show preserved material rather than living reconstructions. The megalodon asset is only a tooth; the Archaeopteryx asset is only a fossil slab. Apatosaurus, Stegosaurus and Triceratops are author-labelled at genus level, matching the genus-level content entries. A stylized TRex model does not constitute an anatomically exact reconstruction of a particular Tyrannosaurus specimen.

## Quaternius provenance and download URLs

Author: **Quaternius**. Pack: [Animated Dinosaurs](https://quaternius.com/packs/animateddinosaurs.html). The page returned HTTP 200 on 2026-10-30 and explicitly links **CC0** to [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/). It links to the author's [public Drive pack folder](https://drive.google.com/drive/folders/1u5Fhu3ziuRlGonW6bUI7uClqBGoSNeF6?usp=sharing). The accompanying license text is preserved in `public/models/LICENSE-Quaternius.txt` and the earlier research cache.

| Source FBX | Original bytes | Public download URL |
| --- | ---: | --- |
| Apatosaurus.fbx | 1,142,508 | [download](https://drive.google.com/uc?export=download&id=1v3ZGBrJjA_zGQN6s-9NyZ1eYqbPOYDC2) |
| Stegosaurus.fbx | 1,133,964 | [download](https://drive.google.com/uc?export=download&id=1MS0H-3g1tYRiMxmE0bJIGudG56y_h8G2) |
| Trex.fbx | 1,074,060 | [download](https://drive.google.com/uc?export=download&id=1JvVm-GNg4nD4MMWRxhsYu1AaxprOIUmy) |
| Triceratops.fbx | 1,087,452 | [download](https://drive.google.com/uc?export=download&id=1M_CsgQ-e-H7XWBTNlTCRpP6RBe7cM-4A) |

The earlier research downloaded the real binary FBX files, which remain under ignored `evidence/tmp/`; their Kaydara binary FBX signatures were checked on 2026-10-30. **The fresh 2026-10-30 download requests returned HTTP 200 HTML saying “Google Drive - Quota exceeded”, not the model binaries.** These URLs are actual source links, but current HTTP 200 alone must not be represented as a successful binary download. Raw results are in `evidence/asset-http-verification.json`, and the pack page remains available.

Transformation: FBX2glTF v0.9.7 conversion to GLB, preserving materials, skinning and supplied clips. The six actions are Attack, Death, Idle, Jump, Run and Walk. The original Apatosaurus death clip has the erroneous name `Armature|Stegosaurus_Death`; it remains listed honestly in the manifest. The provided clips are stylistic animation, not claims about fossil evidence or animal behavior.

## Smithsonian provenance and verified binary download URLs

Author/collection: **Smithsonian Institution, National Museum of Natural History**. License: **CC0**, evidenced by the [Smithsonian Open Access AWS registry](https://registry.opendata.aws/smithsonian-open-access/) and its [source YAML](https://raw.githubusercontent.com/awslabs/open-data-registry/main/datasets/smithsonian-open-access.yaml), which explicitly identifies `arn:aws:s3:::smithsonian-open-access`, region `us-west-2`, with `License: CC0`. Both returned HTTP 200 on 2026-10-30. These three files were downloaded from that named open-access bucket and rechecked as real GLB binaries. A generic copyright line in the Voyager software document is not being treated as a license; the bucket's explicit CC0 grant is the license evidence.

| Asset | Taxon/title evidence | Original GLB download | Original bytes |
| --- | --- | --- | ---: |
| Archaeopteryx | [object document, PAL509743](https://3d-api.si.edu/content/document/3d_package:391660da-7c49-499c-91f5-88a298686c09/document.json) | [PAL509743-20k-thumb.glb](https://smithsonian-open-access.s3.us-west-2.amazonaws.com/3d/391660da-7c49-499c-91f5-88a298686c09/PAL509743-20k-thumb.glb) | 160,256 |
| Mammoth | [object document](https://3d-api.si.edu/content/document/3d_package:341c96cd-f967-4540-8ed1-d3fc56d31f12/document.json) | [woolly-mammoth-20k-512-thumb.glb](https://smithsonian-open-access.s3.us-west-2.amazonaws.com/3d/341c96cd-f967-4540-8ed1-d3fc56d31f12/woolly-mammoth-20k-512-thumb.glb) | 214,776 |
| Megalodon | [object document, USNM V 10333](https://3d-api.si.edu/content/document/3d_package:106e215b-a829-40c6-8e4d-dfba37350f36/document.json) | [carcharodon-megalodon…20k…glb](https://smithsonian-open-access.s3.us-west-2.amazonaws.com/3d/106e215b-a829-40c6-8e4d-dfba37350f36/carcharodon-megalodon-(usnm-v-10333)-20k-512-thumb.glb) | 107,236 |

All six object-document/binary URLs returned HTTP 200 on 2026-10-30; binary files have the GLB header and byte sizes shown. Documents identify the model derivatives, catalogue identities and original millimetre units. The megalodon record uses Carcharocles and the download basename uses Carcharodon; its content entry uses the currently common placement Otodus. This is the same taxon, with the naming discrepancy disclosed.

Transformation: use the publisher's 20k derivative; decode Draco to ordinary geometry with glTF Transform, retain embedded source images and serialize as GLB; apply source model orientation and 0.001 scale in a parent node using `evidence/normalize-si-models.mjs`. This normalization is already applied to release files; the script detects the named parent and skips models already normalized. The decoded files are larger than the source compressed files but remain below 2 MiB. Source metadata calls the Archaeopteryx derivative 20,000 faces; the shipped geometry actually contains 19,999 triangles, which is the measured count reported here.

## Candidates excluded from release

The cached Open Access index covers **2,355 object UUIDs**, of which **2,337 returned a successful document**; there were 18 request errors/non-200 responses. The index is a snapshot, not proof that every Smithsonian object was searched. Searching its titles for the remaining content taxa found no additional exact matches. A second Mammuthus object is the same taxon and would not increase coverage. In particular the index had no qualifying extra match for Dimetrodon, Lystrosaurus, Lepidodendron, dodo/Raphus, Smilodon, Megaloceros, or the requested Cambrian taxa. No exhaustive crawl beyond this cached index was claimed.

| Candidate | Evidence / disposition |
| --- | --- |
| Quaternius Parasaurolophus and Velociraptor | Real CC0 models, but neither taxon appears among the chosen 48 content entries. Not substituted for another dinosaur. |
| Smithsonian Thrinaxodon liorhinus, USNM V 00022812 | Real CC0 fossil scan, 20,000 triangles / 717,520 release-candidate bytes, but does not match Lystrosaurus or any chosen content entry. [object document](https://3d-api.si.edu/content/document/3d_package:e0ac6fea-5384-4787-9abc-cdfffec833c1/document.json) |
| Smithsonian Diademodon tetragonus, USNM V 00023352 | Real CC0 skull scan, 20,000 triangles / 635,276 release-candidate bytes, but does not match a chosen taxon. [object document](https://3d-api.si.edu/content/document/3d_package:6758ddb3-2eea-49ad-89e2-a2973e7143eb/document.json) |
| Homo sapiens, Cro-Magnon 1 cranium | [Human Origins specimen page](https://humanorigins.si.edu/evidence/3d-collection/fossils/904/cro-magnon-1) explicitly identifies the taxon; cached [Voyager document](https://3d-api.si.edu/content/document/3d_package:09d681b2-5ae9-44a8-b444-8e31bb40305e/document.json) offers a 20k derivative. The UUID and asset are absent from the cached CC0 bucket listing, and the cached object document does not explicitly grant a reusable license. Excluded pending explicit license evidence. Absence from the listing alone does not prove a restrictive license. |
| Homo neanderthalensis, La Ferrassie cranium | Cached Human Origins page identifies the taxon and [Voyager document](https://3d-api.si.edu/content/document/3d_package:62c5a1ab-24bc-467d-8566-5e67be2fc41d/document.json) offers a 20k derivative. Same unresolved explicit-license issue as Cro-Magnon; excluded. |
| Digital Atlas of Ancient Life / PRI virtual collections | Promising scans, but cached collection pages contain differing CC0 and CC BY-SA statements. No exact chosen taxon with both verified unrestricted downloadable binary and unambiguous per-model license was completed; not included. |
| Sketchfab / other browsing leads | A public preview or Creative Commons label is insufficient when an authorized public binary download is unverified. No authenticated or scraped viewer reconstruction was used. |

The four completed but unused candidates were moved from `public/models/` into ignored `evidence/tmp/candidates/`. Their metadata is retained in `evidence/model-candidates.json`. Only the seven manifest models remain in the release directory.

## Reproducible checks

Run `npx tsx scripts/validate-models.ts`. It reads each release GLB, checks GLB v2 chunk lengths, embedded resources, scene triangle counts, byte limits, animation names and positive duration metadata, and rejects missing/unmanifested `.glb` files. It emits `evidence/model-validation.json` with SHA-256 hashes. It does not claim scientific anatomical validation or guarantee every animation pose is physically realistic.

The fresh audit passes seven models. A separate Three.js browser load/render check passed seven with zero page errors, and its screenshot was visually inspected on 2026-10-30. The clip names are in the manifest and audit. Static fossils remain correctly identified as static. `CREDITS.md` records all shipped model sources and transformations. No content/source UI was changed during this asset completion step.
