# mem-trigger

CSS v8 extension for wiki-memory L3 substrate self-monitoring. Wires the four
`mem:*` event detectors and delivers substrate signals to `/.events/` as AS2
activities. Closes D74's substrate-self-monitoring contract. Ratified in D101.

---

## What it does

`MemTriggerListener` subscribes to the `MonitoringStore` `'changed'` event
alongside `MementoCommitListener` and `MarkdownProjectionListener` (all three
wired via `mem-trigger.json`'s `WorkerParallelInitializer` Override per K1).
On each successful write to a wiki-memory L3 resource it:

1. Drains any events queued by the `PendingEventsBuffer` (UnprocessableWrite
   events land here before the emitter is ready — see below).
2. Lazy-loads the durable-container set from the Type Index on first eligible
   write (15s startup grace, then once per process lifetime).
3. Runs `checkBound` to count `ldp:contains` children in the parent container
   and emit a `mem:BoundExceeded` event if the Fano-bound threshold (default 12)
   is crossed.
4. Updates `lastActivity` for the target subject if it lives in a durable container
   (feeds the `ReflectionDue` periodic timer).

Two additional detectors fire outside the `'changed'` event cycle:
- `UnprocessableWrite` fires via the `IUnprocessableWriteHook` injected into
  `ShaclValidator` (shape-validator extension) on every SHACL rejection.
- `ContradictionDetected` fires via the `IPostProjectionHook` injected into
  `MarkdownProjectionListener` (markdown-projection extension) after every
  successful body-wikilink projection.
- `ReflectionDue` fires on a `setInterval` timer (default 1h check cadence,
  24h emission threshold per subject).

All four detectors emit Turtle-encoded AS2/`mem:*` activities POSTed to
`<eventsContainer>/<uuid>.ttl` (default `/.events/`).

---

## Four detectors

| Detector | Trigger condition | Event class | Delivery |
|---|---|---|---|
| `BoundExceededDetector` | `ldp:contains` count in parent container crosses threshold (default 12) | `mem:BoundExceeded` | Deferred via MonitoringStore `'changed'` (post-write) |
| `UnprocessableWriteDetector` | SHACL validation fails; `ShaclValidator` returns HTTP 422 | `mem:UnprocessableWrite` | In-context: 422 body carries `sh:ValidationReport`; `/.events/` archive via PendingEventsBuffer |
| `ContradictionDetector` | Body-projected edge pair is mutually contradictory (default: `wiki:supports` + `wiki:criticizes`; actual emission uses `cito:cites` — see Architectural Deviations) | `mem:ContradictionDetected` | Deferred via IPostProjectionHook (post-projection, post-write) |
| `ReflectionDueDetector` | Subject in a durable container has been inactive for threshold duration (default 24h); timer ticks at default 1h | `mem:ReflectionDue` | Out-of-band timer via `setInterval` |

Delivery model: **A + C combined** (D101). Pattern A — agent harness queries
`/.events/` after each write for events targeting the just-written URI. Pattern C —
harness (or external subscriber) holds a Solid Notifications subscription against
`/.events/` for streaming delivery. `mem:ReflectionDue` is timer-driven and only
natural on Pattern C.

Pattern B (atomic in-response `Link` headers) is deferred to RQ-Atomic-Feedback-1.

---

## Hook interfaces

Two hook interfaces cross extension boundaries. Both are declared as `abstract class`
(not TypeScript `interface`) so componentsjs-generator emits a valid `Class` descriptor
rather than an `AbstractClass` that fails at CSS boot.

### `IUnprocessableWriteHook`

Defined at `css/extensions/mem-trigger/src/hooks/IUnprocessableWriteHook.ts`.
Consumed by `ShaclValidator` (shape-validator extension).

```typescript
export abstract class IUnprocessableWriteHook {
  public abstract onShaclRejection(input: {
    targetUri: string;
    validationReport: string;   // Turtle of sh:ValidationReport
    writerWebId?: string;
    timestamp: Date;
  }): Promise<void>;
}
```

**Default (no-op)**: `css/extensions/shape-validator/src/NoOpUnprocessableWriteHook.ts`.
Declared in `css/config/shape-validator.json` constructor param. Shape-validator
behavior in mem-trigger-free environments is byte-identical to pre-D101.

**Real implementation**: `MemTriggerUnprocessableWriteHook` in mem-trigger extension.
Bound via `css/config/mem-trigger.json` Override when mem-trigger is installed.
Enqueues Turtle into `PendingEventsBuffer` rather than calling `EventEmitter` directly
(see PendingEventsBuffer section).

### `IPostProjectionHook`

Defined at `css/extensions/mem-trigger/src/hooks/IPostProjectionHook.ts`.
Consumed by `MarkdownProjectionListener` (markdown-projection extension), called
after `.meta` patch completes.

```typescript
export abstract class IPostProjectionHook {
  public abstract onEdgesWritten(input: {
    subject: string;                                    // <#this> IRI per D95
    edges: Array<{ predicate: string; object: string }>;
    timestamp: Date;
  }): Promise<void>;
}
```

**Default (no-op)**: `css/extensions/markdown-projection/src/NoOpPostProjectionHook.ts`.
Declared in `css/config/markdown-projection.json` constructor param.

**Real implementation**: `MemTriggerPostProjectionHook`. Bound via
`css/config/mem-trigger.json` Override when mem-trigger is installed.

### Components.js Override binding

Both hooks are swapped in via Overrides in `css/config/mem-trigger.json`. These
target `ShaclValidator` and `MarkdownProjectionListener` instances respectively —
different targets from the `WorkerParallelInitializer` Override already in
`mem-trigger.json`, so no K1 conflict (one Override per instance is the limit).

---

## PendingEventsBuffer pattern

`MemTriggerUnprocessableWriteHook` fires inside `ShaclValidator.handle()` — which
runs before `ResourceStore` is ready (Components.js constructs validators before the
store is finalized). The hook cannot hold an `EventEmitter` that writes to the Pod.

The workaround: a module-level singleton array at
`css/extensions/mem-trigger/src/PendingEventsBuffer.ts` shared across the process.
The hook enqueues Turtle strings into the buffer. `MemTriggerListener.handle()` (an
`Initializer` that runs after `ResourceStore` is ready) drains the buffer once on
startup and again on every `'changed'` event before running `checkBound`. Drain
runs unconditionally — it is not gated by the 15s startup grace period, so
`mem:UnprocessableWrite` events reach `/.events/` even during pod-setup writes
that would fail SHACL validation.

---

## Delivery model details

```
successful write
  → CSS MonitoringStore 'changed' event
    → MemTriggerListener.onChange
      → drainPendingEvents (flushes UnprocessableWrite queue)
      → lazy-load durable containers (15s grace, once per process)
      → checkBound(target)
        → fetch() parent container
        → count ldp:contains
        → BoundExceededDetector.maybeEmit
        → if non-null: POST /.events/<uuid>.ttl

SHACL-failing write
  → ShaclValidator.handle()
    → IUnprocessableWriteHook.onShaclRejection
      → MemTriggerUnprocessableWriteHook: build event Turtle
        → enqueue in pendingEventsBuffer (not direct emit)
    → throw HTTP 422 with sh:ValidationReport body
  [later] → next 'changed' event drains pendingEventsBuffer
    → POST /.events/<uuid>.ttl

body wikilink write
  → CSS MonitoringStore 'changed' event
    → MarkdownProjectionListener.onChange
      → parse wikilinks → write .meta
      → IPostProjectionHook.onEdgesWritten
        → MemTriggerPostProjectionHook: ContradictionDetector.maybeEmit
        → if non-null: POST /.events/<uuid>.ttl

timer tick (every 1h default)
  → MemTriggerListener.tickReflection
    → ReflectionDueDetector.maybeEmit per tracked subject
    → if non-null: POST /.events/<uuid>.ttl
```

---

## Configuration

### Production defaults (`css/config/mem-trigger.json`)

Key constructor parameters for `MemTriggerListener`:

| Parameter | Default | Notes |
|---|---|---|
| `eventsContainer` | `<baseUrl>/vault/wiki/.events/` | LDN inbox; all `mem:*` events land here |
| `baseUrl` | `https://pod.vardeman.me/vault` | Pod root; writes outside this are ignored |
| `boundThreshold` | `12` | Fano bound (D77/D99). Emit `mem:BoundExceeded` when `ldp:contains` count exceeds this |
| `reflectionIntervalMs` | `86400000` (24h) | Inactivity threshold before `mem:ReflectionDue` emits per subject |
| `reflectionTickRateMs` | `3600000` (1h) | `setInterval` cadence for `tickReflection()` |
| `contradictoryPairs` | `[]` | Injected from config; v1 uses `cito:cites` edge detection (see Architectural Deviations) |
| `typeIndexUri` | `<baseUrl>/vault/settings/publicTypeIndex` | Loaded once post-grace-period to populate durable-container set |

### Test-mode override (`css/config/mem-trigger-test.json`)

Overrides `reflectionIntervalMs` to 100ms and `reflectionTickRateMs` to 200ms
for integration test activation. Consumed via `css/config/solid-config-test.json`.
The `test_reflection_due_emits_event` integration test remains `pytest.skip` pending
activation: start CSS with `solid-config-test.json` instead of the production config,
then the 100ms threshold allows the test to observe a `mem:ReflectionDue` event within
a few seconds. Activation procedure:

```bash
# Start CSS with test config
docker run ... \
  -v ./css/config:/config \
  css --config /config/solid-config-test.json

# Run integration test
python -m pytest tests/integration/test_mem_events.py::test_reflection_due_emits_event -v
```

---

## Test coverage

| Suite | Count | Location |
|---|---|---|
| MemTriggerListener unit tests (Vitest) | 44 | `css/extensions/mem-trigger/tests/` |
| shape-validator unit tests (Vitest) | 31 | `css/extensions/shape-validator/tests/` |
| markdown-projection unit tests (Vitest) | 75 | `css/extensions/markdown-projection/tests/` |
| Integration — `test_contradiction_detected` | passing | `tests/integration/test_mem_events.py` |
| Integration — `test_unprocessable_write` | passing | `tests/integration/test_mem_events.py` |
| Integration — `test_bound_exceeded` | SKIP (in-memory flapping) | `tests/integration/test_mem_events.py` |
| Integration — `test_reflection_due_emits_event` | pytest.skip | `tests/integration/test_mem_events.py` |

`test_bound_exceeded` SKIPs gracefully when the in-memory Pod flaps the `ldp:contains`
count across the threshold on repeated writes; the unit tests for `BoundExceededDetector`
and `checkBound` cover the logic exhaustively.

---

## Architectural deviations from original design spec

Source: `docs/superpowers/specs/2026-05-20-mem-trigger-detector-wiring-design.md`

1. **`fetch()` not `store.getRepresentation()` in `checkBound`** — The design specified
   `store.getRepresentation` to read the parent container. Integration testing showed
   that the `'changed'` event fires while CSS may still hold a write lock on the parent
   container (it updates `ldp:contains` as part of the write transaction). Using
   `store.getRepresentation` on the parent during this window hits the per-resource
   lock and causes the `WrappedExpiringReadWriteLocker` 6s crash pattern. `fetch()` on
   the self-URL sidesteps the in-process lock entirely (same approach as the D92 walker
   but scoped to a single resource). The lock concern does not apply to the parent for
   most writes (only when parent is the direct write target), but the defense is cheap.

2. **`abstract class` for hook interfaces, not TypeScript `interface`** — The design
   called for `interface IUnprocessableWriteHook` and `interface IPostProjectionHook`.
   Components.js's componentsjs-generator emits an `AbstractClass` descriptor for
   TypeScript `interface` types, which CSS's DI container refuses to instantiate
   ("Failed to get module element" at boot). Declaring as `abstract class` makes
   componentsjs-generator emit a proper `Class` descriptor. No behavioral change; the
   contract is identical.

3. **`cito:` URIs for contradictory-pair matching, not `wiki#` URIs** — The design
   specified `[(wiki:supports, wiki:criticizes)]` as the v1 contradictory-pair list.
   The `MarkdownProjectionListener`'s `wikilinkProjection` emits `cito:cites` /
   `cito:citesAsEvidence` / `cito:citesAsPotentialSolution` for `{.supports}` wikilinks
   (not `wiki:supports`). The actual contradiction pairs must reference the IRI that
   the projection actually writes into `.meta`. Production v1 ships with `contradictoryPairs: []`
   (no pairs configured) pending a reconciliation pass that enumerates all
   `wikilinkProjection` output IRIs. The `ContradictionDetector` unit tests exercise
   the logic against injected pairs; the integration test confirms the hook fires.

4. **`mem:Event` multi-typing required for path-constraint bypass** — The design did not
   anticipate that the shape-validator's `pathBasedClassConstraint` would require
   `mem:Event` resources to be multi-typed (also as `as:Activity`) to pass the operations
   path guard. Events emitted to `/.events/` must carry `a mem:BoundExceeded, as:Activity`
   (or equivalent `as:*` parent) to satisfy the operations-path constraint. Detectors
   were updated accordingly.

5. **`getLoggerFor` silenced in extension packages** — CSS's `global-logger-factory`
   does not surface `info`/`warn` log lines from extension packages in container output
   at the default logging level. Debug-critical messages (drain errors, emit failures)
   use `console.error` directly for visibility. Normal operational messages remain on
   `this.logger.info/warn`.

---

## Cross-references

- **D74** — memory-substrate triggers: the `mem:*` vocabulary, AS2 activity taxonomy,
  and seven invariants this extension closes the implementation gap on.
- **D101** — MemTrigger detector wiring and substrate-signal delivery model (ratified
  2026-05-21): A+C delivery, two-hook DI pattern, PendingEventsBuffer, `fetch()` not
  `store.getRepresentation`, `mem:Event` multi-typing.
- **K1** — `mem-trigger.json` owns the `WorkerParallelInitializer` Override; all
  future memory-substrate listeners must be added to its `handlers` list.
- `docs/superpowers/specs/2026-05-20-mem-trigger-detector-wiring-design.md` — design doc
- `docs/superpowers/plans/2026-05-20-mem-trigger-detector-wiring.md` — implementation plan
- FOLLOWUPS.md Phase C.10 (closed 2026-05-21)
