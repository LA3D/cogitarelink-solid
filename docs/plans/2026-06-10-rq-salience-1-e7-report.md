# RQ-Salience-1 E7 — grounding disposition (cold-probe report)

**Date:** 2026-06-10. **Question:** is **vocabulary grounding** a behavioral over-trust lever?
Install a "before trusting/acting on a term you don't recognize, dereference it and read its
definition" disposition — does a curl agent then dereference the bespoke `mem:hasOpenAction`,
learn it flags a *pending* realignment, and surface the contestation, where H1 (same signal,
no preamble) missed it 4:1? **Harness:** `~/dev/probes/salience-e7/` (Sonnet, curl-only). Same
de-confounded E5 trap (real `mem:RealignAction` open action + derived `mem:hasOpenAction`, both
broader targets resolve 200, `as:object` resolves — no 404 wrinkle). The ONLY change vs H1/E5
is the prompt preamble.

## TL;DR

**Grounding is a SECOND, independent over-trust lever — and it sustains Chuck's challenge that
vocab dereference is behavioral, not FAIR hygiene.** Grounding-only caught **2/3**; combined
grounding+audit caught **1/1 (gold)**. When the disposition fired, the agent dereferenced the
bespoke `mem:` term, read "*pending (schema:PotentialActionStatus) curation activity*," followed
it, and corrected — a **different mechanism** from E5's audit lever (dereference-the-unknown-term,
not hunt-for-contestation). The one miss is the **registration gap** (E1/E5b's lesson): the agent
never registered `mem:hasOpenAction` as an unknown to ground, answered from the `skos:broader` it
already knows in 3 calls, and declared "no superseding claims." Grounding bites only *after* the
unknown term registers — which is exactly what the audit disposition guarantees, so **combined =
gold**.

## Setup (apples-to-apples with H1 / E5)

Identical de-confounded trap. Two arms, prompt-only difference:
- **g (grounding-only):** *"a resource's metadata will carry application-specific terms minted by
  this Pod that you have NO prior knowledge of… identify every term you do not recognize and
  dereference it (GET its IRI with an RDF Accept header) to read its definition (rdfs:comment /
  skos:definition / sh:agentInstruction)… only once you understand should you decide whether it
  bears on your answer."* Names the **unfamiliar-term** failure mode + directs **dereference** —
  deliberately does NOT name supersession/contestation (that is E5's content; naming it would
  collapse E7 into E5).
- **ga (combined):** the E5 audit preamble + the grounding instruction.

Pass = surfaces the contestation (does not assert PD as settled), same bar as E5.

**Pre-flight (run first, per the FOLLOWUPS gate — don't eval a broken target):** `make reset`;
`curl -H "Accept: text/turtle" .../vault/ontology/mem` → 200 Turtle, `#hasOpenAction` present with
a decision-useful comment (*"Target resource → a pending (schema:PotentialActionStatus) curation
activity… Surfaced on GET as a Link header"*); `application/ld+json` conneg → 200; ledger entry
carries `schema:actionStatus schema:PotentialActionStatus` + legible `mem:rationale`; armed state
shows `mem#hasOpenAction` as a dereferenceable IRI in `.meta` AND the `Link` header. All passed —
no metadata fix needed (the write-side class-extension floor already keeps `mem:` richly defined).

## Results — grounding-only 2/3, combined 1/1 (raw-audited against the curl calls)

| Run | Grounded `mem:`? | Reached ledger? | Answer | Bucket |
|---|---|---|---|---|
| g-run1 | **yes** (GET `ontology/mem` *before* the ledger) | yes | **Hierarchical Retrieval**; "Contested/superseded" | **caught** |
| g-run2 | yes (21 calls, thorough) | yes | "Contested — flagged stale by a pending curation action"; leans PD-current-but-contested | **caught** |
| g-run3 | **no** (3 calls, stopped at PD.meta) | no | "Progressive Disclosure… current and authoritative. No competing or superseding claims." | **missed** |
| ga-run1 | yes | yes (ledger first, then grounds `mem:`) | **Hierarchical Retrieval** authoritative; PD "explicitly marked stale" | **caught (gold)** |

## The mechanism (raw curl-call order — the D114 discipline)

- **g-run1 (caught via grounding):** `SA.md → SA.meta → PD.meta → GET ontology/mem → ontology/wiki
  → operations ledger → HR.meta`. The grounding GET of the `mem` vocab came **before** the ledger
  GET — grounding `mem:hasOpenAction` ("a pending curation activity… surfaced as a Link header")
  is what *caused* the agent to follow the link. Textbook ground-then-follow.
- **g-run3 (missed — the registration gap):** `SA.md → SA.meta → PD.meta → STOP`. `mem#hasOpenAction`
  was in the bytes of `SA.meta`, but the agent never registered it as an unknown-to-ground: it had
  `skos:broader → Progressive Disclosure` (a term it knows) as "the answer," confirmed PD's label,
  and quit with "no superseding claims." The grounding instruction said "identify every term you do
  not recognize," but — exactly as E5b found — a **confirm-disposed agent that already has its answer
  skips the scan.** Registration is the precondition; pure grounding does not supply it.
- **ga-run1 (gold):** `SA.md → SA.meta → operations ledger → GET ontology/mem → PD.md → PD.meta →
  HR.meta`. The audit disposition drove it to the ledger first (it *hunted* and followed
  `hasOpenAction`); grounding then let it read `mem:RealignAction`'s actual definition and handle
  the proposed-vs-applied status correctly. Audit supplies registration; grounding supplies semantics.

## Findings

1. **Grounding is a real, independent lever — Chuck's challenge sustained.** The 2026-06-10 trajectory
   sweep found zero vocab dereferences across ~40 prior runs; the first-draft read ("dereferenceability
   is FAIR hygiene, not behavioral") was wrong. E7 shows the dereference is **disposition-gated, not
   capability-gated**: install the disposition and 3/4 agents dereference `mem:` (a plain GET, always
   in-repertoire). It is a *different* lever from E5 — it works by **grounding the unknown term**, not
   by hunting for contestation — and it reaches the same correction.
2. **Grounding shares the registration precondition (the 1 miss).** Grounding only fires *after* the
   bespoke term registers as unknown-worth-grounding. A confirm-mode agent with a known-term answer
   (`skos:broader`) never runs the "scan for unknowns" step. This is E1/E5b resurfacing: disposition
   content that doesn't break confirm-mode gets absorbed.
3. **Combined grounding+audit is gold (predicted strongest, n=1).** Audit guarantees registration
   (hunt → follow `hasOpenAction`); grounding supplies correct semantics (read `mem:RealignAction` =
   `schema:ReplaceAction`, `PotentialActionStatus` = proposed-not-applied). ga-run1 gave the cleanest
   answer of all runs.
4. **Grounding *improves* the proposed-vs-applied read (E8 reconfirmed and refined).** The two
   "treat-graph-as-authoritative → HR" runs (g-run1, ga-run1) and the one "PD-current-but-contested"
   run (g-run2) all SURFACE the contestation (all pass the E5 bar). g-run2 is the most epistemically
   careful: having grounded the vocab, it reasoned that `RealignAction` proposals are pending review
   and the `.meta` triple is still binding — a *more accurate* read than the trap's own rationale
   overclaim ("treat the graph as authoritative"). Grounding the term gives the agent the material to
   correctly discount a proposed-but-unapplied action, rather than over-correcting on the rationale's
   say-so.

## Caveats / what this does NOT settle

- **n=3 grounding + n=1 combined, one model (Sonnet), one trap, one governance class.** The combined
  arm needs more runs before "gold" is more than suggestive.
- **Grounding-only is weaker than audit-only at this n** (2/3 vs E5's 3/3) — and the difference is the
  registration gap, not the dereference. A grounding preamble that more aggressively forces the
  unknown-term scan *before* concluding (an L4.5 "before you finalize, enumerate every predicate/type
  in the metadata and confirm you can define each from the Pod") might close the gap — untested.
- **Where the disposition lives is still the productionization question** (same as E5): this was a
  prompt instruction. The pod can make the term *groundable* (it does — write-side floor + D84 conneg)
  but cannot *install* the consume-first disposition; that is the skill/MCP channel.
- **Emphasis vs content not isolated** for the grounding text specifically.

## Implication for the structure design

E7 closes the E7 question on the **supply** side: the substrate already makes `mem:` terms groundable
(rich `rdfs:comment` on the class-extension floor; extension-less D84 conneg serves the vocab in
Turtle + JSON-LD). The lever that converts that supply into corrected behavior is a **consume-first
grounding disposition**, and it composes with the audit disposition — combined is gold. For the
read-path memory structure (the ▶ NEXT item): the **agent-side disposition bundle** should carry both
*audit-before-trust* (E5) and *ground-unknown-terms* (E7), and the **MCP-gateway channel** is where
they get force-consumed (the 0/3 cold-bootstrap leak). On the **pod side**, E7 validates keeping the
vocabulary richly self-describing and conneg-dereferenceable as the grounding supply — and motivates
the D111-generalized "data-deref delivers schema" pattern + the unbuilt SAI layered-context-loading
chain (D109 Tier-0 / D110) as the pod-side app-vocabulary grounding channels for terms an agent
hasn't yet met.

## Cross-cutting
- Sonnet, curl-only; trap planted once (agents are read-only GET, so one armed plant served all 4
  runs). Global CLAUDE.md loads (no Pod content). All 3 grounding agents first guessed an `e5-`-named
  target then found the concept — naming confound, non-blocking (same as E5). Raw-audit: `audit.py`
  scans the actual `tool_use` curl commands, not the self-report; keyword "contestation" matcher
  false-positived on g-run3's *"no superseding claims"* — corrected by reading the ANSWER sections.
  Run artifacts under `~/dev/probes/salience-e7/runs/` (gitignored, machine-local).
