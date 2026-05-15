# RDF-star + Reification Shim: Candidate Path for Agent Provenance

**Surfaced**: 2026-05-15 (conversation while closing Rung 1.4)
**Status**: Candidate — NOT a decision. Awaiting Rung 1.5 eval evidence on agent-enrichment patterns before committing.
**Relates to**: RQ-Listener-1, D81 (Model A predicate governance), candidate D82
**Sibling design doc**: `2026-05-15-rq-listener-1-mitigation-design.md` — adds a fourth mitigation path (D) to the (A)/(B)/(C) menu

## How this came up

The Rung 1.4 mitigation design (A/B/C) frames RQ-Listener-1 as a *preservation* problem: how do we keep agent-PATCHed triples in `.meta` alive across body rewrites? Option (B) — `.meta.agent` sidecar — is currently the preferred answer.

The owner's objection: a parallel sidecar is friction. It splits the agent's `.meta` view in two, requires explicit-source SPARQL for full reads (same workaround as RQ-Pod-4), and the agent has to know which surface to write to.

Counter-proposal explored in this doc: **mark the substrate-vs-agent distinction at the triple level, not the file level.** Use RDF 1.2 triple terms (RDF-star) to annotate each triple with `prov:wasGeneratedBy`, so the listener can partition substrate-managed triples from agent-managed triples on a single `.meta` surface.

## The proposed mechanism

`.meta` continues to be a single Turtle surface. Each triple carries provenance via RDF-star annotation:

```turtle
@prefix prov:    <http://www.w3.org/ns/prov#> .
@prefix wiki:    <urn:example:wiki#> .
@prefix skos:    <http://www.w3.org/2004/02/skos/core#> .
@prefix sub:     <urn:example:wiki#substrate> .

<bar.md> skos:related <other.md> ;
         skos:related <yet-another.md> ;       # agent-inferred
         dct:contributor <eric-broda> .

# Annotations
<< <bar.md> skos:related <other.md> >>
    prov:wasGeneratedBy <#markdownProjectionListener> .

<< <bar.md> dct:contributor <eric-broda> >>
    prov:wasGeneratedBy <#markdownProjectionListener> .

<< <bar.md> skos:related <yet-another.md> >>
    prov:wasGeneratedBy <https://agent.example/profile/card#me> ;
    prov:generatedAtTime "2026-05-15T10:00:00Z"^^xsd:dateTime .
```

On the next body PUT, the listener's regeneration step becomes:

```sparql
DELETE { ?s ?p ?o }
WHERE  { << ?s ?p ?o >> prov:wasGeneratedBy <#markdownProjectionListener> }
```

Then INSERT freshly-projected triples (each annotated with the listener as generator). Agent-annotated triples never get touched.

## Why this is appealing

1. **Single surface.** No `.meta.agent`. One Turtle file, one Memento history, one SPARQL endpoint.
2. **Predicate-name governance generalizes.** D81 currently locks predicates by name (`skos:related` is always substrate-managed). With star annotations, an agent CAN add a `skos:related` (same predicate the listener uses) and have it survive — the annotation distinguishes the two assertions.
3. **Standard PROV-O vocabulary.** Not an invented `substrate:projectedBy`. Federates cleanly with PROV-O elsewhere in the Pod (D20).
4. **Memento gets richer.** Time-travel queries can ask "what did agent X assert at T?" — already true cross-snapshot, but RDF-star surfaces the *who* inside each snapshot.
5. **Aligns with trusted-AI provenance ambitions.** Per-triple agent attribution is exactly what RLM-based agents reasoning about their own assertions need.

## The tooling gap — and why this isn't a free decision

The 2026-05-15 tooling probe found:

| Layer | Status |
|---|---|
| RDF 1.2 spec | W3C CR (Apr 2026), not REC |
| N3.js (in CSS) | ✅ Parses/serializes star with `text/turtle-star` format |
| CSS conneg pipeline | ⚠ Hardcodes `text/turtle` for `.meta`; needs Components.js overrides in `mapping/`, `patching.json`, `quad-to-rdf.json` |
| Comunica link-traversal | 0.8.0 (ours) — predates star. Comunica 5.0 (Jan 2026) has full SPARQL-star but link-traversal repackage needed |
| rdflib (Python) | ❌ 7.6.0 has no RDF-star. [Issue #1554](https://github.com/RDFLib/rdflib/issues/1554) open since 2021. No 8.x release. |
| pyshacl | ❌ Follows rdflib |

The **rdflib gap is the hard blocker**. Vault importer, SHACL dev workflow, and client-side `.meta` readers all use rdflib. Without rdflib 8.x, Python clients can't parse star directly.

## The backward-compatibility argument and what it actually buys

Owner's strategic point: RDF 1.2 has a defined downgrade — we don't need every client to speak star, just need the translation layer.

This is **directionally right but specifically nuanced**:

- W3C-blessed downgrade is **"basic encoding"** (defined in the [RDF 1.2 Interoperability Note](https://w3c.github.io/rdf-interop/spec/), Dec 2025). It produces `rdf:PropositionForm` + `rdf:propositionFormSubject/Predicate/Object` — a *new* RDF 1.2 vocabulary, not classical RDF 1.1 reification. An RDF 1.1 parser accepts the syntax but doesn't recognize the semantics.
- **Classical RDF 1.1 reification** (`rdf:Statement` + `rdf:subject/predicate/object`) IS what we want for backward compatibility — queryable by today's rdflib via SPARQL 1.1. But W3C explicitly *rejected* reusing `rdf:Statement` for basic encoding (citing dataset pollution risk). Only Apache Jena (Java-only) implements this classical-form downgrade as `org.apache.jena.system.RDFStar`.
- **No mainstream library ships either downgrade as a serializer flag.** N3.js, rdf-serialize (Comunica), rdflib — all emit `<<...>>` or nothing.

What this means: **the downgrade exists architecturally, but we'd have to build the converter ourselves.** ~50 LOC of TypeScript that transforms quoted-triple quads into classical-reification quads before N3.js serializes.

## Sketch — the reification shim

A `RepresentationConverter` in CSS's `ChainedConverter`:

```typescript
class StarToClassicalReificationConverter extends BaseTypedRepresentationConverter {
    // input: internal/quads with quoted-triple subjects/objects
    // output: internal/quads with rdf:Statement reification

    async handle({ representation: quads, preferences }) {
        const transformed = transformSafely(quads.data, {
            transform(quad) {
                if (quad.subject.termType === 'Quad') {
                    // << s p o >> :pred :val  →  classical reification
                    const stmt = blankNode();
                    this.push(quad(stmt, RDF.type, RDF.Statement));
                    this.push(quad(stmt, RDF.subject, quad.subject.subject));
                    this.push(quad(stmt, RDF.predicate, quad.subject.predicate));
                    this.push(quad(stmt, RDF.object, quad.subject.object));
                    this.push(quad(stmt, quad.predicate, quad.object));
                    // also emit the bare asserted triple (optional, format-config)
                    this.push(quad.subject);
                } else {
                    this.push(quad);
                }
            },
        });
        return new BasicRepresentation(transformed, quads.metadata, contentType);
    }
}
```

Slot it in `quad-to-rdf.json` ahead of `QuadToRdfConverter` when client `Accept` is `text/turtle` (no star). Skip when `Accept: text/turtle-star`.

Round-trip on the read path needs a counterpart: `ClassicalReificationToStarConverter` for PATCH `.meta` requests submitted in star syntax but stored in classical (or vice versa). Decide later based on which form we treat as canonical.

**Canonical storage decision is open.** Two viable options:
- **Star canonical on disk**, downgrade-on-read: needs CSS overrides for `.meta` content-type → `text/turtle-star`. Cleaner conceptually; sensitive to rdflib's future trajectory.
- **Classical canonical on disk**, upgrade-on-read: works with today's rdflib. SPARQL-star queries get rewritten or evaluated through Comunica 5.x against the classical form.

Both are tenable. Pick after the experiment.

## CSS application-layer provenance — what's actually there

Probe of CSS internals (2026-05-15) for "does CSS automatically capture WHO writes to `.meta`":

**Answer: No. CSS does not propagate agent identity to the storage layer.**

Evidence:
1. `AuthorizingHttpHandler.handle()` extracts credentials via `credentialsExtractor`, uses them for authorization, then calls `operationHandler.handleSafe({request, operation})` — credentials are NOT propagated.
2. `OperationHttpHandlerInput` interface (`server/OperationHttpHandler.d.ts`) extends `HttpHandlerInput` with `operation`; has no credentials field.
3. `Operation` interface (`http/Operation.d.ts`) has `{method, target, preferences, conditions, body}` — no credentials.
4. `PutOperationHandler.handle()` calls `this.store.setRepresentation(operation.target, operation.body, operation.conditions)` — store sees only target + body + conditions.
5. `PatchOperationHandler` follows the same pattern. (And note: PUT on `.meta` is explicitly forbidden — `MethodNotAllowedHttpError` at `PutOperationHandler:48`. Agent-direct `.meta` writes are PATCH-only.)
6. `MonitoringStore.emitChanged` emits `('changed', identifier, activity, metadata)` — `metadata` comes from the store, not from auth. No actor info.
7. `ActivityNotificationGenerator` produces AS2 notifications with `{id, type, object, state, published}` — **no `as:actor` field**. AS2 supports it; CSS doesn't populate it.
8. `grep -rn "dct:creator\|dcterms:creator\|prov:wasGeneratedBy\|as:actor"` across the entire CSS dist: no hits in the storage or HTTP write paths.

So if we want application-layer provenance, **we have to build it**. Five viable paths:

(α) **Extend `OperationHttpHandlerInput`** to carry credentials. Wrap `AuthorizingHttpHandler` (or replace) so downstream handlers and stores see WebID. Most invasive — touches CSS-core interfaces.

(β) **MetadataParser variant of `AuthorizationParser`** that writes WebID into the request representation's metadata as a *persisted* (not `ResponseMetadata`-tagged) triple. Less invasive but smells like a workaround.

(γ) **Wrap the `ResourceStore`** (PassthroughStore pattern, same as ShapeValidationStore) to inject `prov:wasGeneratedBy <webid>` on writes. Needs access to credentials, so combines with (α) or (β).

(δ) **Agent self-attribution**. Agent's PATCH body includes its own `prov:wasGeneratedBy <its-webid>` triple. Pod doesn't enforce or sign — WAC/ACP already gated whether this agent CAN write; the provenance triple is the agent's claim about its own action. Zero CSS surgery. Decentralized. **Most aligned with the RDF-star approach.**

(ε) **ActivityNotification extension**: subclass the generator to populate `as:actor`. Persists in notification stream only, not in `.meta`. Complementary, not a replacement.

For the RDF-star path described above, **(δ) is the natural fit**: agents annotate their own triples with `prov:wasGeneratedBy <their-webid>`; substrate annotates its projections with `prov:wasGeneratedBy <#markdownProjectionListener>`. Both are claims; neither is forged because WAC/ACP gates the write itself.

If a stronger property is needed (Pod *vouches* for the WebID-to-triple binding), (γ) + (α) is the path — Pod attaches a signed `prov:wasGeneratedBy` based on the authenticated WebID, agent's claim and Pod's claim coexist in different annotations on the same quoted triple.

## Open experiment questions

1. **Do agents actually want to extend `.meta`?** If Rung 1.5 eval shows zero agent PATCHes to `.meta`, the entire RQ-Listener-1 thread is moot and we never need RDF-star, .meta.agent, or anything else.
2. **What predicates do agents add?** If only governed-set predicates, predicate-name governance (D81 as-is) breaks down. If only non-governed predicates, D81 holds without modification.
3. **Is per-triple provenance load-bearing?** Or is per-resource ("this resource was last touched by agent X") sufficient? Per-resource is much cheaper.
4. **Storage canonical form**: star or classical reification? Tooling balance shifts as rdflib 8.x and Comunica 5.x mature.
5. **Performance**: star annotations roughly double the triple count in `.meta`. Acceptable for prototype; benchmark before Rung 1.5+ scale-out.

## Decision criteria (when to revisit)

Convert this candidate to a real decision (D82) when **two of the following three** are true:
1. Rung 1.5 eval shows agents PATCHing `.meta` with non-governed predicates in >10% of T-condition tasks
2. rdflib 8.x ships RDF-star, OR an experiment confirms the 50-LOC reification shim works end-to-end with Comunica + rdflib classical-reification SPARQL queries
3. RLM-side eval shows per-triple provenance changes agent behavior (e.g., agents avoid re-asserting claims they've already attributed, agents reason about their own past assertions)

If only one criterion fires, the simpler path is still preferred:
- (1) alone → `.meta.agent` sidecar (option B from the parent design doc)
- (2) alone → keep doing what we're doing; RDF-star is unused capability
- (3) alone → RDF-star authoring without the reification shim, accepting that Python clients can't read provenance until rdflib 8.x

## Status

**Not a decision.** A capture of one possibility for solving the agent-enrichment problem without a `.meta.agent` sidecar. Concrete enough to revisit with eval data; not built into anything yet. Promotes to D82 only when criteria above are met.

## References

- Parent design doc: `docs/plans/2026-05-15-rq-listener-1-mitigation-design.md`
- RDF 1.2 spec: https://www.w3.org/TR/rdf12-concepts/
- RDF 1.2 Interoperability Note: https://w3c.github.io/rdf-interop/spec/
- rdflib RDF-star tracking issue: https://github.com/RDFLib/rdflib/issues/1554
- Comunica 5.0 release post (SPARQL-star/Turtle 1.2 support): https://comunica.dev/blog/2026-01-07-release_5_0/
- CSS source files inspected (no provenance found):
  - `node_modules/@solid/community-server/dist/server/AuthorizingHttpHandler.js`
  - `node_modules/@solid/community-server/dist/http/Operation.d.ts`
  - `node_modules/@solid/community-server/dist/http/ldp/PutOperationHandler.js`
  - `node_modules/@solid/community-server/dist/storage/MonitoringStore.js`
  - `node_modules/@solid/community-server/dist/server/notifications/generate/ActivityNotificationGenerator.js`
