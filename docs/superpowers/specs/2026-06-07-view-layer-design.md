# View Layer — Design (D107 §6 realized)

> **⚠ Read-path delivery SUPERSEDED by D114** (`2026-06-07-read-path-view-authority-design.md`, BUILT 2026-06-07). The A′ conditional `<!-- pod:notice -->` trailer (§3–§4), the `?_profile=doc` and `?_profile=graph` views, and the 422 marker guard were removed — the cold probe (`docs/plans/2026-06-07-view-layer-cold-probe-report.md`) did not validate the trailer, and the architecture decision is: curl = degraded follow-your-nose floor; governed metadata lives in `.meta`; the fused-read tier is the delivery contract. What STANDS from this spec: the PROF class profiles, `?_profile=fused` (now substrate-wide + content-type-agnostic) + `?_profile=alt`, the Person cross-cutting demonstrator, the `ViewAssembler` declared-query engine, the `sub:` vocabulary, and the write grammar/admission-floor/ledger. See D114 for the corrected read-path design + the new view-authority contract.

**Date:** 2026-06-07
**Status:** Approved in brainstorm (Chuck + Claude); supersedes the deferred sketch in
D107 §6 / neurosymbolic spec §4.3 by concretizing it. Companion evidence:
`docs/plans/2026-06-06-d112-cold-probe-report.md` (Probe 2 negative),
`docs/plans/2026-06-07-rq-view-2-report.md` (fused-view finding).
**Grounding read for this design:** Verborgh et al., *What's in a Pod?*
(solidlabresearch.github.io/WhatsInAPod), Sparna *Semantic Markdown Spec* (hackmd
@sparna/semantic-markdown-draft), Solid Protocol v0.11, W3C PROF (WG Note) + Conneg-by-Profile
(WD) + RFC 6906.

---

## 1. Problem and evidence

Two converged negative findings define the problem:

1. **D112 Probe 2 (0/2):** the `mem:hasOpenAction` Link header was emitted correctly but
   never entered any cold agent's context — agents `curl -s` body-only. Delivery-channel
   failure: out-of-band HTTP metadata does not reach the floor.
2. **RQ-View-2 (central finding):** agents consume the token/representation layer. The
   Tier-1 read arm answered a graph question from bodies alone (0 `.meta` fetches —
   dual-layer linking makes the body carry the graph); the Tier-3 arm consumed graph
   triples only via the CLI's **fused** `read` (body+sidecar in one response) and never
   ran `sparql`. `describedby` and PROF pointers went unused.

Conclusion: **everything that must reach an agent has to be in the representation it
actually fetches.** Verborgh's frame agrees from theory: the pod is a hybrid
contextualized knowledge graph; document APIs are views over it; *"it is the
responsibility of views to expose all written information in the correct place within
APIs"*; no view is canonical; and a document view whose partitioning matches client
request patterns legitimately outperforms a query endpoint — which is what RQ-View-2
observed behaviorally.

This design also answers the D112 read-path design response (the
teach-the-convention / surface-in-representation / curator-facing-only candidates
collapse into §4 below) and the second open piece of RQ-Substrate-4.

## 2. Scope decisions (made in brainstorm)

| Decision | Choice |
|---|---|
| Overall scope | Full D107 §6 view layer: view definitions as Pod data, processor, conneg-by-profile selection, writability rules |
| Cross-cutting views | Per-resource machinery + **exactly one** cross-cutting demonstrator (the Person view, §6) |
| Default GET | **A′**: stored body byte-identical, **plus a conditional dynamic-state trailer only when open state exists** (§4) |
| Fused view | First-class **read-only** view (`?_profile=fused`); the Tier-2/3 read backend |
| Write safety | Explicit `422` on inbound server-managed marker — never silent strip (§5) |
| Query execution | **Declared-query, engine-executed** (§3.1) — one CONSTRUCT, three execution contexts |

### 2.1 The static/dynamic decomposition (why A′ is small)

The fused representation carries two payloads with different properties:

- **Static graph context** (`prefLabel`, `broader`, types, authored edges): already in
  the body by construction — RQ-Grammar-1 made the body a complete write-view of the
  governed graph, and RQ-View-2 proved agents answer graph questions from it. Fusing it
  into the *default* GET is redundant.
- **Dynamic state** (`mem:hasOpenAction`, staleness, curator-added triples): not in the
  body, changes independently of it. This is the only demonstrated floor gap.

So the default representation only needs the **dynamic** payload, conditionally. The
full fusion is a separate, read-only view.

### 2.2 The lens law rules out fused-as-default

Neurosymbolic spec §4.4: *a view is writable iff its `get` admits a well-behaved `put`;
lossy/analytical views are read-only.* The fused view is lossy (derived + dynamic
content); making it the default representation of a writable resource would require
strip machinery to fake a well-behaved `put`. Design-consistent move: fused is a
read-only sibling view; the default GET stays the writable document view.

### 2.3 The imitation hazard rules out an always-on trailer

RQ-View-2 substrate finding: **seeded exemplars teach phantom affordances** — cold
agents imitate structure they see in served documents. A permanent injected region
would be imitated in agent writes (garbage to strip, or worse, intended assertions
placed inside it and lost). The conditional trailer minimizes exposure; the 422 floor
(§5) converts the residual case into a teaching moment.

## 3. View formalism

A **view** is a `prof:Profile` (subclassed as `sub:View`) whose descriptor carries the
§4.3 five-tuple as Pod data. Conneg-by-profile negotiates *representations conforming
to profiles*, so `?_profile=fused` reads literally as "the representation conforming to
the fused profile."

```turtle
@prefix sub:  <https://pod.vardeman.me/vault/ontology/substrate#> .
@prefix prof: <http://www.w3.org/ns/dx/prof/> .
@prefix role: <http://www.w3.org/ns/dx/prof/role/> .

</vault/meta/views/fused> a sub:View, prof:Profile ;
  prof:hasToken "fused" ;
  prof:hasResource [ a prof:ResourceDescriptor ;
    prof:hasRole role:mapping ;                     # CONSTRUCT-as-view IS a mapping
    dct:format "application/sparql-query" ;
    prof:hasArtifact </vault/meta/views/fused-projection> ] ;
  sub:realization sub:Virtual ;
  sub:writable false ;
  sh:agentInstruction "Body + governed graph + open actions in one response. Read-only; author via the document view (plain GET/PUT on the resource URL)." ;
  prof:isProfileOf </vault/meta/profiles/page> ;
  prof:isTransitiveProfileOf </vault/meta/profiles/page>, <https://solidproject.org/TR/protocol> .
```

Conventions honored (per `solid-profiles-and-conneg` + `solid-uri-conformance`):
explicit `prof:isTransitiveProfileOf` (the `dct:conformsTo` chain axiom is at-risk);
never emit `Content-Profile` (expired draft); `Link: rel="profile"` (RFC 6906) is the
ratified anchor; descriptor resources are extension-less; new terms land in the
existing hash-namespace substrate vocabulary (`/vault/ontology/substrate`).

**New `sub:` mints** (PROF has no concept for either realization or writability):
`sub:View`, `sub:realization` (`sub:Virtual` | `sub:Materialized`), `sub:writable`
(xsd:boolean), `sub:servesAt` (cross-cutting views: the URL space the view mints).
The projection artifact uses standard `role:mapping` (*"describes conversions between
two specifications"*) with a `skos:note`, rather than a custom role — fewer mints.

### 3.1 Declared-query, engine-executed

The Pod exposes **no SPARQL HTTP endpoint** (D3/D29 unchanged), but the declared
CONSTRUCT in each descriptor is the *executed* definition, not documentation. One
query, three execution contexts:

1. **CSS view processor** — embeds plain `@comunica/query-sparql` (programmatic
   `QueryEngine`, explicit sources only; no link-traversal, which also sidesteps the
   traqula pin) and executes the descriptor's projection at serve time.
2. **Pod-side MCP** (planned, sibling repo; seed: `jeswr/solid-mcp`, a thin LDP-over-MCP
   wrapper — the Comunica `sparql` tool is the half to add) — same engine, tool channel.
3. **Client CLI** (`solid-pod sparql`/`invoke`, exists) — agent's own engine, D52-style.

This kills the dual-implementation drift hazard ("two maps, one source") that a
native-TypeScript-assembly implementation would reintroduce, and strengthens
self-validation: the curator/`pod_audit.py` can run the declared query client-side and
diff against the served view.

**Fused is a document, not a graph:** a CONSTRUCT produces a graph; the fused view is
markdown body ⊕ serialize(projection result) appended as a fenced Turtle section. The
projection defines only the graph component (governed triples + open actions); the
document view contributes the body verbatim. No query pretends to produce markdown.

## 4. The view inventory and the default GET

### 4.1 Per-resource views

| View | Token | Content | Realization | Writable |
|---|---|---|---|---|
| **document** | `doc` | stored markdown body, byte-identical (**default**) | n/a (is the stored resource) | **yes** |
| **fused** | `fused` | body + fenced-Turtle governed graph + open actions (served `text/markdown`) | virtual | no |
| **graph** | `graph` | the `.meta` description-resource content (Turtle) | virtual (alias of `describedby` target) | no (agent enrichment stays on the `.meta` PATCH path) |

### 4.2 Selection and advertisement

- `?_profile={token}` QSA — the conneg WD MUST; same idiom as the existing
  `?ext=search-grep` affordance.
- `?_profile=alt` — list-views introspection (reserved token; WD SHOULD). The in-band
  discovery affordance.
- `Link: rel="profile"` on every GET (RFC 6906; a MUST on negotiated responses). Closes
  the deferred D86 MetadataWriter FOLLOWUP and finally installs the 5 authored PROF
  profiles.
- `Accept-Profile`: parsed if present, never required (cold curl agents won't send it).

### 4.3 The conditional dynamic trailer (decision A′)

Default GET serves the stored body **byte-identical** unless the operations index has
open state for the resource (same lookup `CurationLinkMetadataWriter` already performs
for the dead Link header — reused, redirected into the body):

```markdown
<!-- pod:notice — server-managed; do not include this block in writes -->
> ⚠ 1 open action on this resource:
> mem:RealignAction </vault/wiki/.operations/op-17> — "broader link targets a renamed concept"
> Full graph + state: ?_profile=fused · all views: ?_profile=alt
<!-- /pod:notice -->
```

Content: count, action type, operation IRI, `mem:rationale` one-liner, fused/alt
pointers. Properties:

- **Round-trip pristine in the common case** — no open state ⇒ served = stored.
- **Honesty invariants met at the floor** (L2 #3 lifecycle-first-class, #7 OOD
  honesty): a record with a pending correction is never served without saying so.
- **Memento untouched** — the trailer decorates the *current* resource only; archived
  versions serve stored bodies.
- **ETag/caching**: the trailer participates in the representation; ETag must vary with
  open-state (serve-time assembly, same as Memento headers today).

## 5. Write path

| Surface | Behavior |
|---|---|
| Document view (default) | Unchanged: admission floor (D108) + projection (D58/D71) |
| Inbound body containing `<!-- pod:notice` | **422** from the admission floor (path-agnostic string guard, pre-projection) with instruction: "server-managed region — assert in prose, wikilinks, or `.meta`" |
| Write to `?_profile=fused\|graph` or `/vault/views/*` | **405**, `Allow: GET, HEAD, OPTIONS`, body names the writable view |
| `.meta` PATCH | Unchanged (agent enrichment; governed predicates listener-owned) |

Explicit rejection, never silent strip: nothing an agent writes is ever discarded
without a response saying so (explicit-write invariant #4). The 422-teaches pattern is
the same floor cold probes already handle well (zero-422 grammar compliance in
RQ-View-2 came *from* this style of enforcement).

## 6. Cross-cutting demonstrator: the Person view

The documented fragmentation (cold-probe Confusion #3 = Verborgh's breaking example):
one person as a wiki note in `/wiki/people/` *and* an AddressBook contact in
`/contacts/`. The demonstrator surfaces **one entity at a third URL, assembled from
both**:

- **URL space**: `/vault/views/people/` (container, trailing slash) +
  `/vault/views/people/{slug}`. Read-only, virtual.
- **Descriptor-driven**: the view descriptor carries `sub:servesAt
  </vault/views/people/>`; its `role:mapping` artifact is a CONSTRUCT joining the wiki
  person's `.meta` with the contact resource over the `owl:sameAs`/`skos:exactMatch`
  bridge. Sources enumerated via Type Index (person-class containers) — no source
  hardcode (D107).
- **Serve**: Turtle. Container lists members; each member names its two writable homes
  via `rdfs:seeAlso`.
- **Write attempt** → 405 + pointer to the writable homes (the lens law as a teaching
  response).
- **Deferred deliberately**: change-driven rematerialization (virtual sidesteps it);
  additional cross-cutting views (machinery is general via `sub:servesAt`; v1 ships one).

## 7. Implementation map

1. **`css/extensions/view-layer/`** (new): `?_profile=` QSA interception (precedent:
   `?ext=search-grep`, `?version=`); `ViewAssembler` embedding plain
   `@comunica/query-sparql` with explicit sources; trailer decorator on default GET
   (reuses the D112 operations-index lookup); `?_profile=alt` catalog.
2. **`css/extensions/profile-link/`**: the deferred D86 MetadataWriter (~30 LOC).
3. **Admission floor**: `<!-- pod:notice` marker guard in `AdmissionFloorStore`.
4. **Overlay machinery**: `overlay:installsProfile` (existing FOLLOWUP) +
   `overlay:installsView`; seed 3 per-resource view descriptors + the person view;
   install the 5 authored PROF profiles.
5. **Vocabulary**: add the `sub:` mints to `/vault/ontology/substrate` (hash namespace,
   conformance-checked).
6. **MCP** (sibling repo, out of this repo's v1 scope, designed-for): LDP access +
   Comunica `sparql` tool; executes declared projections directly.

## 8. Eval hook

- **Re-run the D112 Probe-2 read-path probe** against the trailer: seed an open action,
  cold curl agent GETs the record — does the notice enter context and change behavior?
  RQ-Atomic-Feedback-1 read-path datapoint #2; the direct test of this design.
  Secondary observation: trailer imitation in writes (expect the 422 to catch + teach —
  itself a finding).
- **Fused-view consumption** via a Tier-3 CLI arm (RQ-View-2 instrument); watch for
  `?_profile=alt` discovery (in-band discovery datapoint).
- Passing closes the second open piece of **RQ-Substrate-4**, leaving the RQ closeable.
- Harness: the cold-probe rig pattern (`~/dev/probes/`, auto-mem
  `cold_probe_harness_pattern`).

## 9. Out of scope, flagged as companions

- **`skos:narrower` derive-rule fix** (D109 derive-the-inferable violation; seeded
  narrower now stale) — will surface visibly in graph/fused views; separate fix.
- **D75 RDFa tension** — the fused profile partially *answers* it (the machine-readable
  face of a wiki note is now a negotiable view, not RDFa-in-HTML), but D75
  reconciliation stays its own decision. Flag in `typed-wikilink-syntax-provenance.md`
  §4 remains.
- **Materialized cross-cutting views + rematerialization triggers** — when a view's
  request pattern justifies it (Verborgh's performance argument, measured not assumed).
- **Auth on views** — dev-allow-all stands (behavior before security).

## 10. References

- Verborgh, Taelman, Van de Wiele et al., *What's in a Pod?* —
  https://solidlabresearch.github.io/WhatsInAPod/
- Sparna / Thomas Francart, *Semantic Markdown Spec (Alpha Draft)* —
  https://hackmd.io/@sparna/semantic-markdown-draft
- W3C PROF (WG Note), Conneg-by-Profile (WD Oct 2023), RFC 6906
- `jeswr/solid-mcp` — https://github.com/jeswr/solid-mcp (LDP-over-MCP seed)
- Repo: D107 spec §6, neurosymbolic spec §4.3/§4.4 (the lens law), D108 (admission
  floor), D112 cold-probe report, RQ-View-2 report,
  `docs/decisions/typed-wikilink-syntax-provenance.md`
- Vault: *Memory Substrate vs Memory Profile* (the seven L2 invariants), *Affordance
  Spectrum for Agentic Memory*, *Semantic-Markdown Typed Edges — Why the Carrier
  Matters*
