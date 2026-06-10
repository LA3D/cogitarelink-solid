# Progressive-Disclosure Audit — Is the Index Layer Right?

**Status:** audit complete 2026-06-10. Companion to the decision sanity check
(`2026-06-09-decision-record-sanity-check.md`); feeds the read-path structure design.
**Question (Chuck):** wiki-memory (Karpathy) and llms.txt (Howard) both rest on index
views over structured information — lean catalogs that tell an agent what affordances
exist and where to descend. Theory: SPARQL views (a subset of Verborgh's *What's in a
Pod?* views) can derive those index views from the graph. Is the current design the
correct realization of the progressive-disclosure portion of the program?

## 1. What progressive disclosure means in each tradition

Five traditions, one shape:

| Tradition | Index artifact | Load-bearing feature |
|---|---|---|
| Karpathy agentic wiki | `index.md` — "content-oriented catalog of all pages **with summaries, organized by category**" | summaries + categories (flat, single file) |
| llms.txt (Howard) | fixed well-known location; H1 + blockquote summary; H2 sections of `link — one-line description`; `Optional` section | the one-line hook per link + explicit deferral |
| This vault | VAULT-INDEX → sub-index/MOC → note | hierarchy + hooks + bounded branching (Fano ≤12) |
| DCAT handle-first (vault PD theory note) | catalog → dataset metadata → distribution → data | handles + bounded metadata slices before payload |
| Verborgh *What's in a Pod?* | documents are views over the graph | an index is just a view whose shape is a table of contents |

Common abstraction: **an index view is a derived, bounded, token-layer document of
(handle + one-line hook) entries, organized by category, at a well-known location.**
Three levels: arrival (orientation + routing) → domain index (hooks) → leaf (full
resource). The *hook text* is the part every tradition treats as load-bearing: it's
what lets a bounded-attention agent decide where to descend without N+1 fetching.

## 2. Inventory — the Pod's current disclosure surfaces

| Level | Surface | Verdict |
|---|---|---|
| Arrival | `.well-known/solid` storage description (D44 router; cut-A disposition literal) | works (Phase A, H0); being re-cut lean per the structure design |
| Global entry | synthesis `/wiki/index.md` (D93) | right *genre* (the llms.txt analogue) but hand-authored, one global page, pointer-deep, unconsulted when agents land on resource URLs |
| **Domain index** | **container GET = bare `ldp:contains`** | **the gap — handles without hooks** (no titles, definitions, or categories; agent must fetch every member to learn what anything is) |
| Derived nav | `hub-view.ttl` / `breadcrumb-view.ttl` (D80, D45) | built as *invocable affordances* — quoted CONSTRUCT the agent must run in its own engine; probes show agents never do this; effectively a dead surface |
| Cross-cutting | Person view space (D113/D114 `ViewAssembler`) | the right machinery — declared CONSTRUCT, server-executed, served as a document |
| Search | wiki-search (D91) | retrieval, not disclosure; complementary, validated |
| Leaf | fused read + dual-layer (D114, D58/D71) | solved |

## 3. Verdict: right parts, mis-assembled middle

The substrate has every part the index layer needs — a graph carrying exactly the hook
literals (`dct:title`, `skos:prefLabel`, `skos:definition`, `rdf:type`, maturity; D108
enforced and materialized them for precisely this kind of consumer), a declared-query
view engine (D113), an entry point, and container hierarchy. What it lacks is the
assembly: **no surface composes those literals into hook-bearing index views.** Three
specific mismatches:

**(a) Handles without hooks.** LDP gives the hierarchy levels, but `ldp:contains` is a
bare handle list. Of the five traditions in §1, our substrate is the only one missing
the hook layer. An agent at `/wiki/concepts/` today faces N opaque URLs — the exact
context-stuffing-vs-disclosure failure the DCAT pattern exists to avoid.

**(b) Derived views packaged as queries-to-run instead of documents-to-read.** The
SPARQL-views theory is right, with one amendment the probes force: **the SPARQL must be
server-side.** Agents consume views; they do not execute queries — RQ-View-2 Tier-3
never ran `sparql` (fused read only); E8 free agents used the graph tool only to
*confirm*. D80's hub-view hands the agent a quoted CONSTRUCT and says "run this in your
own Comunica" — structurally the conneg-by-profile mistake again: a client-initiated
bespoke interaction with no deployed-web prior. The fix already exists in-house: the
D113 `ViewAssembler` executes declared CONSTRUCTs server-side and serves the result as
a resource. Index views should ride that machinery, not the affordance-invocation path.

**(c) The index function is hand-authored where it should be derived.** The synthesis
page mixes orientation prose (correct, now partially re-homed to the Layer-0 literal)
with a hand-maintained catalog. Hand-authored indexes drift — we have direct evidence
(stale seeded `skos:narrower`; the synthesis page already needed an ORIENTATION patch
after RQ-Substrate-4). The D109 derive-rule classifies index content as inferable →
it must be derived, never authored.

## 4. The corrected design (small, because the parts exist)

1. **Index views as declared CONSTRUCT views rendered as markdown.** Per-container
   (and pod-root) index view assembled by the `ViewAssembler`: per member — title, one
   line of `skos:definition`/`dct:description`, type; grouped by class or SKOS
   top-concepts; an `Optional`/archive section for deferral. SPARQL is the
   implementation; the agent sees an llms.txt-shaped document. Surface it by **regular
   media-type conneg, in-band** (`Accept: text/markdown` on a container → the index
   document; `text/turtle` → the same entries as triples) — deployed rails only,
   consistent with H0 and the deployed-web principle. No new negotiation machinery.
2. **`/llms.txt` at pod root, derived.** llms.txt is accumulating real deployment
   density → rising model priors → per the deployed-web principle it is becoming a rail
   worth riding. Derive it from the same graph: H1 + summary from the Layer-0
   orientation, H2 sections from the Type Index, hook lines from definitions. Zero new
   vocabulary; pure derivation; trivially testable.
3. **Re-cut hub/breadcrumb from affordances to view inputs.** Same CONSTRUCTs,
   engine-executed; hubs surface as the *top section of the index view* (high-in-degree
   concepts are the natural first paragraph of a domain index) instead of as quoted
   queries nobody runs.
4. **Bounded branching enforced at the view layer.** When a container exceeds the
   bound (~12), the index view groups by `skos:broader`/type into subsections — giving
   RQ-Hub-1 and L2 invariant #1 an operational surface, and giving the Tier-2 curation
   loop a measurable lint target ("index section exceeds bound"; "member lacks a hook
   line" → a derive-class curation need, since the missing `skos:definition` is
   floor-authorable judgment the loop should flag, not silently synthesize).

Relation to Verborgh: index views are exactly his documents-as-views-over-the-graph,
restricted to the table-of-contents shape — the subset that needs no profile
negotiation, no new affordance vocabulary, and no client-side engine.

Relation to the structure design: the Layer-0 literal carries orientation + disposition
+ routing; index views are Layer-1. Together they are D109 Tier-0's
"layered context-loading" actually realized — and they answer "what affordances are
present and how to follow your nose" at the depth the bootstrap test says agents
actually read (immediate ≫ pointer).

## 5. Evidence honesty + the cheap probe

Validated: agents follow noses at the resource level (H0); cold discovery via the
router works (Phase A); the vault's own INDEX→MOC→note practice works in every session;
the hook-bearing index shape is convergent across five traditions. **Not yet measured:
pod-side index views changing agent navigation.** The probe is cheap and reuses the
`evals/` rigs: cold agent at pod root, task requiring locating one resource among many
— arm A bare `ldp:contains`, arm B derived index views (+ optional arm C `/llms.txt`).
Measure fetch count, wrong-container descents, time-to-target. Extends RQ-Discovery-1;
n=2-3 per arm suffices for direction.

## 6. Decision touchpoints

- **D80** (derived nav classes): re-cut delivery from invocable affordance to
  ViewAssembler-served view — same logic, new surface; the affordance descriptors
  remain as the declared-query source of truth.
- **D93** (synthesis entry point): index function moves out (derived); orientation
  prose stays, lean, per the structure design.
- **D45/D113**: unchanged — this is their second consumer, which strengthens both.
- **D much-earlier `index.md`-as-entry + D44 router**: unchanged at arrival level.
- New decision to mint alongside the structure design: **index views are derived,
  hook-bearing, bounded, served on deployed rails** (the progressive-disclosure
  contract), closing the gap between L2 invariant #2 (tiered retrieval) and any
  enforcing surface.
