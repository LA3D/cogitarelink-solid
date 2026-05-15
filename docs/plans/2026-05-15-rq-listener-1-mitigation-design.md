# RQ-Listener-1: Model A Preservation Across CSS .meta Overwrite

**Surfaced**: 2026-05-15 (Rung 1.4 Phase 5 integration testing)
**Status**: Deferred — pick mitigation after Rung 1.5 evaluation tells us whether agent-extension is a real use case
**Related**: D81 (Model A predicate governance), RQ-Pod-4 (companion eval-deferred issue)

## The problem in one line

CSS `FileDataAccessor.writeMetadataFile()` overwrites `.meta` completely during the resource PUT pipeline, BEFORE the MonitoringStore fires the `'changed'` event that `MarkdownProjectionListener` subscribes to. By the time the listener runs, any agent-PATCHed triples in `.meta` are already gone.

## How it surfaced

`test_agent_enrichment_survives_body_rewrite` in `tests/test_wiki_memory_l3_listener_integration.py`. Marked `xfail(strict=True)` so it becomes a test failure the moment we ship a fix.

```
T0: Agent PATCH .meta → wiki:relevantToProject </project/rung-1-4>
T1: Agent PUT body
T2: CSS FileDataAccessor.writeMetadataFile() → .meta cleared, repopulated with CSS-managed only
T3: MonitoringStore emits 'changed'
T4: MarkdownProjectionListener reads .meta → sees only CSS-managed state, no agent triple to preserve
```

D81's "predicate-level governance" assumes the listener can read prior `.meta` state and preserve non-governed triples. That assumption is broken by T2 → T3 ordering.

## Why this isn't blocking Rung 1.4

The 6 of 7 integration tests that pass cover the substrate-owned write path completely. The xfail is precisely scoped to agent-extension via direct `.meta` PATCH — a use case that may or may not matter once we run eval.

`MetaWriter`'s preservation logic is correct and unit-tested (3 vitest tests in `metaWriter.test.ts`). The bug is in WHEN the listener runs relative to CSS's `.meta` write, not in what the listener does.

## Three mitigation paths

### (A) Memento-history read

Listener queries the prior `.meta` from git history via Memento before projecting.

```typescript
async onChanged(id, activity) {
    const priorMeta = await this.mementoStore.getVersion(id, "before-this-write")
    const agentTriples = priorMeta.getQuads(null, null, null, null)
        .filter(q => !governed.includes(q.predicate.value))
    // merge agentTriples with projection, write to .meta
}
```

**Pros**: Uses existing Memento infrastructure. No new architectural concept. The `.git/memento.lock` already serializes per-path writes.

**Cons**: Race condition between `MementoCommitListener` and `MarkdownProjectionListener` — both fire from the same event. Memento's commit lands AFTER the .meta write but the agent's PATCH was committed BEFORE this body PUT. So the listener needs to find "the most recent commit where .meta was changed without a corresponding body change" — that's the PATCH commit. Doable via `git log --diff-filter=M -- <path>.meta` but fiddly. Latency: one git read per body write.

### (B) `.meta.agent` sidecar (preferred but deferred)

Agent writes to `<resource>.meta.agent` instead of `.meta`. CSS owns `.meta` entirely. SPARQL queries federate both via Comunica's explicit-source mechanism (same pattern as RQ-Pod-4 workaround).

```
GET /wiki/pages/foo.md.meta       → substrate-managed Turtle
GET /wiki/pages/foo.md.meta.agent → agent-managed Turtle
                                    (CSS never touches; Memento versions normally)
```

Affordance descriptor declares both surfaces:
```turtle
<> a wiki:WriteAffordance ;
   wiki:substrateSurface </wiki/pages/foo.md.meta> ;
   wiki:agentSurface     </wiki/pages/foo.md.meta.agent> ;
   wiki:governs ( ... ) ;
   sh:agentInstruction "Substrate writes .meta from body+frontmatter. To assert anything outside the governed set, PATCH .meta.agent — it persists across body rewrites." .
```

**Pros**:
- Sidesteps the timing problem entirely; no preservation logic
- Clean agent contract: two surfaces, two write rules
- Memento versions both naturally
- Compatible with current CSS internals — no PassthroughStore surgery
- Aligns with D52 affordance discovery as a "follow your nose" extension

**Cons**:
- Agents need to know two surfaces exist (mitigated by affordance descriptor)
- SPARQL queries against the Pod need explicit-source for `.meta.agent` — same workaround as RQ-Pod-4, so cost is bounded
- Revises D81's implicit "single .meta surface" assumption — would need a new decision (D82)

### (C) PassthroughStore wrap

Wrap the `ResourceStore` so projection runs synchronously in the PUT pipeline, before CSS clears `.meta`. Precedent: `ShapeValidationStore` (D38) already wraps for write-time SHACL validation.

```typescript
export class MarkdownProjectionStore extends PassthroughStore<MonitoringStore> {
    async setRepresentation(id, repr, conditions) {
        if (this.isWikiBody(id)) {
            const priorMeta = await this.readMeta(id)
            const projected = await projectionPipeline.run(id.path, repr.data)
            const merged = mergeWithPreservation(priorMeta, projected, governed)
            // Augment representation's metadata to carry merged set
            repr.metadata.add(...merged)
        }
        return super.setRepresentation(id, repr, conditions)
    }
}
```

**Pros**:
- Architecturally cleanest — fixes root cause, not symptom
- Synchronous serialization in the request path; no race conditions
- Same pattern as ShapeValidationStore (D38) and the upcoming PolicyEngine usage

**Cons**:
- Largest refactor — moves projection from post-write listener to in-pipeline transform
- Synchronous projection on the hot path (latency cost per write)
- More invasive to CSS internals; failure modes need careful design (what if projection fails — does the body write fail too?)

## Recommendation (current as of 2026-05-15)

**Defer the fix until Rung 1.5 eval data tells us if it matters.** The xfail test is the right place for this to sit: it documents the diagnosis, becomes a failing test the moment we ship a fix, and doesn't pretend the problem is solved.

If Rung 1.5 eval reveals real agent-extension use cases (agents PATCHing `.meta` outside the governed set in any T-condition task), pick **(B) `.meta.agent` sidecar** — it has the cleanest semantics for agent ergonomics and revises D81 with a coherent successor (D82).

If Rung 1.5 eval shows agents never extend `.meta`, this becomes a non-issue and the xfail can be reframed as documentation rather than a deferred fix.

## What "eval reveals real use cases" looks like

Concretely, after Rung 1.5 T-condition runs, count:
- Number of agent PATCHes to `.meta` (not body) — if zero, defer indefinitely
- Number of agent reads of non-governed predicates from `.meta` — if zero, defer indefinitely
- Number of cases where eval scoring depends on agent-extended state surviving rewrites — if zero, defer indefinitely

If any of these is nonzero, **(B) is the call**. Implementation effort: ~3 sessions (sidecar pattern + affordance descriptor revision + integration tests + D82 write-up).

## References

- D81 in `.claude/rules/decisions-index.md`
- Xfail test: `tests/test_wiki_memory_l3_listener_integration.py::test_agent_enrichment_survives_body_rewrite`
- MetaWriter implementation: `css/extensions/markdown-projection/src/metaWriter.ts`
- ShapeValidationStore precedent (PassthroughStore pattern): `css/extensions/shape-validator/src/storage/ShapeValidationStore.ts`
