# cogitarelink-solid

A reference Solid Pod as a general-purpose memory substrate for agentic applications. Built from first principles on W3C web standards; the wiki-memory pattern is the canonical reference profile.

> Research prototype, not a production Pod hosting service. Pod reproducible with 1243 vault notes imported and agent-navigable via the standard Solid discovery stack. **Round 1 Rungs 1.1 + 1.2 closed** (read-only Memento + tombstone semantics). Active work: Rung 1.4 — wiki-memory L3 reference profile + affordance descriptor. See [research rounds](#research-rounds).

---

## Why this exists

Four threads converge here. All descend from a single 1945 problem statement.

**Vannevar Bush** proposed the *Memex* in "As We May Think" (1945): a personal, curated knowledge store with associative trails between documents, machine-assisted indexing, and a "trail blazer" role that would build and share the associative structure. Bush named the unsolved problem explicitly: maintenance. Sequential filing was tractable; associative indexing required human cognitive labor at scale. Two threads of his vision descended separately. The associative-indexing thread went through Engelbart (NLS, 1968), Nelson (Xanadu / "hypertext," 1965), and Berners-Lee (WWW 1989, Semantic Web 2001), arriving at the agent framing — *"software agents roaming from page to page can readily carry out sophisticated tasks for users."* The personal-store thread was lost in the WWW and recovered by Solid (2015+). Both branches stalled on Bush's original bottleneck: who maintains the structure? LLMs unblock both at once.

**Karpathy's [LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)** ties the pattern explicitly back to Bush: *"The idea is related in spirit to Vannevar Bush's Memex (1945) … The part he couldn't solve was who does the maintenance. The LLM handles that."* An LLM-maintained, persistent, interlinked markdown wiki where the LLM does the bookkeeping humans abandon. Humans curate; sources are immutable; the wiki accumulates. *"The wiki is a persistent, compounding artifact."* Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase.

**Three traditions converge on the same substrate.** Karpathy's framing is one of three independent research arcs that arrive at the same conclusion. Memory-provider plugins ([Hermes Agent](https://hermes-agent.nousresearch.com/docs/) ships eight backends behind one `MemoryProvider` ABC; [Supermemory](https://supermemory.ai/) runs an ontology-aware memory graph at 100B+ tokens/month) treat the contract as a six-operation provider interface. Benchmark-tuned memory systems ([ByteRover](https://arxiv.org/abs/2604.01599) 96.1% on LoCoMo with markdown + 5-tier retrieval; xMemory's bounded-branching hierarchy; MemoryAgentBench's four cognitive competencies) treat it as a structural commitment. Wiki-memory implementations ([Karpathy's gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f); [AKBP](https://github.com/rohitg00/akbp); [agentmemory](https://github.com/rohitg00/agentmemory)) treat it as *"the durable knowledge contract below your tools."* Each picks one transport (JSONL, SQLite, custom vector graph, filesystem). The shared substrate is seven invariants: bounded branching with typed containment, tiered/progressive retrieval, lifecycle metadata as first-class, explicit write + implicit signals, hybrid blob+graph storage, separable procedural memory, out-of-domain honesty.

**Tim Berners-Lee's Charlie** is the current canonical articulation of what Solid means in the agent era. From TBL's March 2025 statement: *"In 2017 I wrote about Charlie — an AI that works for you. @inrupt labs now has Charlie working. Charlie is the evolution of agentic AI. It's built on top of a re-wired data infrastructure using Solid to give people the security and trust they need to share their data."* From the W3C [Charlie Works](https://www.w3.org/DesignIssues/Works.html) Design Issues note: *"The pod full of semantic web data is extremely powerful in driving the LLM … AI is used in both feeding data into the data graph, and then using the data graph as context."* Inrupt rebranded their core product from "active wallet" to **"agentic wallet"** at Web Summit 2024. The 2001 Semantic Web vision of agents traversing typed associations is now framed as personal AI on a pod. The 2024-2026 pitch is unambiguous: the pod is for your agent, not just for you.

**Ruben Verborgh's Solid Apps arc** (2017–2022) is the architectural substrate the pattern needs to federate. Apps become views over personal data. Shapes are *connection points*, not endpoints — apps bind to shapes, not APIs. A pod is **not** a document hierarchy; it is a *hybrid contextualized knowledge graph* whose document boundaries silently conflate five orthogonal concerns (context, permissions, provenance, trust, performance) that deserve independent granularity.

This repo is the synthesis: a memory substrate derived from first principles on Verborgh's hybrid contextualized KG architecture, with wiki-memory as the canonical reference profile, in the agent-era frame TBL's Charlie names. The W3C web standards (LDP / RDF / SHACL / Memento / LDN / Solid Notifications / ACP) supply all seven substrate invariants — not because we copied any system, but because the standards were designed for the same distributed-knowledge problem. The convergence with Karpathy/Hermes/AKBP/agentmemory/Supermemory/ByteRover is empirical evidence for the design, not its source.

The distinguishing architectural commitment is **dual-layer linking**: markdown wikilinks at the token layer (low-ceremony to write, cheap for LLMs to read) plus RDF predicates in `.meta` at the data layer (queryable, validatable, federatable). The two layers are unified by a server-side projection — agents write typed wikilinks in markdown; the substrate generates Turtle. AKBP and agentmemory each have one layer; this substrate has both. The Memex–Solid synthesis is ours; TBL's last on-record claim that the *Web itself* partly realized Memex was 1995, and he has not re-issued it for Solid. But the structural mapping is hard to miss: personal store (Solid), associative indexing (RDF/SPARQL/Shape Trees), trail blazer (LLM agent), running in one place.

---

## Three layers

The program stratifies into three architectural layers. The stratification is what dissolves the "is the Pod a vault or a substrate?" question:

- **L1 — Pod substrate**. The W3C Solid stack: LDP containers, WAC/ACP, SPARQL, Memento, `.well-known/`, Solid-OIDC, LDN, Solid Notifications Protocol. Universal across any application. Owns resources, namespaces, versioning, access control, discovery, notifications.
- **L2 — Memory substrate**. A specialization of L1 that adds the seven invariants every agent-memory system needs (bounded branching, tiered retrieval, lifecycle metadata, explicit write + implicit signals, hybrid storage, separable procedural memory, OOD honesty). Owns universal lifecycle predicates, the shape protocol, the affordance descriptor, the trigger vocabulary.
- **L3 — Memory profile**. A specific application of L2: a particular edge vocabulary, container layout, consolidation policy, body-affordance descriptor. **Wiki-memory** is the canonical L3 reference profile in this program. The Obsidian vault's PARA + SKOS + concept-note / literature-note vocabulary is one L4 specialization sitting on top of wiki-memory L3.

Multiple L3 profiles can coexist on one Pod, scoped via Type Index + per-container SHACL shape catalog + per-container affordance descriptors. A to-do L3 in one container hierarchy, a calendar L3 in another, a wiki-memory L3 in a third — same Pod, same L1/L2, different L3 contracts.

---

## What this repo is

### A reference Pod, not a memory provider

The pod is the externalization *substrate*, not the memory backend itself. Zhou et al. 2026 frames LLM agents as composing four externalizable substrates — Memory, Skills, Protocols, Harness. Most current systems put the harness at the center and let it orchestrate the others. This project inverts that: **the pod sits at the center as the unification layer**, and the harness becomes a consumer that reads the pod's affordance descriptors and routes accordingly. The six bidirectional couplings Zhou names (memory↔skills, skills↔protocols, etc.) collapse into one operation on a SOLID substrate: typed CRUD + LDN notification + PROV-O lineage + SHACL validation. Zhou's explicit open gaps — §8.4 governance and §8.5 shared infrastructure — are filled by SOLID by construction.

### The vault is one consumer of wiki-memory L3

The Obsidian vault that drives this work is one L4 application of the wiki-memory L3 reference profile — specifically, an L3-on-L2-on-L1 specialization with PARA layout and the research-domain edge vocabulary (`concept:` / `extends:` / `supports:` / `criticizes:`). The vault demonstrates the wiki-memory pattern locally; the Pod is the federable substrate. What a Solid Pod adds *over the local vault*:

| What the vault has | What the Pod adds |
|---|---|
| PARA structure (one container layout) | Type Index + per-profile container catalog (many layouts coexist) |
| Wikilink graph (typed edges in markdown) | Body→`.meta` projection: same wikilinks become RDF predicates (dual-layer linking) |
| Frontmatter metadata (typed YAML edges) | Stable URIs (dereferenceable IRIs); SHACL-validated `.meta` |
| Git version history | Memento (RFC 7089) at HTTP layer + multi-agent authentication (WebID, Solid-OIDC) |
| Skills system (procedural memory) | LDN inbox + Notifications Protocol with `mem:*` AS2 trigger vocab |
| Local Claude Code access | Federable WAC/ACP access control; PROV-O lineage; VC-gated delegation |

The Pod is the federable substrate; the vault is the first L4 consumer. Other applications (to-do lists, calendars, project workspaces) compose as additional L3 profiles on the same Pod.

### What this repo is *not*

- **Not a CLI** — that's [`solid-agent-skills`](https://github.com/LA3D/solid-agent-skills) (sibling repo): 11 commands + 5 Claude Code skills + 53 tests
- **Not a fabric of graph-native nodes** — that's `cogitarelink-fabric` (sibling repo): Oxigraph + FastAPI + Credo
- **Not a memory provider** — providers (Hermes/Supermemory/AKBP/agentmemory style) target the pod via standard LDP + SPARQL + Solid Notifications. The substrate is the contract beneath the providers
- **Not vault-import-as-MVP** — wiki-memory L3 (built from first principles) is the canonical reference profile. Vault import is one use case of wiki-memory L3, not the project's center of gravity
- **Not a production Pod hosting service** — it is a research prototype with disposable local config

---

## Architecture

Two-container stack:

```
┌─────────────────────────────┐    ┌─────────────────────────────┐
│  CSS (Community Solid       │    │  Comunica SPARQL Sidecar    │
│  Server v8 alpha)           │←──→│  (link-traversal over LDP)  │
│  - LDP containers           │    │  - SPARQL Protocol :8080    │
│  - WebID + Solid-OIDC       │    │  - npm overrides for        │
│  - WAC/ACP                  │    │    traqula version fix      │
│  - SHACL validation         │    │                             │
│  - .meta sidecars           │    │                             │
│  - Type Index + Storage     │    │                             │
│    Description              │    │                             │
└──────────────┬──────────────┘    └──────────────┬──────────────┘
               │                                  │
               └──────────────┬───────────────────┘
                              │
                              ↓ HTTP
                ┌─────────────────────────────┐
                │  Clients (Python, all       │
                │  client-only — no Python    │
                │  in the server stack)       │
                │                             │
                │  - scripts/vault_import.py  │
                │  - solid-agent-skills CLI   │
                │  - RLM agent (httpx)        │
                │  - Tests (pytest)           │
                └─────────────────────────────┘
```

Three-layer Pod RDF model (orthogonal to the L1/L2/L3 substrate stratification above — this is the *RDF storage* layering inside L1, not the substrate architecture):

- **Layer A** — LDP container hierarchy, generated automatically by CSS
- **Layer B** — `.meta` sidecars carry per-resource RDF, validated by SHACL, addressable via the `describedby` Link header. Per D58 (sharpened by D71), a `MarkdownProjectionListener` (analogous to the `MementoCommitListener` shipped in Rung 1.1) projects body wikilinks into `.meta` triples on write
- **Layer C** — Navigation indexes: Type Index (machines), Storage Description (apps + agents + fabric), VAULT-INDEX.md (humans)

The architecture is documented across 74 [decisions](.claude/rules/decisions-index.md) covering server choice, content discipline, the unified-pod pivot, externalization substrate framing, Memento integration, and the L1/L2/L3 memory substrate stratification.

---

## Quick start

```bash
# Bring up the stack
docker compose up -d
docker compose logs -f                          # tail logs

# Verify the pod is alive
curl http://localhost:3000/                      # CSS root
curl http://localhost:8080/sparql -d 'query=SELECT * WHERE { ?s ?p ?o } LIMIT 5'

# Import vault content (1243 notes; vault is one L4 application of wiki-memory L3)
~/uvws/.venv/bin/python scripts/vault_import.py

# Run the test suite
~/uvws/.venv/bin/python -m pytest tests/ -v

# Reproducible reset (CSS seed + pod templates + init service)
make reset
```

A successful import gives you a pod at `http://localhost:3000/` with PARA containers, a Type Index, a Storage Description with VoID + DCAT, an Obsidian-flavored vault ontology, and SHACL shapes. The pod is then agent-navigable from `/.well-known/solid` via standard Solid discovery — no pod-specific knowledge required.

---

## Why this design

### Memory operates at three scales

> Note: these are *deployment scales* (where memory lives along the in-agent → cross-agent axis). They are orthogonal to the L1/L2/L3 substrate stratification above (which is the architectural layering inside one Pod). The scales tell you what kind of system you're building; the layers tell you which contract surface you're touching.

Memory is not one thing. Three scales matter, and each escapes the same theoretical ceiling differently:

1. **In-agent (Scale 1)** — what fits inside one agent's working state. ByteRover hits 96.1% on LoCoMo with markdown bodies + BM25 + tiered retrieval + a 5-tier progressive cascade. Zero vector infrastructure required.
2. **Typed cross-hierarchy (Scale 2)** — typed edges as operation contracts within a knowledge graph. Each edge type tells the agent what to *do* on traversal: `extends:` inherits context; `supports:` aggregates evidence; `criticizes:` flags contradictions for resolution. Shape Trees' `st:references` is the machine-enforceable infrastructure-layer realization.
3. **Cross-agent infrastructure (Scale 3)** — the federable substrate: Shape Trees, signed RDF VCs with selective disclosure, OR-Set CRDT-convergent concurrent writes, ODRL policy enforcement with Koreografeye N3 rules.

All three escape Barman's no-escape theorem the same way: structured navigation with bounded branching replaces kernel-threshold similarity. The xMemory team's information-theoretic version is the Fano routing bound — keep per-step branching ≤12 and the asymptotic ceiling on flat retrieval disappears.

**The empty ground**: no existing system composes all three end-to-end. This repo is the prototype that occupies that ground.

### Document/graph duality is the architecture

Most existing systems pick a side. Vector stores commit to a graph and lose structure. File-based wikis (Karpathy, ByteRover, this vault) commit to documents and derive the graph after the fact. Knowledge graph systems commit to RDF and make documents opaque attachments. Each commits wrong for some slice of its workload.

Verborgh's 2022 reassessment: don't commit. The substrate is **hybrid contextualized KG** — blobs and RDF statements as co-equal first-class citizens, with the five document-box aspects (context, permissions, provenance, trust, performance) varying at their own natural granularities. Views materialize over the substrate as needed.

Both views are load-bearing:

- The **document view** preserves zero-parse readability, git-friendliness, and tiered-retrieval compatibility. ByteRover's 96.1% LoCoMo is with markdown, not despite it.
- The **graph view** preserves typed edges as operation contracts, cross-hierarchy traversal, and per-triple metadata. ByteRover explicitly lacks this; this is what every flat `@path` cross-reference can't express.

Neither alone is sufficient. The premature commitment to either side is the design failure that produces the interop problems Verborgh names.

### Layers and scales are orthogonal

The three scales answer *where memory lives*. A separate axis answers *what kind of memory*: **conversational** (session state, ephemeral), **intermediate Zettelkasten** (curated typed notes, persistent), **document corpus** (source material, immutable referent). Each layer can exist at every scale.

Karpathy's wiki pattern lives at the intermediate Zettelkasten layer — that is why it works. Source documents stay opaque referent material with bridge edges carrying structural pointers (page span, section IRI) for demand-driven granularity. KAG-style block atomization is unnecessary overhead: store coarse, retrieve fine when bridge edges point fine.

---

## Bridging symbolic and LLM-based agents

The 2001 Semantic Web paper imagined **symbolic agents** — software that traverses typed RDF, exchanges OWL ontologies, reasons via formal logic, and produces verifiable proofs. That vision stalled, and the obituary writers blamed RDF complexity. What actually stalled was the agent. Symbolic reasoners that could navigate RDF at scale didn't materialize; the maintenance burden Bush named in 1945 reasserted itself one architectural layer up.

**LLM agents are the agents that finally arrived** — but they reason differently. They are statistical, contextual, generative; they prefer prose to triples; they hallucinate vocabulary when ungrounded; they cannot natively run a SHACL validator or compose a federated SPARQL query without help. A pod stuffed with carefully-validated RDF doesn't automatically work for them. The gap between what symbolic agents were specified to consume and what LLM agents actually consume is the practical problem this project addresses.

### Where the gap is

| Symbolic-agent assumption | LLM-agent reality |
|---|---|
| Reads RDF natively | Reads markdown natively; RDF is a parse step |
| Composes SPARQL from intent | Hallucinates SPARQL without examples; needs templates |
| Resolves vocabulary via ontologies | Hallucinates vocabulary terms when ungrounded; needs explicit vocabulary manifest |
| Validates via SHACL before publishing | Generates plausible-but-invalid RDF; needs the pod to enforce shapes at the write boundary |
| Traverses typed links deterministically | Picks paths probabilistically; needs natural-language guidance attached to types |
| Treats documents as opaque attachments | Treats documents as the primary surface; `.meta` is the secondary view |

### How the architecture closes the gap

The pod doesn't ask LLM agents to become symbolic reasoners. It exposes the symbolic substrate intact for tools that want it (SPARQL endpoint, validated `.meta`, signed VCs) and supplies LLM-readable affordances on top. Nine mechanisms compose to close the gap:

1. **`sh:agentInstruction` on SHACL shapes ([D50](.claude/rules/decisions-index.md))** — SHACL 1.2 §8.3 carries natural-language guidance attached to the shape. When the LLM agent fetches the shape for a container, it gets the typing constraint *and* the prose instruction telling it what predicates to use, what they mean, and when. The shape is symbolic-agent-readable; the `sh:agentInstruction` is LLM-readable; same artifact.

2. **Affordance descriptors at storage description root ([D52](.claude/rules/decisions-index.md), [D53](.claude/rules/decisions-index.md))** — per-content-type descriptors tell the agent how to extract affordances from non-RDF bodies. Obsidian-flavored markdown gets one descriptor; PDF gets another; OpenAPI gets a third. The LLM agent reads wikilinks from markdown directly via the descriptor's extraction rules, without first parsing RDF.

3. **Body affordances first-class when descriptor-declared ([D58](.claude/rules/decisions-index.md))** — body wikilinks are equivalent navigation surfaces to `.meta` triples when a descriptor declares them. The LLM agent reads the markdown body; the symbolic agent reads `.meta`; both are legitimate first-class views.

4. **Vocabulary grounding via `void:vocabulary` ([D49](.claude/rules/decisions-index.md))** — the storage description declares every RDF vocabulary the pod uses, and each declared vocabulary is dereferenceable (canonical source or local TBox cache). The LLM can enumerate the term space rather than guessing from pretraining. This directly mitigates the hallucination failure mode that produced the project's own [vocabulary audit incident](.claude/rules/decisions-index.md) (Claude invented `void:shape`, `void:constructTemplate` — terms that don't exist; D49 is the upstream defense; D50 is the downstream backstop).

5. **HATEOAS-correct three-tier access ([D55](.claude/rules/decisions-index.md))** — Tier 1 brute-force lets any spec-compliant LLM navigate the pod via standard HTTP + Link headers, with no pod-specific knowledge required. Tier 2 harness gives descriptor-aware agents fewer-token trajectories. Tier 3 skills encode domain shortcuts for the fastest paths. Lower tiers always work as fallback; the symbolic baseline is preserved.

6. **PROV-O + signed VC leaves ([D20](.claude/rules/decisions-index.md), [D63](.claude/rules/decisions-index.md))** — every assertion carries provenance; high-value claims carry signed VCs with selective disclosure. LLM-generated content is marked as such (`prov:wasGeneratedBy <activity>` with the LLM as agent), so downstream consumers — human, symbolic, or another LLM — can decide whether to trust it. This is how an LLM-generated claim composes with a symbolically-verifiable one without contaminating the substrate.

7. **Dual-layer linking via `MarkdownProjectionListener` ([D71](.claude/rules/decisions-index.md), sharpening D58)** — the agent writes typed wikilinks in markdown (`[[Note]]{.concept}`, `[[Note]]{.extends}`); a server-side listener parses the body on write and PATCHes the equivalent RDF predicates into `.meta`. The agent never has to write Turtle. The data-layer view materializes from the token-layer view automatically. AKBP and agentmemory each have one layer; this substrate has both at single-request cost.

8. **Two-stage commit (working-memory + `mem:Crystallize`) ([D73](.claude/rules/decisions-index.md))** — the substrate provides a `/working-memory/` container with a permissive SHACL shape (body-only writes accepted) plus a `mem:Crystallize` operation that validates against the strict L3 profile shape and promotes to a durable container on success. Solves the wiki-memory ergonomics problem — agents can drop notes without ceremony — without weakening the SHACL guardrails at the durable boundary. Cribbed from [AKBP](https://github.com/rohitg00/akbp)'s `remember` → `crystallize`.

9. **Memory-substrate trigger vocabulary ([D74](.claude/rules/decisions-index.md))** — `mem:*` AS2 extension (`mem:ConsolidationSuggested`, `mem:BoundExceeded`, `mem:ContradictionDetected`, `mem:ReflectionDue`, `mem:OODQuerySignal`) delivered on the agent's LDN inbox (durable) and Solid Notifications Protocol channels (real-time). The substrate's MonitoringStore listener emits when SHACL rules flip; the agent dispatches by `rdf:type` to a skill family. This is the substrate-to-agent push channel that makes wake-sleep consolidation, contradiction detection, and curator behaviors possible without polling.

### The deeper move

The traditional "AI agents will need the Semantic Web" pitch assumed agents would *adapt to* the symbolic substrate. The actual move here is the inverse: the symbolic substrate **stays intact**, and the pod supplies LLM-readable affordances *on top* so LLM agents can consume it natively. Both branches of Bush's lineage — the typed associative indexing the Semantic Web built, and the LLM-as-trail-blazer Karpathy claimed — operate over the same pod, neither subordinated to the other. That coexistence is the practical experiment this project runs.

---

## What the prototype claims

A four-stage delivery would be the first system to compose the three scales end-to-end. Each stage is a measurable milestone aligned with a research round below.

### Five structural claims to demonstrate

1. **ByteRover-class memory on a Solid Pod**. Run a markdown Context Tree + 5-tier progressive retrieval against pod resources, with the Context Tree's directory structure mapped to LDP containers (or SAI Data Registrations once available) and each entry validated by a bound SHACL shape.

2. **Typed cross-hierarchy edges via `st:references` (or its precursor in frontmatter)**. The vault's `concept:` / `extends:` / `supports:` / `criticizes:` edge fields become `st:viaPredicate` values; the pod enforces edge validity at write time via SHACL guardrails.

3. **Signed RDF VC leaves with selective disclosure**. Each high-value entry is grounded in a signed VC so cross-pod consumers can verify claims via simple entailment plus ZKP, without trusting the serving pod. The disclosure-equals-simple-entailment property (Braun & Käfer 2025) makes selective disclosure consumable by standard SPARQL/SHACL tooling.

4. **OR-Set CRDT-convergent concurrent writes**. Multiple agents editing shared pod resources converge without manual conflict resolution. The xMemory split/merge active-consolidation pattern applied to distributed write paths, client-driven via HTTP ETag.

5. **Two-level policy split**: ODRL policies authored declaratively and materialized to ACP via Koreografeye N3 rules. Continuous enforcement via event-triggered re-evaluation. The LLM stays out of the policy hot path.

### Research questions

Empirical questions the rounds (below) are designed to answer:

- **RQ-Memory-1** — Does a SOLID-pod-backed agentic memory match ByteRover's 96.1% on LoCoMo while adding federation, typed structure, and signed leaves? If yes, the structural overhead does not sacrifice accuracy.
- **RQ-Memory-2** — Does typed-edge navigation over `st:references` (or frontmatter-edge equivalents) improve retrieval accuracy or token efficiency over flat semantic retrieval for cross-document queries? Round 3 measures this directly.
- **RQ-Federation-1** — Do cross-pod SPARQL federations work in our setup *at all*? Phase 1 validated single-pod SPARQL; federation is unvalidated. Round 4 builds on this.
- **RQ-Memento-1** — Does Comunica propagate `Accept-Datetime` correctly across federated sources, so cross-pod time-scoped queries return coherent results?
- **RQ-Affordance-1** — What is the right descriptor format for affordance harness? **Resolved 2026-05-15 per D70/D71**: hybrid by necessity. SHACL for the data model (substrate shapes + L3 profile shapes) plus a small operational RDF vocabulary for the verbs/hooks/triggers — SHACL can't say "prefetch goes here."
- **RQ-Substrate-1** — Can a single affordance descriptor format carry L2 (universal substrate contract) AND L3 (profile-specific overlay)? Or do we need a two-document handshake — base descriptor at storage description root, profile descriptors per container?
- **RQ-Substrate-2** — What is the minimum required predicate set in the L2 substrate shape? Bounded branching and lifecycle metadata are obvious; is OOD declaration substrate-level or profile-level?
- **RQ-Substrate-3** — Multi-profile coexistence on one Pod — do profile boundaries follow container hierarchy strictly, or can a single container belong to multiple profiles via Type Index multi-class?
- **RQ-Substrate-4** — Federation across Pods that conform to L2 but use different L3 profiles — what cross-profile vocabulary mapping is needed?
- **RQ-Eval-1/2/3** — Task suite design, sub-agent configuration, and GEPA convergence for evaluating across the three access tiers ([D55](.claude/rules/decisions-index.md)).

---

## Research rounds

Rounds turn capability milestones into measurable evidence. Each picks one architectural claim, builds the minimum to test it, runs the comparison, and either confirms or falsifies.

| Round | Claim | Status |
|---|---|---|
| **Round 1** — Wiki-Memory L3 + Memento + Affordance Descriptor | Pod-published affordance descriptors over a wiki-memory L3 reference profile, with RFC 7089 time-travel as substrate-level capability, reduce harness cost vs spec-only navigation | Rung 1.0 ✅ Vocabulary alignment; Rung 1.1 ✅ Read-only Memento (commit `f94228c`); Rung 1.2 ✅ Tombstone semantics (commit `741e9b8`); **Rung 1.4 next (reframed 2026-05-15)** — wiki-memory L3 reference + affordance descriptor publishing L2 substrate contract |
| Round 2 — Bridge edges with structural pointers | Demand-driven document granularity via `cito:hasPageRange` / `cito:hasSection` reduces tokens for grounded retrieval | Blocked on R1 |
| Round 3 — Typed edges as ground truth | SPARQL over frontmatter typed edges beats flat semantic retrieval for cross-document typed queries | Minimal new build |
| Round 4 — Multi-pod federation | Cross-pod federated queries return correct results within tractable latency | Blocked on R1–3 |

The pod supports three access tiers ([D55](.claude/rules/decisions-index.md)). Each tier is composable with the others; lower tiers stay functional even when higher ones are used.

- **Tier 1 — Brute-force** (spec only). Any spec-compliant LLM can navigate the pod via WebID → storage description → Type Index → containers → resources. Phase 1 validated this with zero-shot navigation tests.
- **Tier 2 — Harness** (descriptor-aware). The agent reads the pod's affordance descriptors, Type Index registrations, and SHACL shapes to optimize navigation. Fewer tokens, faster, still spec-compliant.
- **Tier 3 — Skills** (domain-specific). The `solid-agent-skills` CLI and Claude Code skills encode operational knowledge for the fastest trajectories.

The evaluation methodology compares agent performance across the three tiers using clean Claude Code sub-agent sessions + a metric harness + GEPA-based skill refinement ([D60](.claude/rules/decisions-index.md)).

---

## Honest gaps

Three things this architecture does not close. Naming them keeps the positioning honest — Verborgh's 2022 candor about what wasn't working is precedent worth following.

1. **Planning and goal management**. Zhou et al. 2026 explicitly flags planning as not yet a formal harness dimension. Memory + Skills + Protocols cover most of the design space, but the principled location for planning is open. SOLID has no native primitives here; this is not solved by construction.

2. **Trust model for cross-pod skill federation**. Pods can host skills; harnesses can read skills from multiple pods. Which pods do you trust to publish skills you will execute? ODRL plus VC-based delegation chains gesture at the answer but do not close it. This is a federation-trust problem the Verborgh group has flagged but not solved.

3. **Consolidation cadence for the working ↔ episodic boundary**. When does an agent's working state get promoted to pod-resident episodic memory? D73 (two-stage commit: working-memory + `mem:Crystallize`) gives the *mechanism* — agents drop into working-memory with permissive shape, crystallize to durable when ready. The principled *timing* answer remains open. ByteRover and Hermes use heuristics; D74's `mem:ReflectionDue` trigger lets the substrate suggest, but the substrate can't decide *for* the agent.

The whole project is about figuring out, in practice, how agentic applications can connect to pods. Naming what doesn't yet work keeps the practical question sharp.

---

## Repo layout

```
css/config/        CSS Components.js configuration (file backend, WAC, seed)
css/extensions/    TypeScript CSS component package (.well-known/ handlers)
comunica/          Comunica SPARQL sidecar config (link-traversal + traqula fix)
shapes/            SHACL shapes for pod content (concept-note, project-note, daily-note)
ontology/          PROF SolidPodProfile + cached ontology stubs (SKOS, DC, PROV-O)
scripts/           Python CLI tools (vault importer, SPARQL query, pod setup)
tests/             pytest conformance + integration tests
docs/plans/        Architecture design documents
.claude/           Agent rules, memory, decisions index
```

The `.claude/` directory is the agent-facing configuration. Humans should start with this README and the [decisions index](.claude/rules/decisions-index.md). Agents pick up the rest automatically.

---

## Sibling repos

All under `~/dev/git/LA3D/agents/`:

| Repo | Role |
|---|---|
| `cogitarelink-solid` (this repo) | Reference Solid Pod: CSS + Comunica + vault importer |
| [`solid-agent-skills`](https://github.com/LA3D/solid-agent-skills) | General-purpose Solid Pod CLI + Claude Code skills. Phase 2 complete: 11 commands, 5 skills, 53 tests, OpenProse navigator+judge agentic test 5/5 PASS. Application-independent — works with any conforming pod |
| `cogitarelink-fabric` | Graph-native fabric nodes (Oxigraph + FastAPI + Credo). Provides the eval harness pattern reused for the rounds above |
| `rlm` | Recursive Language Model agent substrate (dspy.RLM). Source of the `make_*_query_tool` closure pattern this pod exposes via Comunica |

---

## Architectural decisions

74 decisions (D1–D74) cover server choice (CSS v8 alpha), content discipline (SHACL shapes as guardrails), the unified-pod pivot (Pod backends as implementation detail), the externalization substrate framing, three-tier access architecture, the Memento integration design, and the L1/L2/L3 memory substrate stratification. See [`.claude/rules/decisions-index.md`](.claude/rules/decisions-index.md) for the index.

Phases of the decision log:

- D1–D28 — Foundation (CSS + Comunica + Python clients; **D5 vault-to-pod MVP** superseded by D70/D71)
- D29–D41 — CLI, structure, content discipline (PARA + memory partitions, `.meta` as source of truth, SKOS foundation; **D32 one-way import** reframed by D73)
- D42–D50 — Unified Pod architecture (storage backend as implementation detail; storage description as router; vocabulary grounding; shapes as guardrails)
- D51–D60 — Externalization substrate (pod as general-purpose substrate; affordance harness; three-tier access; evaluation methodology; **D58 body-affordance projection** sharpened by D71)
- D61–D64 — Memento integration (URI minting; ACP inheritance; standards-aligned vocabulary; soft-delete + hard-purge)
- D65–D69 — Rung 1.1/1.2 implementation + builder-skill layer + documentation strategy
- **D70–D74 — Memory substrate stratification** (L1/L2/L3; wiki-memory as canonical L3; compile-once principle; two-stage commit; memory-substrate trigger vocabulary)

---

## Citation

If this work is useful to your research:

```bibtex
@misc{vardeman2026cogitarelinksolid,
  author       = {Vardeman II, Charles F.},
  title        = {cogitarelink-solid: A reference Solid Pod as agentic memory substrate},
  year         = {2026},
  publisher    = {GitHub},
  howpublished = {\url{https://github.com/LA3D/cogitarelink-solid}}
}
```

A publication articulating the L1/L2/L3 memory substrate stratification, the convergence with three independent research traditions (memory-provider plugins, benchmark-tuned memory systems, wiki-memory implementations), the dual-layer linking architectural commitment, and the evaluation results follows the round work. Evidence first, paper after.

---

## Author

**Charles F. Vardeman II** (Chuck)
Research Faculty, University of Notre Dame · Center for Research Computing → Scientific AI Center (SAI), July 2026
Lab: Laboratory for Assured AI Applications Development ([LA3D](https://github.com/LA3D))
ORCID: [0000-0003-4091-6059](https://orcid.org/0000-0003-4091-6059)
Notre Dame ROR: [00mkhxb43](https://ror.org/00mkhxb43)
CI-Compass ROR: [001zwgm84](https://ror.org/001zwgm84)

---

## License

[MIT](LICENSE) — see LICENSE for full text.

---

## Further reading

External anchors that motivated the design:

**Wiki-memory tradition:**
- Karpathy, *LLM Wiki* — [gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f). The Memex-LLM synthesis pitch
- Ghumare, *LLM Wiki v2 Extending Karpathy* — [gist](https://gist.github.com/rohitg00/2067ab416f7bbe447c1977edaaa681e2). Typed edges, lifecycle hooks, supersession links
- *AKBP — Agent Knowledge Base Protocol* — [github](https://github.com/rohitg00/akbp). *"The durable knowledge contract below your tools"*; two-stage commit (`remember` → `crystallize`); same architecture, JSONL transport
- *agentmemory — Persistent Memory for Coding Agents* — [github](https://github.com/rohitg00/agentmemory). 12 PostToolUse hooks for auto-capture; 51 MCP tools; LongMemEval 95.2% R@5

**Memory-provider tradition:**
- Hermes Agent docs — [hermes-agent.nousresearch.com](https://hermes-agent.nousresearch.com/docs/). `MemoryProvider` ABC with six operational hooks
- Supermemory — [supermemory.ai](https://supermemory.ai/). Ontology-aware vector graph engine; 100B+ tokens/month

**Benchmark-tuned memory systems:**
- Nguyen et al., *ByteRover* (arXiv 2604.01599, 2026). 96.1% on LoCoMo with markdown
- Hu et al., *xMemory: Beyond RAG with Bounded-Branching Hierarchical Memory* (ICML 2026)
- Hu, Wang, McAuley, *MemoryAgentBench* (2025). Four cognitive competencies
- He et al., *MemoryArena* (2026). 0D/1D/2D taxonomy and dependency depth

**Solid / web-standards lineage:**
- Verborgh, *Paradigm Shifts for the Decentralized Web* (2017) — [blog](https://ruben.verborgh.org/blog/2017/12/20/paradigm-shifts-for-the-decentralized-web/)
- Verborgh, *Designing a Linked Data Developer Experience* (2018) — [blog](https://ruben.verborgh.org/blog/2018/12/28/designing-a-linked-data-developer-experience/)
- Verborgh, *Shaping Linked Data Apps* (2019) — [blog](https://ruben.verborgh.org/blog/2019/06/17/shaping-linked-data-apps/)
- Verborgh, *Let's talk about pods* (2022) — [blog](https://ruben.verborgh.org/blog/2022/12/30/lets-talk-about-pods/). The hybrid contextualized KG framing
- Dedecker, Slabbinck, Wright, Hochstenbach, Colpaert, Verborgh — *What's in a Pod?* (QuWeDa 2022)

**Theoretical grounding:**
- Zhou et al., *Externalization for LLM Agents* (2026). The four externalizable substrates
- Barman et al., *The Price of Meaning* (2026). The no-escape theorem this architecture is designed to evade

Internal design documents (vault notes; not public):

- `Memory Substrate vs Memory Profile` — the L1/L2/L3 stratification with seven invariants and the evidence table
- `Wiki-Memory L3 Profile` — first-principles design of the canonical L3 reference, with dual-layer linking
- `Unified Externalization Prototype Plan` — active plan with the four rounds
- `SOLID-Pod-Decisions` — canonical log for D1–D74
- `Three-Scale Agent Memory Architecture` — the deployment-scales synthesis (orthogonal to L1/L2/L3)
- `Hybrid Contextualized KG as Agent Memory Substrate` — the architectural character
- `The Pod as Externalization Substrate` — the harness-as-consumer inversion
- `Solid Pods as Agent Memory Substrate` — pre-stratification exploration; superseded by `Memory Substrate vs Memory Profile`
- `Hierarchical Retrieval Escapes the No-Escape Theorem` — the structural thesis the prototype tests
- `Memento Vocabulary Alignment` — standards mapping for Round 1
