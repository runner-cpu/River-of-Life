### Spec compliance

❌ Issues found. Build, browser and copied-site identities now use the same complete digest. The requirement to reject incomplete runs still fails when every required file has some results but a test is missing (`scripts/release-evidence.ts:75`, `scripts/package-competition.ts:13`).

⚠️ The actual JSON reporter lifecycle remains a root integration check. Confirm the root's unfiltered browser JSON contains the two equal digests and both true flags, then pass that actual report through the shared validator. The direct callback test exercises mutation of a local config object (`tests/release-evidence.test.ts:83`).

### Strengths

- I checked the shared helper for the concrete risk that offline inventory exclusions could also affect the release digest. `scripts/build-identity.ts:15` sorts normalized paths, `scripts/build-identity.ts:23` hashes all of their bytes, and `scripts/build-identity.ts:27` separately incorporates the worker template in the cache revision. Build verification still checks the rendered worker and manifest bytes (`scripts/verify-build.ts:13`). Site and evidence hashes are compared before packaging and after the site copy (`scripts/package-competition.ts:10`, `scripts/package-competition.ts:14`, `scripts/package-competition.ts:22`).
- Setup marks evidence unfinished before checking the initial digest. An observed change, watcher error, or mismatched final digest prevents success. The teardown closes the watcher even if hashing or validation throws (`scripts/release-evidence.ts:29`, `scripts/release-evidence.ts:36`, `scripts/release-evidence.ts:42`, `scripts/release-evidence.ts:47`). The validator independently rejects failures on test attempts and global errors (`scripts/release-evidence.ts:73`, `scripts/release-evidence.ts:77`).
- I checked the remainder of the packager for the concrete risk that the seeded PDF and the reviewed PDF reside at different paths. It compares the source markdown and reviewed PDF before copying, verifies the final packaged PDF and material links, and rechecks final manifest hashes (`scripts/package-competition.ts:17`, `scripts/package-competition.ts:58`, `scripts/package-competition.ts:59`, `scripts/package-competition.ts:69`).

### Issues

**Important — incomplete runs pass.** `scripts/release-evidence.ts:75` compares the count to the report's own rows, and `scripts/release-evidence.ts:76` only requires a single test per required file. A focused, in-memory probe supplied the production validator with the historic fixture, removed one spec from a file that still had tests and reduced the expected count by one. Both 69/69 and 68/68 passed with the identical 12 required file names and identical build identity. A previous run for the same build also remains acceptable after a new case is added to an existing spec. Compare an independently discovered inventory of expected test identities, including project, with the reported tests and reject missing, duplicate or extra rows. Cover removal from a nonempty file with internally consistent totals.

**Minor — a failed copy verification leaves a partial release directory.** `scripts/package-competition.ts:21` writes directly to the final timestamped output. The new mismatch error at `scripts/package-competition.ts:22` leaves an apparently named competition package containing the rejected site. The process does fail and no completed manifest has been written. Stage under a distinct temporary name and publish the directory only after all checks pass, cleaning up only the temporary directory created by that invocation.

### Assessment

**Task quality — Needs fixes.** The bytes and passing outcomes are checked, but the validator has no independent record of which tests were required. The incomplete-run probe is the only extra runtime check in this review. The reported 29 focused tests were not repeated.
