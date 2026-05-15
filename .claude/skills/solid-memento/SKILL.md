---
name: solid-memento
description: Memento (RFC 7089) integration on this Pod — Trellis-style query-string URI minting, MonitoringStore CDC, tombstone semantics via LDES + AS2. Read-only Memento shipped Rung 1.1; tombstones shipped Rung 1.2. VC-aware operation gating deferred to Rung 1.3.
when_to_use: When working with time-travel queries against this Pod, implementing or debugging the css/extensions/memento extension, designing VC-gated deletion workflows, or answering questions about how this Pod handles versioning.
---

# Solid Memento

Memento (RFC 7089) integration for time-travel + tombstone semantics. Full design in [`references/design.md`](references/design.md).

## Quick reference

- URI minting: Trellis-style query strings — `?ext=timemap` for TimeMap, `?version=<14-digit-datetime>` for Memento (D61)
- OriginalResource doubles as TimeGate (RFC 7089 Pattern 1.1)
- ACP applies to OriginalResource and inherits across all Mementos (D62)
- Soft delete via `ldes:DeletedLDPResource` + `as:Delete` commit; 410 Gone on plain GET (D64)
- MonitoringStore CDC over fswatch (D65) — listens to CSS's native `'changed'` event
- Per-path git commits with `.git/memento.lock` for multi-worker safety (D66, D68)
- Link/Vary advertisement via `MementoLinkMetadataWriter` (D67)

## Implementation

`css/extensions/memento/` — TypeScript CSS v8 extension. See `references/design.md` for the full architecture map.

## Known limitations

- **K1**: `OverrideListInsertAt` against empty handlers list fails in Components.js v8.0.0-alpha.3; worked around via full replacement of `urn:solid-server:default:WorkerParallelInitializer`
- **RQ-Memento-1**: ACP fragmentation across time (when does D62 inheritance break?) — open

## Related skills

- `solid-spec` — Solid Protocol baseline
- `monitoring-store` — CSS MonitoringStore CDC pattern this extension uses
- `metadata-writer` — `MetadataWriter` composition for Memento Link/Vary headers
- `components-override` — Components.js Override patterns (relevant for K1 workaround)
