# Read-Path View Authority — Design (D114)

**Date:** 2026-06-07
**Status:** Approved in brainstorm (Chuck + Claude). Corrects the read-path delivery
design of D113 after the view-layer cold probe
(`docs/plans/2026-06-07-view-layer-cold-probe-report.md`, corrected). Builds on the
D113 spec (`2026-06-07-view-layer-design.md`) — keeps its PROF views, Person
demonstrator, `sub:` vocabulary, and declared-query engine; reopens only the
read-path *delivery* (the trailer / default GET).

## 1. What this corrects

D113's A′ centerpiece was the conditional `<!-- pod:notice -->` trailer: inject the
open-action signal into the markdown body so curl agents read it. The cold probe did
not validate it (both Arm-A agents used `curl -v` and saw the Link header too — the
trailer was never isolated), and a follow-up showed the CLI fused read surfaces
governed context on *any* content type. That triggered the architecture decision
below, under which the trailer is a markdown-only, single-signal shadow of the fused
read at a tier we've decided is degraded.

## 2. Architecture decision (the spine)

**curl is a degraded follow-your-nose floor. Governed metadata lives in the `.meta`
graph layer. The fused-read tier (a single HTTP affordance, wrapped by CLI / planned
MCP) is the delivery contract for governed context.**

### 2.1 The agent's dual-view decision problem (why this is the real issue)

Every resource has two surfaces, and the agent must decide which answers its question
and which to write to:

| | Document view (markdown) | Graph view (`.meta` / SPARQL) |
|---|---|---|
| Read | content, prose, in-band wikilinks (token-layer graph) | **authoritative** typed edges, governed context (open actions, provenance, staleness), derived triples, cross-resource queries |
| Write | author prose + navigational / locally-authorable links | governed-global judgment (curator realignment → ledger, exactMatch, broader placement) |

The load-bearing fact, surfaced by RQ-View-2: **the body's in-band graph (wikilinks)
is a lossy, possibly-stale projection of the authoritative graph, and a
document-reading agent cannot tell.** Agents over-trust it (the seeded `narrower` was
in the body but underived/stale; agents answered from it anyway). So "document view
alone" is safe for *content* tasks and quietly unsafe for *graph* tasks.

### 2.2 The fused read dissolves the read crossover

The fused read (body + **authoritative** graph in one representation) means the agent
never has to decide "should I cross to the graph now?" and cannot over-trust the body
— the authoritative graph is right there. RQ-View-2 Tier-3 agents used it and never
ran `sparql`. So the read model is:

- **per-resource graph-aware read → fused read** (the default tool read; also a
  one-request curl affordance, §3)
- **cross-resource / aggregate → SPARQL** (client-side, D3/D29)
- **content-only → document view** (the degraded floor; safe for prose only)

### 2.3 The missing piece (the cause of "stumbling along")

Neither view *declares its authority*. `describedby` says "metadata exists" (dumb
pointer); PROF says "here's the shape"; nothing says *which surface is authoritative
for what, or when to fuse*. We've relied on agents to infer it — and they over-trust
the body when they don't. **The fix is a declared view-authority contract**, per
resource-kind, surfaced as a teach-the-convention artifact (not per-resource
discovery, which agents won't pay for).

## 3. What we build

### 3.1 Remove the trailer (revert A′)

- Delete `TrailerDecoratingStore` and its config wiring (the store override above
  MonitoringStore).
- Delete the `AdmissionFloorStore` `<!-- pod:notice` 422 marker guard (nothing to
  protect once the trailer is gone).
- Default GET = the stored body, byte-identical, always. The `?_profile=doc` view
  collapses into the default (no trailer ⇒ `doc` == default) — remove the `doc`
  token/descriptor.
- Keep `trailer.ts`? No — remove. Keep the `view-layer` extension; just remove the
  trailer module + its tests.

### 3.2 The fused read as the canonical contract surface

- `?_profile=fused` becomes **substrate-wide and content-type-agnostic**: it must work
  on `/id/` and any other tree, and on Turtle records as well as markdown. Today it is
  `/vault`-scoped and did not surface `.meta` on `/id/` — fix the handler's scoping and
  its `.meta`-merge so a fused GET on `/id/schemes/orcid` carries `mem:hasOpenAction`.
- The fused representation = the resource's own content + its authoritative governed
  graph (`.meta`). For markdown: body + fenced graph (existing). For RDF: the
  resource's triples + its `.meta` triples in one Turtle document.
- This is the single affordance every tier uses: a curl floor agent opts in with
  `curl …?_profile=fused`; the CLI/MCP `read` wrap the same contract (the CLI's
  client-side describedby-merge is an equivalent implementation — they must produce the
  same fused representation; add an agreement check).
- `?_profile=graph` (== the `.meta` alone) is redundant with `describedby` — remove it.
  Keep `?_profile=alt` (introspection) listing `fused` + the class profiles + the
  view-authority profile (§3.3).

### 3.3 The view-authority contract (new)

A declared, per-resource-kind statement an agent can read once and apply everywhere:

- **Where:** a PROF profile resource (e.g. `/vault/meta/profiles/<kind>` already
  exists) carries `sh:agentInstruction` (and/or a dedicated `sub:viewAuthority`
  descriptor) stating, in machine- and human-readable form:
  - the document view is authoritative for: prose, navigational/locally-authorable
    links (the floored body grammar);
  - the graph view (`.meta`) is authoritative for: typed edges, governed context
    (open actions / provenance / staleness), derived triples;
  - **read `?_profile=fused` when your question is about the graph** (the body's typed
    links are a convenience projection, not authoritative);
  - **author in markdown; propose graph-global judgment to the operations ledger**
    (`/…/.operations/`), per the D109 derive/floor/loop rule.
- **Discovery:** linked from the storage description / affordance catalog so a
  cold agent meets it on arrival (the D55 Tier-2 harness path), and from each
  resource's `Link: rel="profile"` (already emitted).
- This is the legible form of what the trailer was gesturing at, content-type-agnostic
  and stated once rather than smeared per-resource.

### 3.4 What stays untouched

PROF class profiles + `Link: rel="profile"`; the Person cross-cutting demonstrator
(`/vault/views/people/`, `ViewSpaceHttpHandler`); the `ViewAssembler` declared-query
engine; the `sub:` vocabulary (minus any trailer-specific terms — none); the write
grammar / admission floor (minus the marker guard) / operations ledger.

## 4. Floor signposts (unchanged, already emitted)

The degraded floor's in-band, content-type-agnostic signposts that a follow-your-nose
agent can act on: `Link: rel="describedby"` (→ `.meta`), `Link:
rel="…mem#hasOpenAction"` (→ the open action), `Link: rel="profile"` (→ the
view-authority + shape). The floor is not guaranteed governed context; these let a
header-inspecting agent reach it, and `?_profile=fused` lets any curl agent opt into
the full fused read in one request.

## 5. Eval plan (the proof in the pudding)

Re-probe after the build, against the deployed tiers:

1. **Tier-3 fused-read arm** (CLI/MCP, like RQ-View-2): does an agent given the
   view-authority contract + the fused affordance reach governed context on both
   markdown and RDF resources? Expected: yes, both.
2. **Over-trust probe:** plant a stale in-band link (body says `broader X`,
   authoritative graph disagrees). Ask a graph question. Does a contract-taught agent
   `?_profile=fused` before answering, or over-trust the body? This is the RQ-View-2
   over-trust failure, now testable.
3. **Floor honesty:** curl-only agent on a resource with governed context — does it at
   least *not assert* the body graph as authoritative (degraded-but-honest), and can it
   reach the graph via `?_profile=fused` when prompted?

Harness: `~/dev/probes/viewlayer/` extended with a Tier-3 arm (the `bin/` shim pattern
from `~/dev/probes/rqview2/`).

## 6. Open questions

- Does `?_profile=fused` on RDF need a different fenced form than markdown's
  body+turtle? (For RDF, content + `.meta` are both Turtle — one merged graph; for
  markdown, body is prose + fenced graph. The handler branches on content type.)
- Is the view-authority contract one global document or per-resource-kind? (Lean:
  per-kind profile carries the specifics; one global statement of the read/write
  division in the storage description.)
- Does removing the marker guard reopen any clobber risk? (No — without the trailer
  there is no server-managed body region to protect; the `.meta` no-clobber is the
  separate RQ-Listener-1 concern, unchanged.)

## 7. References

- D113 spec `2026-06-07-view-layer-design.md`; cold-probe report
  `docs/plans/2026-06-07-view-layer-cold-probe-report.md` (corrected).
- D109 (derive/floor/loop), D107 (URI re-layering / view-layer origin), D55 (three-tier
  access), D3/D29 (SPARQL is client-side), RQ-View-2 + D112 (the read-path findings).
- Verborgh *What's in a Pod?* (hybrid contextualized KG; views over the graph).
