# solid-memento — Design reference

Pod-native Memento (RFC 7089) integration. Sourced from D61-D68, K1, and RQ-Memento-1/2 in `.claude/rules/decisions-index.md`.

## Phase 5 — Memento (D61–D64)

### D61 — URI minting convention

Memento URI minting convention — Trellis-style query strings. OriginalResource doubles as TimeGate (RFC 7089 Pattern 1.1). TimeMap at `?ext=timemap`, Memento at `?version=<14-digit-datetime>`.

### D62 — ACP inheritance across Mementos

ACP applies to OriginalResource and inherits across all Mementos — no time-fragmented ACP in v1; RQ-Memento-1 tracks future need.

### D63 — Standards-aligned vocabulary

Standards-aligned vocabulary for pod-native versioning — mint nothing in v1. Reuse Memento + LDES + AS2 + PROV-O + VCDM + ACP.

### D64 — Soft delete + hard purge

Soft delete via tombstone + hard purge as VC-gated distinct operation — Layer 1: LDP DELETE → `ldes:DeletedLDPResource` + `as:Delete` commit (routine VC). Layer 2: `?ext=purge` → `git filter-repo` (elevated VC with `acp:purgeAllowed`). Layer 3 crypto-shredding deferred.

## Phase 5b — Rung 1.1 implementation (D65–D68)

### D65 — MonitoringStore-driven CDC

MonitoringStore-driven CDC over fswatch for Memento substrate — listen to CSS's native `'changed'` event (D17 internal CDC) instead of inotify/fswatch sidecar. Synchronous with the write, knows WebID + identifier + activity type, no second process, matches the architecture D17 already prescribes. (Original plan called fswatch a "spike hack"; in-repo `PassthroughStore` precedent in `shape-validator/src/storage/ShapeValidationStore.ts` proves the wrap-pattern is viable.)

### D66 — Per-path staging in commit listener

Per-path staging in commit listener — `git add -- <path>` + `commit --only -- <path>` per resource event, not `git add -A`. Reason: TimeMap-per-resource depends on `git log -- <path>` returning one commit per write to that path; `add -A` lumps concurrent writes from sibling resources into the wrong commits. Verified by `test_concurrent_writes_to_different_paths_produce_separate_commits`.

### D67 — Additive Link/Vary headers via `MementoLinkMetadataWriter`

Additive Link/Vary headers via `MementoLinkMetadataWriter` — CSS's `addHeader` accumulates Link entries across MetadataWriters, so a parallel writer that ALWAYS emits `Link: <...?ext=timemap>; rel="timemap", <orig>; rel="timegate"` and `Vary: accept-datetime` advertises Memento support per RFC 7089 §4.1.1 without conflicting with CSS's `LinkRelMetadataWriter`. Inserted after `MetadataWriter_LinkRel` in the `urn:solid-server:default:MetadataWriter` ParallelHandler. Closes a real conformance gap: Memento-aware clients can now discover the TimeMap from a plain GET.

### D68 — Filesystem lock for multi-worker safety

Filesystem lock for multi-worker safety — `.git/memento.lock` (in the git dir so it's outside the worktree and never staged) acquired via `O_CREAT | O_EXCL` open with stale recovery via mtime check. Wraps every `gitCommit{,Path}` call. Avoids `.git/index.lock` races between CSS workers. ~10 LOC, no extra dependency. Bare-minimum hardening for the "multi-worker mode in future deployment" case the reviewer flagged.

## Known limitations

### K1 — Components.js OverrideListInsertAt against empty list

`OverrideListInsertAt` against an empty handlers list reproducibly fails with a Components.js `collectEntries` error in v8.0.0-alpha.3. Worked around by `overrideParameters` (full replacement) of `urn:solid-server:default:WorkerParallelInitializer`; documented in `css/config/memento.json` with a revisit-when-target-exists note.

## Open research questions

### RQ-Memento-1 — ACP fragmentation across time travel

When does D62 inheritance break? Open. Tracked when time-fragmented ACP becomes a real requirement.

### RQ-Memento-2 — Federated time travel

Does Comunica propagate `Accept-Datetime` to every source? Open; gated on RQ-Federation-1 (cross-pod SPARQL federation works at all).

## Authoritative artifacts

- Implementation: `css/extensions/memento/` (TypeScript CSS v8 extension)
- Vocabulary alignment: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Memento Vocabulary Alignment.md` (vault, canonical)
- Rung 1.1 commit: `f94228c` (read-only Memento + MementoCommitListener + Link/Vary headers)
- Rung 1.2 commit: `741e9b8` (tombstone semantics for DELETE)
