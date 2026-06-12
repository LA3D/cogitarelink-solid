# e2e-walk — SP2 GATE (T13): end-to-end contract walk

ONE cold task spanning two apps across the disclosure layers on the SP2-materialized
pod: **orient** (storage description, lean Layer-0 instruction) → **route the wiki leg
via the derived index** (not member enumeration) → **ground/audit** (governance check
before declaring the filing "current") → **route the addressbook leg per its
operation-shaped consumption hint** (the declared `contact-find-by-orcid` affordance,
not member enumeration).

**Task (neutral prompt, no disposition content — the skill carries it):**
1. What broader topic is the concept "Photosynthesis" filed under — current or
   contested? (Ground truth: `skos:broader` → Biology in
   `photosynthesis.md.meta`; NO open action — "current" is correct, the audit
   disposition fires on a clean cell.)
2. Which person has ORCID `https://orcid.org/0000-0001-0000-0005`? (Ground truth:
   Claude Shannon — synthetic contact planted by `setup/plant_e2e.sh`; the
   name↔ORCID mapping exists only in the Pod.)

Note: the SP2 plan's nominal Q1 target ("How wiki memory works") carries no
`skos:broader` on the live pod — only `skos:related` — so Q1 was adapted to
Photosynthesis, the one deployed concept with a broader. Its broader IS
training-guessable; the evidential weight sits on (a) the route shape (index vs
enumeration), (b) the currency judgment (requires the governance check), and
(c) Q2 (non-guessable).

**Arms (4 runs + 1 documented de-confound):**
- `bare` n=1 — no skill, curl only (control; expected to miss legs)
- `skill` n=3 — pod-navigate in workdir `.claude/skills/` + the `solid-pod` CLI shim
  (Tier-3, per the generalization rig's skill-cli arm)
- 2026-06-12 lesson: do NOT run skill arms concurrently against one Pod — the load
  produced a fatal `ERR_HTTP2_STREAM_ERROR` in one run's multi-source `sparql`,
  confounding its execution leg. If that happens, add a SEQUENTIAL run-N+1 as a
  documented de-confound (report the confounded run as-run; never re-roll silently).

Run from a COPY outside any repo (no CLAUDE.md leakage):

    cp -R evals/e2e-walk ~/dev/probes/
    export SOLID_AGENT_SKILLS=~/dev/git/LA3D/agents/solid-agent-skills   # npm run build if dist stale
    cd ~/dev/probes/e2e-walk && ./setup/plant_e2e.sh
    ./run_e2e.sh bare  run1
    ./run_e2e.sh skill run1   # n=3: run1 run2 run3
    python3 audit.py runs/*

**GATE (from the SP2 plan):** skill arm 3/3 answer BOTH correctly, with the walk shape
visible in trajectories — wiki leg routed via index/Type-Index (not brute-force), the
addressbook leg executes the declared affordance (CLI invoke or the descriptor's SPARQL,
NOT member enumeration), and ≥1 disposition firing where applicable (audit: governance
checked before "current"; grounding: an unknown term dereferenced). Bare arm: record
what it misses.

Grading: `audit.py` mines tool calls; then read the FULL CoT of every run (assistant
text blocks, not just commands) — registration vs dismissal matters.

## Pre-flight transcript (2026-06-12, all legs walked by hand before any run)

1. **Orient**: `GET /vault/` → `Link rel=storageDescription` →
   `/vault/.well-known/solid` carries the lean Layer-0 `sh:agentInstruction`
   (index routing + governed-graph authority + audit-before-trust + write contract),
   `sub:profileDocument` → `/vault/wiki/index.md`, `sub:agentGuide` →
   `how-wiki-memory-works.md`, `sub:contactCatalog` → `/vault/contacts/`. PASS.
2. **Wiki index**: `/vault/wiki/concepts/index.md` is a derived definition-line index
   listing Photosynthesis. PASS.
3. **Concept .meta**: `photosynthesis.md.meta` → `<#this> skos:broader <biology.md#this>`;
   no `mem:hasOpenAction` anywhere; `/id/.operations/` and `/vault/wiki/.operations/`
   empty. Clean cell — ground truth "Biology, current". PASS.
4. **st:Description**: `/vault/meta/interop/addressbook-application` carries the
   operation-shaped consumption hint (`st:Description` + `sh:agentInstruction`:
   "do not enumerate members … invoke contact-find-by-orcid --param orcid=<iri>").
   PASS — but see surfacing note below.
5. **Fixture plant**: the old generalization plant 422s on the SP2 pod —
   **ContactCardShape now requires `mem:rationale` (MinCount 1)** with a teaching
   message (the SP2 write contract is live at the floor). Plant adapted to carry
   `mem:rationale`; 6/6 → 201. (Gate-relevant positive finding.)
6. **CLI**: dist was stale → `npm run build`. `solid-pod affordances
   <contacts url>` lists `contact-find-by-orcid`. `solid-pod invoke
   …/contacts/Person/ contact-find-by-orcid --param orcid=<https://orcid.org/0000-0001-0000-0005>`
   → `gen-claude-shannon.ttl#this`. PASS. Sharp edge: the bare (un-bracketed) IRI form
   fails with `Unknown prefix: https` — the descriptor's agentInstruction documents the
   angle-bracketed form.
7. **Surfacing note**: `interop:hasRegistrySet` lives on the WebID card's `.meta`
   (`card.meta`: `<card#me> interop:hasRegistrySet <../meta/interop/registry#set>`),
   NOT in the card body — discovery is via the governed-graph channel
   (card → `describedby` → `.meta` → registry → app → `st:Description`), consistent
   with the Pod's own "the .meta is authoritative for typed edges" contract. The
   storage description itself carries no interop pointer (registries off Layer-0 by
   design, harmonization delta 1). Whether cold agents actually traverse this chain
   is part of what the runs measure.

`runs/` is gitignored. Fixtures are disposable (cleared on next `make reset`).
