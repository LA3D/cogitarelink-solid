# MemTrigger Detector Wiring — Design

**Date**: 2026-05-20
**Author**: Chuck Vardeman (with Claude)
**Status**: Design approved; awaiting implementation plan
**Dependencies**: D74 (memory-substrate triggers), D93/D94/K4 (Memory Structuring Sprint), D95–D100 (Shape Completion Sprint)
**Decisions to ratify on close**: D101 (MemTrigger detector wiring and substrate-signal delivery model)
**Closes**: FOLLOWUPS.md "Phase C.10 wiring scope + deferrals"

---

## Goal

Wire all four MemTrigger detectors (`BoundExceededDetector`, `UnprocessableWriteDetector`, `ContradictionDetector`, `ReflectionDueDetector`) into the substrate so `mem:*` events archive to `/.events/` on the conditions they describe. Close the D74 substrate-self-monitoring contract; un-skip the four `tests/integration/test_mem_events.py` stubs; produce the signal surface Rung 1.5 eval needs to measure agent self-improvement loops.

Out of scope: server-side response augmentation (atomic in-response Link headers), emission-based durability for ReflectionDue, persistent state across restarts, VC-aware substrate events.

---

## Framing — two event classes, two delivery patterns

The design intent for `/.events/` separates cleanly into two orthogonal event classes that share infrastructure but serve different audiences:

| Class | Audience | Delivery channel | Status |
|---|---|---|---|
| **Class 1 — per-memory change** | External follower agents subscribed to specific memories | Solid Notifications Protocol on per-resource subscription | **Already shipped** (Phase C smoke-tested). No work this sprint. |
| **Class 2 — substrate self-monitoring** | The authoring agent's own housekeeping/self-improvement loop | `/.events/` as LDN inbox; AS2 activities with `mem:*` multi-typing | **This sprint** wires the producer side. Consumer-side delivery uses Patterns A+C below. |

The four `mem:*` detectors serve Class 2 exclusively. They emit when the substrate *notices something about itself* (bounded-branching exceeded, write rejected, edges contradict, subject due for reflection), not when an agent writes data. Class 1 (memory-change-to-subscribers) is the existing per-resource Solid Notifications channel and needs no MemTrigger involvement.

### Delivery patterns for Class 2

Three patterns considered for how the authoring agent's harness encounters substrate signals triggered by its own writes:

- **Pattern A — client-side post-write query.** After a PUT/POST, the harness queries `/.events/` for events targeting the just-written URI. Cheap, predictable, no Pod surgery — server-side stays MonitoringStore-async as designed.
- **Pattern B — atomic in-response Link headers.** Write responses include `Link: </.events/...>; rel="urn:cogitarelink:trigger"`. Requires synchronous detector firing pre-response (not via MonitoringStore's post-commit `'changed'` event) plus a MetadataWriter to surface the Links. Substantially restructures the listener architecture.
- **Pattern C — Solid Notifications stream on `/.events/`.** Harness opens a streaming subscription against `/.events/` and surfaces events as they arrive. Out-of-band delivery, but the harness is always listening. Also serves external follower agents who want substrate context, and is the only natural fit for `mem:ReflectionDue` (timer-driven, no request to ride).

**Decision**: ship **A + C combined**. A is cheap and gives the harness a deterministic post-write query. C handles `mem:ReflectionDue` and gives external subscribers the same channel.

**Pattern B is deferred** to **RQ-Atomic-Feedback-1** (logged in `.claude/memory/MEMORY.md`). Rung 1.5 must include a task class that measures whether atomic feedback improves agent behavior over deferred. If evaluation evidence justifies the architectural cost, B is its own follow-on sprint.

---

## Architecture

### Component overview

```
┌─ shape-validator extension ────────────────────────────────────┐
│  ShaclValidator                                                 │
│     on SHACL fail → calls IUnprocessableWriteHook              │
│                   → throws 422 with sh:ValidationReport body    │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─ markdown-projection extension ────────────────────────────────┐
│  MarkdownProjectionListener                                     │
│     on 'changed' → parses body wikilinks                       │
│                  → writes .meta                                 │
│                  → calls IPostProjectionHook with edges        │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─ mem-trigger extension ────────────────────────────────────────┐
│  MemTriggerListener                                             │
│     on 'changed'        → checkBound(target)                   │
│                         → updates lastActivity                  │
│     setInterval (1h)    → tickReflection()                     │
│     impl IUnprocessableWriteHook → onShaclRejection()          │
│     impl IPostProjectionHook    → onEdgesWritten()             │
│                                                                 │
│  state (in-memory):                                             │
│     lastBoundEmit:     Map<containerUri, Date>                  │
│     lastActivity:      Map<subjectUri, Date>                    │
│     lastReflection:    Map<subjectUri, Date>                    │
│     durableContainers: Set<containerUri> (from Type Index)      │
│                                                                 │
│  emitter: EventEmitter → POST /.events/<uuid>.ttl              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                       /.events/
                       ├─ bound-exceeded-{uuid}.ttl
                       ├─ unprocessable-{uuid}.ttl
                       ├─ contradiction-{uuid}.ttl
                       └─ reflection-{uuid}.ttl
                              │
                              ├──── LDN GET (Pattern A) ─── agent harness
                              └──── Solid Notifications (Pattern C) ─── subscribers
```

### Hook interface contracts

Two new public hook interfaces, both following the no-op-default DI pattern:

```typescript
// css/extensions/mem-trigger/src/hooks/IUnprocessableWriteHook.ts
export interface IUnprocessableWriteHook {
  onShaclRejection(input: {
    targetUri: string;
    validationReport: string;     // Turtle of sh:ValidationReport
    writerWebId?: string;
    timestamp: Date;
  }): Promise<void>;
}

// css/extensions/mem-trigger/src/hooks/IPostProjectionHook.ts
export interface IPostProjectionHook {
  onEdgesWritten(input: {
    subject: string;              // <#this> IRI per D95
    edges: Array<{predicate: string; object: string}>;
    timestamp: Date;
  }): Promise<void>;
}
```

**No-op defaults** ship in the *producer* extensions (shape-validator, markdown-projection). Components.js default bindings inject the no-op. When mem-trigger is installed, its config overrides the binding to the real MemTrigger implementation. shape-validator and markdown-projection behavior in mem-trigger-free environments is byte-identical to today.

**K1 implication**: mem-trigger.json currently owns the `WorkerParallelInitializer` Override (per Memory Structuring Sprint consolidation). The new hook Overrides target *different* instances (`ShaclValidator` and `MarkdownProjectionListener`), so no K1 conflict.

### State model

All in-memory, lost on restart. Documented cold-start behavior is acceptable for v1; persistence is a v2 question contingent on Rung 1.5 evidence.

| Map | Key | Value | Updated by | Read by |
|---|---|---|---|---|
| `lastBoundEmit` | container URI | `Date` | `checkBound` post-emission | `checkBound` flapping check |
| `lastActivity` | subject URI | `Date` | every `'changed'` for durable-path targets | `tickReflection` |
| `lastReflection` | subject URI | `Date` | `tickReflection` post-emission | `tickReflection` interval check |
| `durableContainers` | (set of paths) | — | loaded once at `handle()` from Type Index | path filter for `lastActivity` |

**Restart behavior**:
- `lastActivity` empties; rebuilds with each post-restart write.
- `lastReflection` resets; first post-restart 24h cycle won't fire spuriously (`maybeEmit`'s first-emit branch requires `lastActivity !== null`, which means at least one write happened since restart).
- `lastBoundEmit` resets; a still-over-threshold container can re-emit once post-restart. Semantically idempotent for the agent.

---

## Per-detector wiring

### BoundExceededDetector

**Trigger path**: MonitoringStore `'changed'` → `MemTriggerListener.onChange` → `chain.then(checkBound)`.

**`checkBound(target)` logic**:
1. Derive parent container URI: strip the last path segment from `target.path`, ensure trailing `/`. If target is itself a container, parent = one level up.
2. Skip if parent is `/.events/` or `/.operations/` (defense-in-depth; already filtered in `onChange`).
3. `representation = await store.getRepresentation({path: parentUri}, {type: {'text/turtle': 1}})`.
4. Parse Turtle with N3.js `Parser`. Collect quads where predicate = `http://www.w3.org/ns/ldp#contains`. `childCount = quads.length`.
5. `lastEmitted = lastBoundEmit.get(parentUri) ?? null`.
6. `turtle = bound.maybeEmit({containerUri: parentUri, childCount, lastEmittedForContainer: lastEmitted, now: new Date()})`.
7. If `turtle !== null`: `await emitter.emit(turtle)`, then `lastBoundEmit.set(parentUri, now)`.

**Error handling**: parse failure or read failure → log warning, return. Never throw out of the chain Promise (matches existing pattern at `MemTriggerListener.ts:93`).

**Read mechanism**: `store.getRepresentation`. The wiki-search D92 re-entrant-lock issue does not apply here — `'changed'` fires post-commit (lock released), and we read the parent container (different resource from the write target). If integration tests surface lock weirdness, swap to `DataAccessor.getData + getMetadata` (one-day rework).

### UnprocessableWriteDetector

**Trigger path**: `ShaclValidator.handle()` detects a SHACL violation → builds `sh:ValidationReport` Turtle → calls `unprocessableHook.onShaclRejection({...})` → throws the 422 (existing behavior, unchanged from agent's perspective).

**`MemTriggerUnprocessableWriteHook.onShaclRejection(input)` logic**:
1. `turtle = detector.buildEvent({targetUri, validationReport, writerWebId, timestamp})`.
2. If `turtle !== null`: `await emitter.emit(turtle)`.

**Ordering inside ShaclValidator**: hook fires *before* the 422 is thrown but *after* the rejection is fully determined. Wrap `hook.onShaclRejection` in try/catch — log errors, swallow exceptions, continue to throw the 422 normally. Substrate errors must not mask rejection from the agent.

**No chain Promise here**. Failed writes don't emit MonitoringStore's `'changed'`; the hook fires outside that lifecycle. Two simultaneous failing writes can fire the hook in parallel; `EventEmitter` writes to `/.events/<uuid>.ttl` with random UUIDs so no collision.

**Delivery to agent**: in-context via the existing 422 response body (`sh:ValidationReport` Turtle). The `/.events/` archive is for posterity and for follower agents subscribing to substrate signals.

### ContradictionDetector

**Trigger path**: `MarkdownProjectionListener` writes `.meta` for a body change → calls `postProjectionHook.onEdgesWritten({subject, edges, timestamp})` *after* the `.meta` write completes.

**Refactor required**: `MarkdownProjectionListener` already parses body wikilinks to build `.meta` patches but does not retain the edge list post-parse. The sprint adds the edge array as a held-over value after parsing, then passes it to the hook. Small refactor, but a real code change beyond pure wiring — land it as its own commit with the existing markdown-projection test suite passing before adding the hook invocation.

**`MemTriggerPostProjectionHook.onEdgesWritten(input)` logic**:
1. `turtle = contradiction.maybeEmit({subject: input.subject, edges: input.edges, now: input.timestamp})`.
2. If `turtle !== null`: `await emitter.emit(turtle)`.

**v1 contradictory-pair list**: `[(wiki:supports, wiki:criticizes)]` — single pair per HR-6. Configurable via Components.js parameter `contradictoryPairs` (already in `MemTriggerListener` constructor).

**Ordering guarantee**: enforced by call sequence inside `MarkdownProjectionListener` — `.meta` patch awaits completion, then hook is invoked. No race against MonitoringStore.

### ReflectionDueDetector

**Trigger path**: `setInterval(this.tickReflection, TICK_RATE_MS)` in `MemTriggerListener.handle()`. `TICK_RATE_MS` defaults to 1 hour (configurable via Components.js); this is the *check cadence*, not the *emission threshold*.

**Setup at `handle()` start**:
1. Subscribe to MonitoringStore `'changed'` (existing).
2. Load durable-container set from Type Index: `await loadDurableContainers()` reads `/vault/settings/publicTypeIndex` via `store.getRepresentation`, parses Turtle, extracts `solid:instanceContainer` values for each type registration. Stores as `Set<string>` of normalized container URIs (trailing slash).
3. Start `setInterval(tickReflection, tickRateMs)`. Save interval handle to a member field; clear in `finalize()`.

**Activity tracking** (in `onChange`, before the `chain.then(checkBound)` work):
- If `target.path` starts with any container in `durableContainers`: `lastActivity.set(target.path, new Date())`.
- Otherwise skip (working-memory, `.events/`, `.operations/`, non-durable resources don't generate reflection events).

**`tickReflection()` logic** (every TICK_RATE_MS):
1. `now = new Date()`.
2. For each `(subjectUri, lastActivity)` in `this.lastActivity`:
   - `lastEmitted = lastReflection.get(subjectUri) ?? null`.
   - `turtle = reflection.maybeEmit({lastEmitted, lastActivity, now})`.
   - If `turtle !== null`: `await emitter.emit(turtle)`, `lastReflection.set(subjectUri, now)`.

**Threshold**: 24h (the detector's `intervalMs`) between emissions per subject. With 1h tick rate, max latency between threshold-crossing and emission is 1 hour. Acceptable for v1.

**Durability semantics (v1)**: path-based via live Type Index. A subject is "durable" iff it lives in a Type-Index-registered durable container. Emission-based durability (Crystallize-event tracking) is deferred to v2 pending Rung 1.5 evidence about how agents actually use the two-stage-commit flow.

**Memory bound**: `lastActivity` grows with each touched durable subject. Documented as known scaling limit; v2 could LRU-cap or persist.

---

## Wire-level changes

### New files

```
css/extensions/mem-trigger/src/hooks/IUnprocessableWriteHook.ts
css/extensions/mem-trigger/src/hooks/IPostProjectionHook.ts
css/extensions/mem-trigger/src/hooks/MemTriggerUnprocessableWriteHook.ts
css/extensions/mem-trigger/src/hooks/MemTriggerPostProjectionHook.ts
css/extensions/shape-validator/src/NoOpUnprocessableWriteHook.ts
css/extensions/markdown-projection/src/NoOpPostProjectionHook.ts
css/extensions/mem-trigger/tests/MemTriggerListener.checkBound.test.ts
css/extensions/mem-trigger/tests/MemTriggerListener.tickReflection.test.ts
css/extensions/mem-trigger/tests/MemTriggerListener.loadDurableContainers.test.ts
css/extensions/mem-trigger/tests/hooks/MemTriggerUnprocessableWriteHook.test.ts
css/extensions/mem-trigger/tests/hooks/MemTriggerPostProjectionHook.test.ts
```

### Modified files

- `css/extensions/mem-trigger/src/MemTriggerListener.ts` — implement `checkBound`, add `setInterval` for reflection, add `lastActivity` tracking, load `durableContainers` from Type Index at `handle()` start, implement `finalize()` to clear the timer.
- `css/extensions/shape-validator/src/ShaclValidator.ts` — inject `IUnprocessableWriteHook`, call `hook.onShaclRejection` on validation failure (before throwing 422, wrapped in try/catch).
- `css/extensions/markdown-projection/src/MarkdownProjectionListener.ts` — retain parsed edge list post-`.meta`-write, inject `IPostProjectionHook`, call `hook.onEdgesWritten` after the patch completes.
- `css/config/mem-trigger.json` — bind `IUnprocessableWriteHook` and `IPostProjectionHook` to MemTrigger implementations via Components.js Override.
- `css/config/shape-validator.json` — declare hook constructor param with no-op default.
- `css/config/markdown-projection.json` — declare hook constructor param with no-op default.
- `tests/integration/test_mem_events.py` — replace four `pytest.skip` stubs with real test bodies.

---

## Tests and acceptance criteria

### Unit tests (Vitest, `css/extensions/mem-trigger/tests/`)

| File | Asserts |
|---|---|
| `MemTriggerListener.checkBound.test.ts` | Mock `ResourceStore.getRepresentation` returns Turtle with N children. Drive `onChange` for a target in that container. Verify `EventEmitter.emit` called iff N > threshold AND outside flapping window. Verify `lastBoundEmit` updated post-emission. Verify `.events/` and `.operations/` parents skipped. |
| `MemTriggerListener.tickReflection.test.ts` | Pre-populate `lastActivity` for two subjects. Tick once with `now > lastActivity + intervalMs`. Verify both emit. Tick again immediately. Verify nothing emits. Tick after another `intervalMs` with no new activity. Verify nothing emits. |
| `MemTriggerListener.loadDurableContainers.test.ts` | Mock Type Index Turtle. Verify the parsed `Set<string>` contains the expected `solid:instanceContainer` values with trailing slashes. Graceful empty-set fallback when Type Index read fails. |
| `hooks/MemTriggerUnprocessableWriteHook.test.ts` | Drive `onShaclRejection` with a sample `sh:ValidationReport`. Verify `EventEmitter.emit` called with Turtle containing `mem:UnprocessableWrite` and the report. |
| `hooks/MemTriggerPostProjectionHook.test.ts` | Drive `onEdgesWritten` with edges containing `wiki:supports X` + `wiki:criticizes X`. Verify emission. Drive again with non-conflicting edges. Verify no emission. |

### Integration tests (Python, against live Pod)

Replace each `pytest.skip` body in `tests/integration/test_mem_events.py`:

| Test | Setup | Action | Assertion |
|---|---|---|---|
| `test_bound_exceeded_emits_event` | Empty `/vault/wiki/concepts/test-bound-{uuid}/` container | PUT 13 resources | GET `/.events/` lists at least one resource whose Turtle contains `a mem:BoundExceeded` and `wiki:targetContainer </vault/wiki/concepts/test-bound-{uuid}/>` |
| `test_unprocessable_write_emits_event` | Default `/vault/wiki/concepts/` (ConceptShape constraint active) | PUT a malformed concept (missing required `skos:prefLabel`) — expect 422 with `sh:ValidationReport` body | After 422 returned, GET `/.events/` has a fresh `mem:UnprocessableWrite` event targeting the same URI, carrying the same report content |
| `test_contradiction_detected_emits_event` | Empty `/vault/wiki/concepts/test-contra-{uuid}.md` | PUT body containing both `[[X]]{.supports}` and `[[X]]{.criticizes}` wikilinks | After PUT settles, GET `/.events/` has a fresh `mem:ContradictionDetected` event referencing both predicates and the shared object |
| `test_reflection_due_emits_event` | Pod started with test-mode config: `reflectionIntervalMs=200`, `reflectionTickRateMs=100` | PUT a resource to `/vault/wiki/concepts/`, wait 300ms | GET `/.events/` has a fresh `mem:ReflectionDue` event targeting the just-written subject |

**Test-mode config**: ReflectionDue's 24h default is impractical for tests. Add a test-fixture `mem-trigger-test.json` config that overrides production's `mem-trigger.json` with short intervals. Same pattern Memento uses for its short-interval tests.

### Acceptance criteria for sprint completion

1. All four `tests/integration/test_mem_events.py` tests pass against the live Pod with the test-mode config.
2. Unit test suite green across the new files. Baseline ~94 TS unit tests stays ≥ 94 + new file count.
3. Existing Python local + integration suite green. ~53 Python local + 19–20 Phase G live-Pod integration tests stay green (no regressions in markdown-projection, shape-validator, memento behavior).
4. No-op hook defaults verified: smoke-test the Pod with mem-trigger removed from imports — `IUnprocessableWriteHook` and `IPostProjectionHook` resolve to no-op bindings, server boots, writes succeed, shape-validator + markdown-projection behavior is byte-identical to today.
5. `MemTriggerListener` attaches without errors at boot.
6. README in `css/extensions/mem-trigger/` updated with the two hook interface contracts and the A+C delivery patterns.

---

## Risks and mitigations

| ID | Risk | Mitigation |
|---|---|---|
| R1 | `store.getRepresentation` re-entrant lock | Theoretical only — `'changed'` fires post-commit, parent ≠ target. If tests surface lock issues, swap to D92-proven `DataAccessor` path (one-day rework). |
| R2 | `MarkdownProjectionListener` refactor breaks existing tests | Land the edge-retention refactor as its own commit with existing tests green before adding hook invocation. |
| R3 | Type Index loading races against Pod readiness at cold boot | Graceful fallback — log warning, treat `durableContainers` as empty set. Retry on first `'changed'` if set was empty at startup. |
| R4 | `setInterval` leak on extension reload/shutdown | Implement `finalize()` to `clearInterval(this.reflectionTimer)`. |
| R5 | `lastActivity` Map unbounded growth | Documented as known scaling limit for v1; v2 can LRU-cap or persist. |
| R6 | Hook failure inside `ShaclValidator` masks 422 from agent | Wrap `hook.onShaclRejection` in try/catch — log errors, swallow exceptions, continue to throw 422 normally. |

---

## Deferrals

| Deferral | Reason | Revisit trigger |
|---|---|---|
| Pattern B (atomic in-response Link headers) | Requires restructuring detectors away from MonitoringStore's `'changed'` event; architecturally substantial | **RQ-Atomic-Feedback-1** in Rung 1.5 — task class measuring atomic vs deferred feedback delivery |
| Emission-based durability (Crystallize-event tracking) | v1 path-based via Type Index is a reasonable approximation | Rung 1.5 evidence about how agents actually use two-stage-commit |
| Persistent state across CSS restarts | In-memory Maps with documented cold-start behavior are acceptable for v1 | Rung 1.5 evidence that cold-start gap matters for agent loops |
| Per-subject or per-class configurable thresholds | v1 global defaults (12 for bound, 24h for reflection) | Rung 1.5 evidence that different memory classes need different cadences |
| VC-aware substrate events | Behavior-before-security still applies; substrate runs dev-allow-all until eval evidence | Rung 1.5 outcome on credential model |

---

## Cross-references

- **RQ-Atomic-Feedback-1** — added to `.claude/memory/MEMORY.md` "Open research questions (active)" section
- **RQ-Listener-1** — `FileDataAccessor.writeMetadataFile()` overwrites `.meta`; relevant for ContradictionDetected if Model A preserve-agent-triples behavior changes the edge harvesting story
- **FOLLOWUPS.md "Phase C.10 wiring scope + deferrals"** — gets struck through when this sprint ships
- **D74** (memory-substrate triggers) — sprint closes the implementation gap

---

## Decision candidate

This sprint earns **D101 — MemTrigger detector wiring and substrate-signal delivery model**:

- A+C combined delivery for Class 2 substrate signals; Pattern B deferred pending RQ-Atomic-Feedback-1.
- Two-hook DI pattern with no-op defaults: `IUnprocessableWriteHook` (shape-validator → mem-trigger) and `IPostProjectionHook` (markdown-projection → mem-trigger).
- Path-based durability via live Type Index for v1 ReflectionDue.

Ratification on passing the four `test_mem_events.py` tests against the live Pod.
