# cogitarelink-solid

A reference Solid Pod implementation exploring how agentic applications can connect to a federable, standards-based memory substrate.

> Research prototype, not a production Pod hosting service. Phase 1 complete: 107 vault notes imported, agent-navigable via the standard Solid discovery stack. Active work: [Round 1 Memento spike](#research-rounds).

---

## Why this exists

Three threads converge here.

**Karpathy's [LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)** named the pattern emerging across agentic systems: an LLM-maintained, persistent, interlinked markdown wiki where the LLM does the bookkeeping humans abandon. Humans curate, sources are immutable, the wiki accumulates. "The wiki is a persistent, compounding artifact." Obsidian is the IDE, the LLM is the programmer, the wiki is the codebase.

**Hermes Agent** (Nous Research, 2026) shipped the pattern as a product — a two-file persistent memory (MEMORY.md + USER.md) plus a swappable provider plugin layer with eight backends ranging from flat markdown to knowledge graphs. The provider contract has six mechanisms (context injection, prefetch, sync, extract, mirror, provider tools) but the architecture is single-agent. There is no protocol for cross-agent change notification, role manifests, or recall provenance.

**Ruben Verborgh's Solid Apps arc** (2017–2022) is the architectural substrate the pattern needs to federate. Apps become views over personal data. Shapes are *connection points*, not endpoints — apps bind to shapes, not APIs. A pod is **not** a document hierarchy; it is a *hybrid contextualized knowledge graph* whose document boundaries silently conflate five orthogonal concerns (context, permissions, provenance, trust, performance) that deserve independent granularity.

This repo is the synthesis: Karpathy's LLM-maintained wiki pattern realized on Verborgh's hybrid contextualized KG substrate. The vault is the wiki layer; the Solid Pod is the federable substrate; agents (yours, a collaborator's, future ones) interact via shapes, follow-your-nose navigation, and verifiable-credential-gated access.

---

## What this repo is

### A reference Pod, not a memory provider

The pod is the externalization *substrate*, not the memory backend itself. Zhou et al. 2026 frames LLM agents as composing four externalizable substrates — Memory, Skills, Protocols, Harness. Most current systems put the harness at the center and let it orchestrate the others. This project inverts that: **the pod sits at the center as the unification layer**, and the harness becomes a consumer that reads the pod's affordance descriptors and routes accordingly. The six bidirectional couplings Zhou names (memory↔skills, skills↔protocols, etc.) collapse into one operation on a SOLID substrate: typed CRUD + LDN notification + PROV-O lineage + SHACL validation. Zhou's explicit open gaps — §8.4 governance and §8.5 shared infrastructure — are filled by SOLID by construction.

### The vault is already a proto-pod

The Obsidian vault that drives this work already demonstrates the core pattern. What a Solid Pod adds:

| What the vault has | What the Pod adds |
|---|---|
| PARA structure (semantic organization) | Web-native HTTP access |
| Wikilink graph (navigable network) | Formal access control (WAC/ACP) |
| Frontmatter metadata (typed edges) | Stable URIs (dereferenceable IRIs) |
| Git version history | Multi-agent authentication (WebID, Solid-OIDC) |
| Skills system (procedural memory) | Cross-pod change notifications (Solid Notifications) |
| Local Claude Code access | PROV-O lineage and VC-gated delegation |

The Pod is the federable evolution of the vault. Vault content is the first hosted application; other applications (to-do lists, calendars, project workspaces) compose as additional views over the same substrate.

### What this repo is *not*

- **Not a CLI** — that's [`solid-agent-skills`](https://github.com/LA3D/solid-agent-skills) (sibling repo): 11 commands + 5 Claude Code skills + 53 tests
- **Not a fabric of graph-native nodes** — that's `cogitarelink-fabric` (sibling repo): Oxigraph + FastAPI + Credo
- **Not a memory provider** — providers (Hermes-style) target the pod via standard LDP + SPARQL + Solid Notifications
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

Three-layer Pod RDF model:

- **Layer A** — LDP container hierarchy, generated automatically by CSS
- **Layer B** — `.meta` sidecars carry per-resource RDF, validated by SHACL, addressable via the `describedby` Link header
- **Layer C** — Navigation indexes: Type Index (machines), Storage Description (apps + agents + fabric), VAULT-INDEX.md (humans)

The architecture is documented across 64 [decisions](.claude/rules/decisions-index.md) covering server choice, content discipline, the unified-pod pivot, externalization substrate framing, and Memento integration.

---

## Quick start

```bash
# Bring up the stack
docker compose up -d
docker compose logs -f                          # tail logs

# Verify the pod is alive
curl http://localhost:3000/                      # CSS root
curl http://localhost:8080/sparql -d 'query=SELECT * WHERE { ?s ?p ?o } LIMIT 5'

# Import vault content (107 notes)
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
- **RQ-Affordance-1** — What is the right descriptor format for affordance harness — declarative SHACL with `sh:rule` extensions, custom RDF vocabulary, embedded executable code, or hybrid? Round 1 Rung 1.4 forces resolution.
- **RQ-Eval-1/2/3** — Task suite design, sub-agent configuration, and GEPA convergence for evaluating across the three access tiers ([D55](.claude/rules/decisions-index.md)).

---

## Research rounds

Rounds turn capability milestones into measurable evidence. Each picks one architectural claim, builds the minimum to test it, runs the comparison, and either confirms or falsifies.

| Round | Claim | Status |
|---|---|---|
| **Round 1** — Memento + Affordance Descriptor + Pod-Native Harness Skill | Pod-published affordance descriptors plus RFC 7089 time-travel reduce harness cost vs spec-only navigation | Rung 1.0 ✅ Vocabulary alignment; Rung 1.1 next (read-only Memento spike) |
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

3. **Consolidation cadence for the working ↔ episodic boundary**. When does an agent's working state get promoted to pod-resident episodic memory? Wake-sleep timing is unsolved at the principled level. ByteRover and Hermes use heuristics; the principled answer is genuinely open.

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

64 decisions (D1–D64) cover server choice (CSS v8 alpha), content discipline (SHACL shapes as guardrails), the unified-pod pivot (Pod backends as implementation detail), the externalization substrate framing, three-tier access architecture, and the Memento integration design. See [`.claude/rules/decisions-index.md`](.claude/rules/decisions-index.md) for the index.

Phases of the decision log:

- D1–D28 — Foundation (CSS + Comunica + Python clients; vault-to-pod MVP)
- D29–D41 — CLI, structure, content discipline (PARA + memory partitions, `.meta` as source of truth, SKOS foundation)
- D42–D50 — Unified Pod architecture (storage backend as implementation detail; storage description as router; vocabulary grounding; shapes as guardrails)
- D51–D60 — Externalization substrate (pod as general-purpose substrate; affordance harness; three-tier access; evaluation methodology)
- D61–D64 — Memento integration (URI minting; ACP inheritance; standards-aligned vocabulary; soft-delete + hard-purge)

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

A publication articulating the three-scale architecture and the evaluation results follows the round work. Evidence first, paper after.

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

- Karpathy, *LLM Wiki* — [gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- Verborgh, *Paradigm Shifts for the Decentralized Web* (2017) — [blog](https://ruben.verborgh.org/blog/2017/12/20/paradigm-shifts-for-the-decentralized-web/)
- Verborgh, *Designing a Linked Data Developer Experience* (2018) — [blog](https://ruben.verborgh.org/blog/2018/12/28/designing-a-linked-data-developer-experience/)
- Verborgh, *Shaping Linked Data Apps* (2019) — [blog](https://ruben.verborgh.org/blog/2019/06/17/shaping-linked-data-apps/)
- Verborgh, *Let's talk about pods* (2022) — [blog](https://ruben.verborgh.org/blog/2022/12/30/lets-talk-about-pods/)
- Dedecker, Slabbinck, Wright, Hochstenbach, Colpaert, Verborgh — *What's in a Pod?* (QuWeDa 2022)
- Hermes Agent docs — [hermes-agent.nousresearch.com](https://hermes-agent.nousresearch.com/docs/)
- Zhou et al., *Externalization for LLM Agents* (2026)
- Nguyen et al., *ByteRover* (arXiv 2604.01599, 2026)
- Hu et al., *xMemory: Beyond RAG with Bounded-Branching Hierarchical Memory* (ICML 2026)
- Barman et al., *The Price of Meaning* (2026) — the no-escape theorem this architecture is designed to evade

Internal design documents (vault notes; not public):

- `Unified Externalization Prototype Plan` — active plan with the four rounds
- `SOLID-Pod-Decisions` — canonical log for D1–D64
- `Three-Scale Agent Memory Architecture` — the synthesis these rounds test
- `Hybrid Contextualized KG as Agent Memory Substrate` — the architectural character
- `The Pod as Externalization Substrate` — the harness-as-consumer inversion
- `Solid Pods as Agent Memory Substrate` — vault-as-proto-pod framing
- `Hierarchical Retrieval Escapes the No-Escape Theorem` — the structural thesis the prototype tests
- `Memento Vocabulary Alignment` — standards mapping for Round 1
