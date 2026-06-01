# Follow-ups

Things to come back to. Open items only; closed items move to commit history and decisions-index.

## ★ ACTIVE PRIORITY — D108: SKOS backbone + dual-view enforcement (decided 2026-05-30; gates RQ-View-2)

**Decision recorded** (`### D108` in decisions.md; full record `docs/superpowers/specs/2026-05-30-skos-backbone-dual-view-enforcement-decision.md`). Pulling the `skos:prefLabel`-not-enforced thread (RQ-View-2 Probe-A repeats, 2026-05-29) unravelled a **proven root cause: the entire wiki-memory L3 content corpus is unvalidated at write time** (no `/vault/wiki/` container declares `ldp:constrainedBy`; the upstream validator validates the markdown *body* not the projected `.meta`; `.meta` is auxiliary-exempt; projection is post-commit). Controlled write of a `prefLabel`-less concept → `201`. D104 "self-validating substrate" held only for the RDF-body substrates (contacts/WebID).

**What was decided** (see D108): SKOS is the real conceptual backbone (concepts = scheme, notes attach); three label frames (`<>`→`dct:title`, `<#this>` Thing→`schema:name`, `<#this>` Concept→`skos:prefLabel`); `prefLabel` **enforced + materialized** (today materialized nowhere → SKOS label queries empty corpus-wide); **derive the inferable** (`rdfs:label` apex + `schema:name`) but **reserve the 422 for judgment metadata** (`prefLabel` agent-authored via template — NOT silently derived; `dct:identifier` on Source); **container=gate / class=dispatch** enforcement with **in-band synchronous projection** as the load-bearing fix; **two enforcement audiences** — runtime agent (SHACL+422+`sh:agentInstruction`) AND dev agent (tests/CI encoding the frame model, failing with meaningful messages when the substrate is rewritten without understanding).

**Two-front program:**
- **Front 1 — agentic harness: ✅ COMPLETE (2026-06-01, branch `d108-front1-conceptual-model`, 13 commits, live-verified, audit 0/0).** Built: `sub:` frame-spine vocab (`frameRole`/`governsSubject`/`labelProperty`) + Page/Thing/Concept shape annotations; hand-authored gold exemplars (photosynthesis + biology broader-target + marie-curie thing); canonical narrative `how-wiki-memory-works.md` + read-only worked example; narrative↔spine drift-guard agreement test (the dev-agent guardrail, adversarially verified to fire both directions); overlay `installsPage` wiring + `sub:agentGuide` repoint; entry-point literal `sh:agentInstruction` served at `.well-known/solid` (**Phase B — config-only, NOT a custom TS extension**: verified live that `StaticStorageDescriber` emits a literal for an N-Triples-quoted value, so the recorded "IRIs-only" belief was false; orig Tasks 10-11 dropped). New test file `tests/test_frame_model_agreement.py` (16 passing). Plan: `docs/superpowers/plans/2026-05-30-front1-conceptual-model-artifact.md`.
- **Front 2 — substrate guardrails + dual-graph structure (NOT STARTED; now gated by the grammar fix below):** in-band projection (RQ-Enforce-1); container=gate/class=dispatch; `constrainedBy` on durable wiki containers, `working/` permissive (D73); uniform `rdfs:label` + frame labels materialized; `prefLabel` enforced; dev-side tests encoding the frame model + agreement contracts.

### ⚠ NEW (2026-06-01) — RQ-View-2 RAN + surfaced an authoring-grammar expressivity bug (RQ-Grammar-1)

**RQ-View-2 result (n=2 cold probes, 2026-06-01, against the Front-1-complete live Pod):** the
`wiki`→MediaWiki **misread is killed** (the D107/Front-1 comprehension goal — achieved; one agent
cited the Phase-B entry-point literal as where it learned the SKOS model). BUT both probes scored
**3/5 (DOWN from the n=3 baseline 4/5)** — and the drop is *diagnostic, not regression*: a more
legible substrate let the agents **see** a defect the baseline agents never noticed. Both
independently (n=2 consistent): discovered `skos:prefLabel` is required, found NO inline mechanism
to supply it, and were **forced to PATCH `.meta` directly — violating the substrate's own no-PATCH
rule.** Also hit: `type: Source`/`Organization` short-forms mis-projecting; `{.affiliation}` on a
Concept "felt semantically questionable"; the documented 422 correction contract doesn't fire.
(Probe concepts were cleaned up post-run.)

**Root cause = RQ-Grammar-1 (authoring-grammar expressivity bug, upstream of D108 Front-2 enforcement):**
Traced via the typed-wikilink provenance work (Sparna *Semantic Markdown Spec*,
<https://hackmd.io/@sparna/semantic-markdown-draft>; doc `docs/decisions/typed-wikilink-syntax-provenance.md`).
RDFa (which Sparna targets) is RDF-complete on **three axes**: `typeof`→`rdf:type`, `property`→predicate-with-**literal**,
`rel`/`resource`→predicate-with-**resource**. **Our inline `[[X]]{.class}` grammar collapsed to ONE
axis: a single predicate, resource-object only** (object-property edges between resources). The
type axis is handled (poorly) only by the frontmatter `type:` key; the **literal-property axis does
not exist inline at all** — so `skos:prefLabel`/`skos:altLabel`/`skos:definition` (literals on
`<#this>`) are **unexpressible** by any wikilink, and the frontmatter allowlist
(`type`/`created`/`modified`/`maturity`/`aliases`/`identifier`/`citekey`) doesn't project them
either. Net: **{link-grammar ∪ frontmatter-allowlist} does NOT cover what the shapes require**, so a
cold agent *cannot author a conformant concept inline* even with a perfect 422 gate. This is an
**expressivity gap upstream of the enforcement gap** — "derive prefLabel for them" would paper over
a missing grammar axis rather than restore it. NB: this is *accreted*, not one agent's regression —
D36 was born edge-only ("typed wikilinks → predicates"); the type/literal axes were never built
inline; frontmatter was a partial stopgap that never grew to cover the shapes.

**Framing locked for the brainstorm (do NOT re-litigate in passing):**
1. The markdown authoring grammar must be expressive enough to **round-trip the full governed graph**
   the shapes require (type + literal-properties + resource-edges) into `.meta`.
2. **RDFa-in-HTML rendering is OUT OF SCOPE / a red herring.** RDFa matters here ONLY as *proof* that
   an annotation-on-markup model can be RDF-complete (it round-trips losslessly to Turtle). D75
   ("no RDFa in served HTML; humans get CSS classes") was right *about HTML display* but got tangled
   with "the authoring grammar only needs links" (wrong). The invariant is the markdown→`.meta`
   projection round-trip — which never went through RDFa anyway.

**The fork to brainstorm (Chuck leans A or C, undecided — needs the brainstorm's framing to choose):**
- **(A)** Enrich the inline grammar toward Sparna/RDFa completeness — add a literal-property axis and
  a type axis (a span/attribute form for literals, distinct from the wikilink edge form).
- **(B)** Keep wikilinks edge-only; make frontmatter the literal/type surface but *complete* it
  (project `prefLabel`/`altLabel`/`definition`; fix `type:` short-forms). [Chuck's lean: NOT B alone.]
- **(C)** Hybrid, anchored on "grammar must round-trip the governed predicates."

**Sequencing (revised — this is the dev-process answer):**
`RQ-Grammar-1 brainstorm → spec → implement grammar fix → then D108 Front-2 enforcement → then
RQ-View-2 RE-EVAL.` Front-2's "supply the required metadata" contract is only *honest* once the
grammar can express it; and re-evaluating before both land would measure a substrate where
conformant authoring is still impossible. Recommended cadence: **finish/merge the Front-1 branch
first** (clean shippable checkpoint — Front 1 is complete + green), **then open the RQ-Grammar-1
brainstorm as its own focused session** (framing above is locked; A/C decided there, not now).

**RQ-Enforce-1 (open, D108 Front-2):** how to make projection in-band/synchronous without breaking
the post-commit MonitoringStore architecture (D58/D71). See decisions.md.

Subsumes/relocates the earlier "unrelated issues" list from the Probe-A analysis: `prefLabel` (→ now
RQ-Grammar-1: make it *expressible* inline, then enforce); `dct:identifier` on `<#this>` for
`wiki:Source` (→ same — a literal-on-`<#this>` the grammar can't carry); `type:` short-form
mis-projection (→ RQ-Grammar-1 type-axis); the POST-vs-`.md` projection footgun (→ Front-2 write
semantics); two-stage-commit discovery clarity (→ Front-1, shipped). The `{.affiliation}`-resolve-check
stays a skill-layer (resolve-before-assert) item.

**Provenance doc drift caveat:** `docs/decisions/typed-wikilink-syntax-provenance.md` (uncommitted)
documents the Sparna lineage + the D36 deviation. It currently still describes a render-path "RDFa
`property` CURIE" — that is STALE (D75 dropped RDFa from HTML; render path emits CSS classes via
`rehype-wikilink-classes.ts`). Also the hint→predicate map has drifted: `shared/markdown-parsing/src/predicates.ts`
(render path) still uses legacy `vault:` predicates; the canonical/current map is the served JSON-LD
context (`/vault/meta/context.jsonld`) + shape `sh:agentInstruction` (projection path) using `cito:`/`skos:`.
Reconcile the doc + the two maps as part of the RQ-Grammar-1 work.

## ⚠ RQ-Substrate-4 — vault-application contamination of the general substrate (raised 2026-05-26)

> **IMPLEMENTATION UPDATE 2026-05-28 — URI/namespace slice SHIPPED (D107), Phases 1–4 deployed, audit 0 ERROR.**
> The `sub:` re-layering is **merged to `main`** (2026-05-28, commit `02f9b58`; the `rq-listener-1-provenance` branch was fast-forward-merged and the local label deleted; NOT pushed — `origin/main` still at `8364cee`): Bucket-1 standard-predicate
> reuse (`wiki:typeIndex`→`solid:publicTypeIndex`), Bucket-2 35-term migration to `sub:` (`https://pod.vardeman.me/vault/ontology/substrate#`),
> `/wiki/` reframed as "the wiki-memory document view" in served self-description (agentGuide + synthesis + PROF
> descriptors), `/vault` storage-root parameterized (no source hardcode), PROF promoted to actionable out-of-band
> hint (`rel="profile"` + `sh:agentInstruction` on every descriptor). Round-trip-across-views test passes. The 4
> contamination couplings below are RESOLVED by D107's buckets. **STILL OPEN (do NOT mark RQ closed):** (a) the
> **cold-probe eval (RQ-View-2 / Probes A/B/C)** — the behavioral validation that the reframe actually kills the
> `wiki`→MediaWiki misread — is the teed-up next step (design in D107 §5 + decisions.md RQ-View-2; deterministic
> round-trip already green). (b) The deep contacts-conundrum fix (one entity, multiple writable views) = the
> deferred VIEW LAYER (D107 §6 / spec §4.3). **New pre-existing items surfaced during the migration (NOT
> migration-caused), see "Pre-existing test/build debt" at bottom.**
>
> **Status: OPEN research question, not a decision.** The eventual decision record is an *output* of
> this RQ (we don't yet know the target structure), so there is deliberately **no D-entry** in
> decisions.md yet. Tracked as **RQ-Substrate-4** in `.claude/memory/MEMORY.md` (loads every session)
> + auto-memory. **The 2026-05-26 self-description work (Tasks 11–13) is a MITIGATION, NOT THE FIX —
> do NOT mark this resolved until the substrate is actually re-layered.** Claude Code's bias toward
> solving the immediate problem means this WILL get re-papered unless deliberately resurfaced; that is
> the whole reason this is recorded redundantly.
>
> **Empirical evidence (cold-agent probe, 2026-05-26):** a clean HTTP-only agent, no repo/hints, given
> only the Pod URL + a realistic store-a-concept task, reached confidence **3.5/5**. Its **Confusion #1**
> (verbatim): the `wiki` URL segment "initially read to me as an application or tool name — 'this is a
> wiki tool, like MediaWiki' ... created a brief framing error I had to correct." It self-corrected via
> the existing self-description and never flagged `vault` itself. Every item on its own "what would make
> this 5/5" list was a **self-description** improvement, not a URI change — which is why mitigation is a
> reasonable *interim* but the URI bias is the real, deferred problem. (Other probe confusions #4/#5/#6/#8
> are two-hierarchy/projection comprehension gaps that the dogfood note + agentInstruction address; #3 is
> the concepts/sources container-merge asymmetry from D98.)


**Concern (Chuck):** The substrate was evolved *forward from the Obsidian vault* (PARA + SKOS + wiki
metadata) rather than *backward from fundamental Solid/LDP capabilities*. The Obsidian vault is just
**one** linked-data application that could sit on a Pod-as-substrate; we have conflated *wiki-application*
concerns (originally the vault's metadata structure) with what should be **general-purpose agentic
linked-data practices** independent of the app. The principled construction is: L1 LDP capabilities
(resources, containers, `.meta`, Type Index, storage description) → L2 memory-substrate invariants →
**dual knowledge-graph views** (document views *and* queryable graph views over the same objects — the
Verborgh/LDP read-write + query stance) → and only THEN application profiles like wiki-memory. We grew it
the other way, so vault/wiki concepts leaked downward. This is the project's own D70 L1/L2/L3 split not
being honored in practice ("wiki-memory L3 is *one* application" — CLAUDE.md — but it's coded as if it
were the substrate). See vault note `Memory Substrate vs Memory Profile`.

**Specific contaminations to unwind (not all introduced this session; several pre-existing):**
1. **`/vault` storage name is application-suggestive AND now hardcoded in the loaders.** The 2026-05-26
   showstopper fix hardcodes `${baseUrl}/vault` in both `loadRoutingMap` and the `TypeIndexLoader`
   instantiation (listener.ts). Principled fix: **derive the storage root from a standard Solid mechanism**
   (the storage description / `pim:Storage` / the resource's own container hierarchy), not a hardcoded
   `/vault` literal. The URI `/vault/wiki/concepts/X` also makes an LM agent "read too much into the URI"
   (vault → wiki → concept); a neutral storage root + profile sub-paths would carry less application bias.
2. **`wiki:routesToClass` + `/vault/meta/routing.jsonld` express a GENERAL routing mechanism in L3 `wiki:`
   clothing.** Predicate→class→container addressing is an L1/L2-general concept; it's minted in the `wiki:`
   namespace and deployed by the wiki-memory overlay. Candidate: promote to a substrate-level namespace.
3. **The "minimum opinionated agentic-memory kernel" (Option B, endorsed 2026-05-26) is wiki-flavored.**
   `DEFAULT_WIKI_TYPE_INDEX` + the bootstrap routing entailments were framed as "the minimum structure that
   makes any Pod usable as agentic memory" — but they encode the wiki-memory **L3 profile's** 8-container
   layout. A truly general kernel would be application-neutral (LDP + Type Index + metadata + dual views);
   the wiki layout should be ONE profile's defaults, not the substrate kernel.
4. **`.md` / markdown-wikilink coupling is L3-specific** (markdown-projection gates on `.md`). Fine *as an
   L3 profile extension*, but it should be understood as profile-level, not substrate-level.

**How worried about the 2026-05-26 Type Index fix specifically?** Low, for the fix itself — it moves
*toward* generality (it makes the listener read the **live, standard Solid Type Index** instead of always
using a hardcoded wiki layout; the live index is the application-neutral mechanism). It did NOT create the
contamination and only marginally deepened it via the `/vault` hardcode (item 1, easily refactored). The
kernel/merge is a *fallback* contained in the L3 markdown-projection extension. So: the **code** is sound
and refinable; the **framing** ("wiki kernel = agentic-memory kernel") is the thing to revisit. Not a
code-rot emergency; a deliberate re-layering exercise.

**Direction when picked up:** re-derive the L1/L2 substrate working backward from LDP + dual-view (document
+ queryable graph) first principles; demote wiki-memory to a clearly-bounded L3 profile; neutralize the
storage root; decide which minted terms (`routesToClass`, etc.) belong at substrate level vs profile level.
Precedent: D84 already did one namespace migration, so a storage-root migration is feasible but non-trivial.
This is decision-level work (likely a new D-number + possible supersession of the "kernel" framing).

### Resolution DONE 2026-05-28 → D107 (URI/namespace slice)

**The URI/namespace slice of RQ-Substrate-4 is now resolved as D107** (`docs/superpowers/specs/2026-05-28-rq-substrate-4-uri-relayering-decision.md`):
three-bucket partition (Bucket 1 aggressive standard-predicate reuse — delete `wiki:`
parallels like `wiki:typeIndex`→`solid:publicTypeIndex`; Bucket 2 mint `sub:` substrate
namespace, framed as proto-view vocabulary; Bucket 3 `wiki:` keeps only L3 content, `/wiki/`
re-framed as "the wiki-memory document view"); keep `/vault` (derive, don't hardcode);
PROF promoted to actionable out-of-band view-identity hint; validation = dual-view cold-probe
eval + round-trip-across-views (RQ-View-2). Grounded in Solid vocab-by-concern + Verborgh's
hybrid-graph/views model (the contamination *is* his contacts conundrum). **STILL OPEN:**
D107 does NOT close RQ-Substrate-4 — the deep contacts-conundrum fix (one entity, multiple
writable views) is the deferred view layer (spec §6 step 5). Implementation plan is the next
artifact (`docs/superpowers/plans/`). The four contamination couplings below are addressed by
D107's buckets; keep them here until the plan ships and `make reset`/`make audit` verify green.

### Brainstorm DONE 2026-05-27 → resolution next session

The structural-design brainstorm below was completed 2026-05-27. Output:
**`docs/superpowers/specs/2026-05-27-neurosymbolic-substrate-unification-design.md`** — a unified
neurosymbolic architecture that absorbs all three threads below plus the deeper findings (shared
multi-user substrate; SAI registration vocabulary over live Type-Index+SHACL; views as declarative
projections via conneg-by-profile; context-canonical write-back dissolving the lens problem; the
neuro/symbolic partition = D81 governed predicates; identity anchored in WebID/AddressBook with
mint-first + hard-key-unify; two-curator model; RQ-Identity-1). The key meta-finding: **we had
already solved bits and pieces of the consistency problem and lost track that we had** — the spec is a
unification + inventory (§5 built/partial/missing), not greenfield. **Next session = resolution**:
turn that spec into the re-layering plan + the RQ-Substrate-4 decision record (start at the spec's
§6 sequencing + §7 open questions). The three original threads (now folded into the spec):

This is NOT a code task — it is a **structural-design brainstorm** (use `superpowers:brainstorming`)
that should produce the re-layering design + the decision record RQ-Substrate-4 resolves to. Three
intertwined threads to think through together, plus fresh evidence:

1. **Linked-data URI structure.** The `/vault/wiki/` path is application-biased. *New evidence:* a
   second independent cold-agent probe (2026-05-27, see `docs/plans/2026-05-27-two-hierarchy-eval.md`)
   **again** misread `wiki` as a wiki *application* ("MediaWiki mounted at /wiki/"); the `wiki:`
   vocabulary prefix on storage-description properties compounded it. The self-description mitigation
   only helped by luck (the agent stumbled on the dogfood note; it never followed `wiki:agentGuide`
   nor read index.md). Conceptual framing must live at the storage-description ENTRY POINT, not a
   buried note. Target: neutral storage root, profile-bounded sub-paths.

2. **URI structure provenance — possibly HALLUCINATED.** Chuck's concern (2026-05-27): the URI layout
   (`/vault/wiki/{8 containers}`, `/meta/` split, etc.) was evolved forward-from-the-vault and may
   contain segments that were **invented along the way without a principled grounding** rather than
   derived from a decision/spec. **Do a provenance audit:** for each URI-structure choice, trace it to
   a D-decision or a spec, or flag it as accreted/hallucinated and re-derive it from first principles
   (LDP + the storage description + Type Index). Don't assume the current layout is intentional.

3. **PROF profiles ontology — deployed but NOT used by the agent.** D86 shipped PROF
   (`prof:ResourceDescriptor`, `SolidPodProfile`, the profile-link extension emitting
   `Link: rel="profile"`, the wikirole scheme). But in the cold probe the agent SAW the `rel="profile"`
   headers (`CoreProfile`, `SolidPodProfile`) and **dismissed them** ("names I didn't recognize …
   weren't needed"). So PROF is paying deployment cost while delivering no agent value — the agent
   orients via Type Index + shapes + the dogfood note instead. **Open question:** what is PROF's
   proper role? Is it the right primary resource-kind / "what schema is this?" affordance that we've
   under-wired, or is it redundant with the Type Index + SHACL and should be trimmed? This needs to be
   resolved as part of the re-layering — the agent's actual self-description path (storage description
   → catalogs → Type Index → shapes) should be designed deliberately, with PROF either promoted to a
   first-class consumed affordance or demoted.

**Deliverable:** a structural brainstorm spanning (1)+(2)+(3) grounded in the dual document/graph-view
framing (Verborgh) → a re-layering spec → the decision record. See `solid-profiles-and-conneg` +
`solid-uri-conformance` + `solid-storage-description` skills for the relevant standards.

## Code-review follow-ups (2026-05-27 — D106 sprint final review)

Two items from the final branch review (opus); the blocker (I1, stale committed `dist-cjs`
re-encoding the `/vault` bug) was FIXED in-sprint by recompiling. Remaining:

- **Stop tracking compiled `dist-cjs/*.js` (or add a build-drift guard).** The committed
  `dist-cjs/listener.js` had silently drifted from `src-cjs/listener.ts` — it still carried the
  pre-fix `new TypeIndexLoader(this.baseUrl)` because the artifact wasn't recompiled after the
  `8fd2649` fix. Runtime was saved only because `css/Dockerfile` rebuilds from source, but a
  committed artifact that contradicts its source IS the silent-failure class. Durable fix: gitignore
  the compiled outputs under `dist-cjs/` (keep the hand-written `*.jsonld` Components.js metadata +
  `package.json` tracked — they're NOT regenerated), OR add a `make check-dist` / pre-push hook that
  fails when `git diff --exit-code dist-cjs/` is non-empty after `npm run build`. Same observability
  theme as the Docker stamp.
- **`pod_audit.PUBLISHED_RANGE` is a hand-maintained mirror — drift-prone.** The predicate→class
  entailment is now single-source at runtime (the live `routing.jsonld`; `--check-routing` reads it,
  no Python mirror of the *map*). But `PUBLISHED_RANGE` (the published-range agreement check) is still
  hand-maintained, AND the TS `BOOTSTRAP_PREDICATE_TO_CLASS` kernel + `routing.jsonld` are hand-mirrors
  of each other. Adding a 4th entailed predicate means editing 3 files in lockstep
  (`wikilinkProjection.ts`, `overlays/wiki-memory/routing.jsonld`, `pod_audit.py`). Currently all three
  agree (verified in review). Consider deriving the kernel from `routing.jsonld` at build, or a test
  that cross-checks the three. Folds naturally into the RQ-Substrate-4 re-layering.

## ~~mem-operation in-resource provenance collides with the projection listener (RQ-Listener-1)~~ — RESOLVED 2026-05-26 (by collapse)

**Resolved** (merged to `main` 2026-05-28, commit `02f9b58`; reviewed + APPROVED in the 2026-05-28 session). The resolution arrived in two
passes — and the second corrected the first:

1. *(2026-05-25, since reverted)* A "derive-from-log" mechanism: the projector re-derived
   `<resource> prov:wasGeneratedBy <announcement>` from the `.operations/` log on each write.
2. *(2026-05-26, shipped)* **Collapsed.** A cold-discovery probe (a fresh agent, HTTP-only, no hints,
   asked to crystallize + record provenance) showed the derived edge was **over-design**: the agent
   completed the whole task using only the `.operations/` log, and the edge never even fired because the
   Pod's own `crystallize.ttl` prescribes announce-**last** while derivation needed announce-first. So the
   derived-edge machinery was removed.

**The actual design** (sufficient, validated by the probe): operation provenance is **canonical in
`/vault/wiki/.operations/`** — a `<>`-subject `[as:Announce, mem:*Action, prov:Activity]` with
`as:object <target>` (required, canonical link). The resource `.meta` does **not** carry the operation;
agents reconstruct history by querying the log for `as:object = <resource>` (the **`memory-history`
affordance**, op log + Memento). Kept from pass 1: the **PROV category-error fix** (the projector no longer
stamps `<resource> prov:wasGeneratedBy <affordance>`; the audit stamp lives on the `<resource>.meta`
document subject) and the `mem.ttl` `as:object` tightening. The 6 action affordance descriptors were made
consistent (drop the in-resource `prov:wasGeneratedBy` PATCH guidance + the blank-node examples; `.operations/`
is the sole provenance channel), resolving the contradiction the probe caught.

Also fixed (probe finding): crystallized concepts **failed `ThingShape`** because the projector never
synthesized `schema:name` on `<#this>` — now derived from the title (frontmatter title > H1 > slug).

Verified live (`make reset`): audit 0 ERROR, 6/6 `test_mem_operations.py` pass (assert `.operations/`
provenance), a crystallized concept now carries `schema:name` on `<#this>`.

**Still open / deferred:**
- **Review nit (2026-05-28):** `prov:wasGeneratedBy` is in `PAGE_GOVERNED_PREDICATES` (governed on subject `<>`) but the projector now emits the audit stamp on subject `<>.meta`. It's correct (the governance entry guards against agents stamping the resource, which `mem.ttl` forbids; the `.meta` stamp is re-emitted each write), but add a one-line comment in `governedPredicates.ts` explaining the subject split so a future reader doesn't read it as collapse leftover.
- **Read-path A/B (the over-design revisit trigger):** if a concrete high-frequency genesis-lookup
  workload ever appears, re-evaluate a denormalized in-resource genesis edge via an A/B trajectory eval
  (with a real workload, not synthetic). Until then, YAGNI — the log + `memory-history` is the design.
- **Destination-class inference (probe gap):** a working note declares only `wiki:WorkingNote`, not its
  intended durable class — the crystallize agent must infer it from content. Consider a
  `wiki:intendedClass` hint on working notes. Low priority.
- **Broad agent-extension** (arbitrary non-governed triples surviving body rewrites —
  `test_agent_enrichment_survives_body_rewrite`) stays deferred to the `.meta.agent` sidecar / D82.

**Note:** the earlier "silently red" framing of the 6 tests was inaccurate — they were already green via an
`.operations/`-only workaround (commit `eac80f9`); the final design keeps `.operations/`-canonical
assertions (no longer a workaround — it *is* the design).


## ~~NEXT SESSION — D106 real fix + pod-embed + comprehension re-probe~~ — DONE / SUPERSEDED (shipped on the branch, merged to main 2026-05-28)

> **All three items shipped and are in `main`:** (1) D106 full-arm Type-Index-driven container routing via `routing.jsonld` (commits `a4560c0`/`4c052eb`/`22e9405`/`0554e28`/`f35a6de`/`cb25021`); (2) two-hierarchy/dual-view self-description embedding (`4381a80` + D107 Phase 3.1) — closed the audit WARN; (3) comprehension re-probe ran 2026-05-27 (`docs/plans/2026-05-27-two-hierarchy-eval.md`). The dogfood note was crystallized to `/wiki/concepts/two-hierarchy-memory-addressing.md` (the `sub:agentGuide` target). Integration question resolved: both efforts (RQ-Listener-1 + D105/D106) merged as one to `main`. **The post-D107 behavioral re-probe is now RQ-View-2** (see decisions.md). Historical detail retained below for trace.

Decisions **D105** (two-hierarchy: RDFS-subsumption = addressing axis / SKOS-broader = navigation
axis, never substituted) and **D106** (wikilink role → predicate; container → target class via Type
Index, not role; extension types via ESCO Pattern C `rdfs:subClassOf skos:Concept` + `skos:exactMatch`,
no punning) are **recorded** (repo `decisions.md` D105/D106 + D76(a)/(c) revised + D79 sharpened; vault
D100/D101; project MEMORY key-pattern; auto-memory `two_hierarchy_addressing`). The **interim** resolver
fix shipped (`07217fe`): retired the stale role→container map, default = content container `concepts/`,
kept `author`→people; the 2 long-failing D98 fixtures are green. Three things remain:

**1. Real fix (D106 full arm) — resolve container from the target's CLASS via the Type Index.**
- File: `css/extensions/markdown-projection/src/wikilinkProjection.ts` (+ the listener which already holds
  the live Type Index via `TypeIndexLoader`). Today `targetContainer()` falls back to the base/default
  container; the real version resolves the target by looking up its class via the Type Index (the
  listener has it) and routing class→container. `.role` stays predicate-only (`HINT_TO_PROJECTION`).
- **Forward-reference guardrail:** when the target doesn't resolve (not yet created — normal in a wiki),
  emit the edge to the default content container marked **provisional**, and signal it as a
  dangling/reconcilable state via the existing `mem:StalenessDetected`/dangling-reference machinery so the
  pod-curator reconciles when the target is created. `.embed` ALWAYS looks up (never role-guess).
- Retire `HINT_TO_CONTAINER` except genuine role→type entailments (`author`). Keep the interim behavior as
  the fallback when no Type Index is available (pure-pipeline unit tests run without a live index).
- Note: the pipeline (`projectionPipeline.run`) is pure and has no store access; the Type-Index lookup
  belongs in the LISTENER (`src-cjs/listener.ts`, which has `TypeIndexLoader`) — inject the resolved
  target container into the pipeline, mirroring how `typeIndex` is already injected. Keep `run()` pure.

**2. Embed the two-hierarchy explanation in the Pod self-description (for cold agents).**
- Add agent-facing guidance so a cold agent learns the model from the Pod itself: RDFS-subsumption =
  addressing (Type Index → container/shape), SKOS-broader = navigation; wikilink role → predicate,
  container → target class via Type Index; extension types via Pattern C; dangling refs reconcilable.
- Surface it where a cold agent looks: the storage-description entry-point `sh:agentInstruction` (the lone
  audit WARN is that it's missing — this doubles as that fix) and/or a dedicated doc resource (e.g.
  `/vault/meta/two-hierarchy.md` or extend `/vault/wiki/index.md`). Carry machine-followable
  `dct:references` to the canonical sources (W3C *Using OWL and SKOS*
  https://www.w3.org/2006/07/SWD/SKOS/skos-and-owl/master.html ; ESCO model https://ec.europa.eu/esco/lod/model)
  so the agent can dereference the prior art, not just read prose.
- The dogfood note (below) is the content exemplar to crystallize into `/wiki/concepts/`.

**3. Comprehension re-probe + deploy.**
- `make reset` first — the live Pod is behind the branch: it does NOT yet have the mem.ttl subclass-example
  fix (`3a1c376`), the interim resolver fix (`07217fe`), or step-2's embedded guidance. Reset deploys all.
- Then run a cold agent on a task that exercises the two-hierarchy distinction (create a concept that cites
  a source + links a person; ask it to navigate `broader` vs reason about `subClassOf`/container) and assess
  whether it uses RDFS-addressing vs SKOS-navigation correctly and resolves containers via the Type Index.
  Honest comprehension check (same protocol as the 2026-05-26 cold probes — HTTP-only, no hints, no repo).

**Integration (overdue):** the branch carries TWO efforts — the RQ-Listener-1 collapse AND the D105/D106
two-hierarchy/wikilink work (~20 commits). Consider splitting into two PRs by concern before merge. Nothing
is pushed. Full reasoning trail: decisions D105/D106 + the superseded design doc
`docs/superpowers/specs/2026-05-25-mem-operation-provenance-derivation-design.md`.

**Dogfood note:** a wiki-memory-format vault note documenting the two-hierarchy KR pattern lives at
`~/Obsidian/obsidian/03 - Resources/Agentic Memory Systems/Two-Hierarchy Memory Addressing.md` — a
"memory about how the memory works." Crystallize it into the Pod as the first dogfood content (and the
content exemplar for step 2).

## Shape-validator TBox bundle sync pattern (added 2026-05-23)

`css/extensions/shape-validator/data/{mem,as-subclass-axioms}.ttl` are bundled copies
of the canonical files at `overlays/wiki-memory/ontology/`. Bundling is structurally
required: the Dockerfile COPYs only `extensions/shape-validator` into the image;
`overlays/` is applied at runtime over HTTP and is never present inside the container.

- **Sync**: `make sync-validator-tbox` copies canonical → bundle.
- **Guard**: `make check-validator-tbox` fails if bundle has drifted. Wired as a
  prerequisite of `make test` so drift is caught in every local test run. Run `make
  sync-validator-tbox` before committing any change to the canonical ontology files.

### getClosure() TOCTOU note

`ShapeValidationStore.getClosure()` uses a lazy-init pattern (`if (!this.subClassClosure)`).
Under concurrent first-writes — two requests hitting the store before the cache is warm —
both will build an identical Map in parallel and the second assignment will overwrite the
first with an equivalent value. This is benign under CSS's default single-threaded async
model: Node.js event-loop interleaving cannot split between the `if (!this.subClassClosure)`
check and the `this.subClassClosure = ...` assignment (no `await` in between). It would
become a real TOCTOU only if CSS ever moves to Worker threads with shared state. If that
ever applies, fix by caching a `Promise<Map<string, string[]>>` instead of the Map itself
so concurrent callers await the same in-flight build.

---

## Pod-audit: ClassExtensionShape inference caveat (2026-05-23)

ClassExtensionShape must be validated with `inference="none"`. RDFS entailment adds
`rdfs:subClassOf rdfs:Resource` to every `rdfs:Class`, which trivially satisfies the
`sh:minCount 1` rooting check and makes rootless classes like `wiki:Bad` appear
conforming. The test harness and the `sh:agentInstruction` both document this
requirement. If pod-audit ever runs shape validation with inference enabled, it MUST
explicitly set `inference="none"` for this shape.

---

## Substrate audit + curator — option-B unified build (partially shipped 2026-05-23)

**Status (updated 2026-05-23)**: the *architecture* shipped earlier (commit `5ce2b27`) — `wiki:ClassExtensionShape` meta-shape, subclass-aware path-constraint validation, `mem:StalenessDetected`/`mem:RealignAction`/`mem:rationale` vocabulary, the realignment trace exemplar in `.operations/`, D98 migration. **`pod-audit` now shipped too**: `scripts/pod_audit.py` walker + `StorageDescriptionShape` + `AffordanceDescriptorShape`/`SearchAffordanceShape` (`shapes/substrate/`) + `make audit`. GET storage-description → SHACL-validate (`inference="none"`) → HEAD-check catalog pointers + `rdfs:seeAlso` → walk affordance catalog → validate each entry. Emits JSON (curator queue) / markdown; non-zero exit on ERROR. Validated against the live Pod.

**Baseline audit (the curator's first work queue, 11 WARN / 0 ERROR):** (a) storage description lacks an entry-point `sh:agentInstruction` (the D104 seed prose is ready in §"Component 4" below); (b) two stale `rdfs:seeAlso` 404s — `wiki/pages/` + `wiki/sources/` — these come from the **static** `css/config/void-description.json` (the overlay `storage-patch.ttl` already carries the correct 8-shape list; the static config was never migrated, so the live doc has both old and new); (c) **8 addressbook affordance descriptors** (`contact-find-by-*`, `org-find-by-*`, `bridge-card-to-wiki`) are typed `wiki:Affordance` only — no `prof:ResourceDescriptor`, so they escape the descriptor contract (no role/label/conformsTo/installedBy). Descriptor typing is inconsistent across overlays; the walker enforces the governing type via catalog `ldp:contains` membership rather than relying on SHACL targeting alone.

**Design note (ground-truth precedence):** the AffordanceDescriptorShape did NOT follow this file's earlier proposed strict spec (`wiki:dispatchPattern` cardinality 1 + 100-char `sh:agentInstruction` on the base). The live catalog showed only `SearchAffordance` carries a dispatch pattern; the 6 write affordances use `dct:description` + `wiki:procedure`. The base shape requires only the universal predicates (`prof:hasRole`, `rdfs:label`, `dct:conformsTo`, `wiki:installedBy`, + intent-prose via `sh:or`); dispatch constraints are scoped to a `SearchAffordance`-targeted sub-shape.

**`pod-curator` skill shipped (2026-05-24, solid-agent-skills commit `6ac07d8`)**: D103 bootstrapper + `references/playbook.md`, validated across 3 eval iterations against the live Pod. Clean (de-contaminated) delta 100% vs 61% with-skill vs without. Trajectory-grounded finding: the skill's uncontaminated contribution is the proposal **form** — `mem:RealignAction` + `stalenessClass` + `rationale` + `FalsePositive` on every run (4/4 with-skill vs 0/4 without); the self-describing substrate supplies the *findings* to either arm. (Methodology note: iter-1/2 leaked the `curator-proposals/` path into both prompts, inflating the routing assertion; iter-3 removed it. Don't put substrate paths/vocab in eval prompts.)

**Remaining**: (1) more substrate shapes — capability descriptors, per-catalog-entry label/comment, vocab declarations, JSON-LD context, Type Index; (2) **sweep the 11 baseline WARNs** (fix `void-description.json` stale `seeAlso`, add entry-point `agentInstruction`, bring the 8 addressbook descriptors under the contract) — the curator eval already produced applyable proposals for most; (3) wire `make audit` into `make reset` + CI (deferred — keep manual until the sweep clears ERRORs); (4) pilot iter-3; (5) run pod-curator description optimization (`skills/pod-curator/evals/trigger-eval.json` staged). The curator's staleness loop is specified in the vault method-note `Stale-Memory Discovery and Realignment` + auto-mem `stale_memory_realignment`. Decision ratified as **D104 / vault-D99**. Pilot report §5 has the original task breakdown. NOTE: `ClassExtensionShape` validation (not yet wired into pod-audit) MUST use `inference="none"` — see the caveat above.

### Sweep applied (2026-05-24) — 11 WARN → 1 WARN, 0 ERROR

The Component-4 sweep landed (this repo): stale `rdfs:seeAlso` (pages/sources) and `prof:hasResource` (source dropped, procedure→howto) fixed in `void-description.json`; 8 addressbook descriptors retyped `wiki:QueryAffordance , prof:ResourceDescriptor` with role/label/conformsTo/installedBy; `wikirole:query-affordance` + the missing `wikirole:search-affordance` defined; catalog `dc:description` realigned D77→D98. **WoT alignment**: `wiki:Affordance rdfs:subClassOf td:InteractionAffordance`, `wiki:QueryAffordance ⊑ td:ActionAffordance` (https://www.w3.org/2019/wot/td#), `td:` prefix in context. Two findings from doing it:

- **Storage-description PATCH is 405 (GET-only) → the overlay `storage-patch.ttl` is inert for `.well-known/solid`.** `css/config/void-description.json` (static StaticStorageDescriber) is the *only* source that surfaces there. `seeAlso` must live in the static config, NOT the overlay (initially mis-moved to the overlay, which silently dropped seeAlso entirely; corrected). The overlay's seeAlso/conformsTo inserts have never reached the storage description — candidate to clean up or repurpose to a custom StorageDescriber.
- **`StaticStorageDescriber` emits only NamedNodes (IRIs), not literals** (`Predicate needs to be a named node`; values become IRIs). So the entry-point `sh:agentInstruction` (a string literal) can't be added via the static config — this is the lone remaining audit WARN (Warning-severity by design). FIX: a tiny custom StorageDescriber that yields a literal `sh:agentInstruction` quad on the storage subject, or expose the prose via a different discoverable surface. Until then the agentInstruction lives in the `StorageDescriptionShape`'s own `sh:agentInstruction` (read by the curator), not on the live storage description.

### pod-curator → Pattern B subagent-skill + triggering-eval correction (2026-05-24)

pod-curator restructured to a Claude Code **`context: fork` subagent-skill** (solid-agent-skills
`0b8168f`): a curation run generates large throwaway context (audit JSON, descriptor reads,
SHACL, proposals) that belongs in an isolated fork, not the orchestrator's context. Made
discoverable via `solid-agent-skills/.claude/skills/pod-curator -> ../../skills/pod-curator`.
Full mechanics in auto-mem `claude_code_skill_subagent_mechanics`. Key points:

- **The description-optimization eval was measuring the wrong surface.** skill-creator's
  `run_eval` installs the description into `.claude/commands/` (a *user-invoked* slash command,
  never auto-triggered), not `.claude/skills/` (auto-triggerable). So recall floored at 0 for
  EVERY description — wording was never the variable. Don't re-run the optimizer against that
  mechanism; the `description-opt/` artifacts were deleted as misleading. To measure triggering:
  install under `.claude/skills/`, run `claude -p`, detect the `Skill` tool_use.
- **`context: fork` IS honored in headless `claude -p`** (v2.1.150), confirmed by a subagent
  trajectory written at `~/.claude/projects/<slug>/<session_id>/subagents/agent-*.jsonl`.
  (claude-code-guide + GitHub #17283 claimed otherwise — empirically wrong/stale.) stream-json
  does NOT expose the fork via `parent_tool_use_id`; **detect via the trajectory artifact**.
- **Self-containment (2026-05-24, solid-agent-skills `d914f2f` + this repo `4bd6ff1`):** trajectory
  analysis of forked curator runs found a sandbox-reachability wall — a fork is confined to the
  invoking session's repo, so it could not run `pod_audit.py` in cogitarelink-solid (TLS friction
  was a red herring; the real blocker was cross-repo exec being auto-denied headless). Fixed by
  **bundling the tool into the skill**: `pod_audit.py` got PEP 723 inline deps
  (`httpx`/`rdflib`/`pyshacl`) + mkcert-CA auto-detect (`resolve_ca()`), and is copied into
  `skills/pod-curator/scripts/` (+ `shapes/substrate/`); the skill runs `uv run
  ${CLAUDE_SKILL_DIR}/scripts/pod_audit.py`. No venv, no `SSL_CERT_FILE`, no sibling repo. Canonical
  stays here; `make sync-curator-skill` pushes copies (drift-prone like the shape-validator TBox
  bundle — re-sync after editing `pod_audit.py`/`shapes/substrate/`). VERIFIED: a no-`--add-dir`
  fork ran the bundled tool, touched cogitarelink-solid zero times, completed audit→classify→
  `mem:RealignAction` proposal→two-stage commit. (No Claude Code declared-dependency mechanism
  exists; PEP 723 + `uv run` is the idiomatic answer.) Eventual clean option: extract pod-audit as
  a pip/uv-installable package both repos depend on, instead of a synced copy.
- **Still open:** the trigger-eval (`skills/pod-curator/evals/trigger-eval.json`) is now *valid
  to run* via the corrected mechanism (install under `.claude/skills/`, `claude -p`, detect
  Skill tool_use + the subagent trajectory). Not yet re-run. Also: the skill-creator harness
  bug (uses `.claude/commands/`) is worth reporting upstream; and its `run_loop` auto-improver
  crashes on opus-4-7 (`thinking.type.enabled` unsupported — needs `thinking.type.adaptive`).

### Concrete bugs/gaps surfaced by the pod-curator eval — CLOSED (2026-05-24)

All four are resolved (see commit history):

- ~~**`pod_audit.py` cross-check gaps**~~ — FIXED (`cogitarelink-solid` `4b434b9`). The walker now HEAD-checks `prof:hasResource` targets (WARN on non-resolving) and verifies `prof:hasRole` targets under the wikirole namespace are `skos:inScheme` the scheme (WARN on dangling roles). Bundle re-synced.
- ~~**Dangling `wikirole:search-affordance`**~~ — already fixed by the substrate sweep (`ec9921f`); `:search-affordance` + `:query-affordance` defined in `wikirole.ttl`, confirmed deployed (3 hits in `/vault/ontology/wikirole`).
- ~~**`solid-pod invoke` broken for ALL affordances**~~ — FIXED (`solid-agent-skills` `273b29a`). Dropped the `:3000` from `WIKI_NS` (port-less per D84) and repointed default `.meta`-source discovery `wiki/pages/` → `wiki/concepts/` (D98). Verified live: `hub-view` extracts construct, `contact-find-by-name` extracts select (both previously errored).
- ~~**Stale D77 catalog `dc:description`**~~ — already realigned by the sweep; the deployed storage description shows current `prof:hasResource` (page/concept/person/howto/working) and `rdfs:seeAlso` (8-shape containers), no stale source/procedure pointers.

## Pre-existing test_phase5j_close drift (surfaced 2026-05-23, NOT this sprint)

5 failures in `tests/test_phase5j_close.py`, all older count-drift (themselves stale-test instances): `test_wikirole_scheme_has_five_role_concepts` (wikirole now has 9 `prof:ResourceRole`, test expects 5 — Memory Structuring Sprint expanded it); `test_overlay_helpers_extract_role_scheme_and_profiles` + `test_manifest_declares_role_scheme_and_six_profiles` (manifest declares 10 profiles, tests expect 6); `test_wiki_vocab_declares_conformsTo_rdfs` (`wiki.ttl` missing `dct:conformsTo rdfs`). These predate this sprint and are out of its scope; fix by realigning the test expectations to current counts (a small realignment task in the same spirit as the D77→D98 cleanup). Also: `scripts/backfill_conformsTo.py` still references `/vault/wiki/pages/` + `/sources/` (one-off utility, low priority).

**Architecture** (per D104): the Pod's self-description IS wiki-memory L3 content. SHACL shapes provide guardrails; an agentic curator provides construction. They feed each other through a violation-report → reasoning → patched-substrate loop. **One unified toolkit** (audit + curator + review) works on both content-side (vault pages) and substrate-side (descriptors). The Phase B2 lint skill collapses into the substrate-curator; build once.

**Estimated**: ~3-4 hours focused next-session work.

### Component 1 — Substrate-resource SHACL shapes

Start with two exemplars:

**`shapes/substrate/storage-description.shacl.ttl`** (StorageDescriptionShape):

- Targets: `wiki:L3StorageDescription` (mint this class if not present) or `pim:Storage` via filter
- Required predicates: `wiki:affordanceCatalog`, `wiki:typeIndex`, `wiki:contextDocument`, `wiki:shapeCatalog`, `wiki:profileDocument` (cardinality 1 each); `dct:conformsTo` (≥1)
- `rdfs:seeAlso` constraint: targets must resolve. Either custom pyshacl extension (HTTP HEAD per target) OR post-validation cross-check in the walker
- `sh:agentInstruction` required (cardinality 1, non-empty, ≥100 chars)
- All `void:vocabulary` IRIs must be dereferenceable (cross-check)

**`shapes/substrate/affordance-descriptor.shacl.ttl`** (AffordanceDescriptorShape):

- Targets: `wiki:SearchAffordance`, `wiki:DerivedClassAffordance`, etc., via `sh:targetClass`. Or use `prof:ResourceDescriptor` as a parent and rely on `rdfs:subClassOf` inference
- Required predicates: `rdfs:label` (xsd:string, cardinality 1, min length 3); `rdfs:comment` (cardinality 1, min length 20); `sh:agentInstruction` (cardinality 1, min length 100); `prof:hasRole` (cardinality 1, must be in wikirole concept scheme); `wiki:dispatchPattern` (cardinality 1, regex `^\?ext=[a-z-]+$`); `wiki:targetContainer` (IRI); `dct:conformsTo` (≥1)
- `prof:hasRole` membership: cross-check against `/vault/ontology/wikirole`

Defer (write when Phase B+ surfaces need):

- `CapabilityDescriptorShape` (similar structure; targets `cap:Capability` subclasses)
- `AffordanceCatalogEntryShape` (per-LDP-entry label/comment requirements)
- `VocabularyDeclarationShape` (per `void:vocabulary` IRI)
- `JSONLDContextShape` (the `/meta/context.jsonld`)
- `TypeIndexShape` (the `/settings/publicTypeIndex`)

### Component 2 — `pod-audit` walker

`scripts/pod_audit.py`. Python + pyshacl + httpx. CLI usage:

```bash
~/uvws/.venv/bin/python scripts/pod_audit.py [POD_URL] [--shapes-dir shapes/substrate/] [--out-format json|markdown]
```

Behavior:

1. GET `<POD>/vault/.well-known/solid` (Accept: text/turtle)
2. Parse as RDF graph; locate the `pim:Storage` subject
3. Validate against `StorageDescriptionShape` via pyshacl
4. Cross-check: HEAD each declared catalog IRI (affordance/capability/context/type-index/shape); report 4xx/5xx
5. HEAD each `rdfs:seeAlso` target; report 404s as ERROR
6. GET affordance catalog; for each `ldp:contains` entry:
   - GET the entry
   - Validate against `AffordanceDescriptorShape`
   - Cross-check: dispatch pattern matches a CSS extension handler (parse `css/config/*.json` to confirm)
7. Emit structured findings (severity: ERROR / WARN / INFO; location: IRI; constraint: shape predicate or cross-check name; remediation: short hint)

Output: JSON (machine-consumable, for the curator agent) + Markdown (human-readable). Non-zero exit on any ERROR.

Hooks:

- `Makefile`: `make audit` target invokes pod_audit.py against the running Pod
- `make reset` chains `make audit` after `pod-setup`; ERROR findings fail the reset
- CI (GitHub Actions or equivalent) runs `make reset` + `make audit` on every PR

### Component 3 — `pod-curator` skill (proof-of-concept)

Location: `solid-agent-skills/skills/pod-curator/SKILL.md`. Bootstrapper-form per D103 (~25-40 lines):

- **When to use**: after `pod-audit` produces ≥1 ERROR or WARN; or in response to a `mem:*` substrate event
- **Tool**: `solid-pod` CLI for substrate edits via N3 Patch; `pod-audit` for re-validation
- **Pointer**: the substrate's SHACL shapes at `<pod>/meta/shapes/substrate/` are the canonical contract; the audit report (JSON) is the work queue
- **Two-stage commit (D73)**: all curator proposals go to `/vault/working/curator-proposals/<timestamp>/`, NOT directly to the affected resource. Crystallize step requires human or higher-trust agent review
- **Per-violation playbook**: 
  - "Missing required predicate" + reconstructible from context → auto-propose
  - "Stale reference (rdfs:seeAlso 404)" → propose update (read overlay manifests for new path) or removal
  - "Missing intent-bearing prose" → compose by reading descriptor purpose + sibling examples
  - Anything else → flag for review with diagnostic context

Skill body refers to a long-form playbook at `solid-agent-skills/skills/pod-curator/playbook.md` (similar to how vault skills have references/ subdirs).

### Component 4 — Immediate sweep (post-audit)

After Components 1-3 land, run `pod-audit` against the live Pod and fix the highest-priority findings:

- **Fix stale `rdfs:seeAlso`**: storage description currently lists `<../wiki/pages/>, <../wiki/sources/>, <../wiki/people/>, <../wiki/procedures/>, <../wiki/working/>`. After D98 8-shape, only `people/`, `procedures/`, `working/` exist; `pages/` → `concepts/`; `sources/` merged into `concepts/`. **Fix path**: either remove `rdfs:seeAlso` entirely (Type Index already lists containers — preferred), or update to the 8-shape list (`concepts/, people/, places/, organizations/, events/, procedures/, working/`).
- **Add labels + comments to affordance catalog entries**: each `.ttl` file in `/vault/meta/affordances/` needs `.meta` predicates `rdfs:label` + `rdfs:comment`. Patch via N3 Patch to each entry's `.meta`. Curator agent can generate from descriptor content; first pass can be hand-curated.
- **Add entry-point `sh:agentInstruction` to storage description**: compose prose. Suggested seed: *"Agents arriving at this Pod should first dereference `wiki:affordanceCatalog` to enumerate capabilities. Each capability lives at the named affordance descriptor; the descriptor's `sh:agentInstruction` is the canonical wire form. For taxonomic navigation (class → container routing), see `wiki:typeIndex`. For prefix → IRI resolution, see `wiki:contextDocument`. For SHACL shapes governing content, see `wiki:shapeCatalog`. The wiki-memory L3 profile this Pod conforms to is at `wiki:profileDocument`."*
- **Document OSLC parameter compliance map**: for each affordance accepting OSLC parameters (currently just `wiki-search-grep.ttl`), declare `wiki:supportedParameters` (or similar predicate; design during this build) listing supported + 501-returning parameters. Generate from CSS handler code introspection.

### Component 5 — Re-run Phase A pilot iter-3

After Components 1-4 land, run iter-3 with **per-condition assertions**:

- **With-skill** assertions: tests skill-usage efficiency. "Agent invoked `solid-pod wiki-search` without burning tool calls on bootstrap"; "agent did NOT redundantly fetch the affordance catalog (skill provided enough info)"; "outcome correct."
- **Without-skill** assertions: tests cold-discovery. Same as iter-1/iter-2 (followed storage description → catalog → descriptor → invocation; used OSLC quoting; outcome correct).
- **Both**: outcome correctness (count + URLs).

Compare iter-3 against iter-1 + iter-2 via `generate_review.py --previous-workspace iteration-2`. The substrate sweep should ALSO improve without-skill efficiency (no 404s on stale `rdfs:seeAlso`, better narrowable catalog labels).

### Component 6 (optional, time-permitting) — Skill audit pass

If Components 1-5 finish with time to spare, audit the other skills in `solid-agent-skills/skills/` for D103 conformance:

- `pod-discover/SKILL.md` (most relevant — cold-start orientation)
- `solid-addressbook/SKILL.md`, `solid-wiki-memory-l3/SKILL.md`, `solid-owner-identity/SKILL.md`
- Action skills (crystallize, demote, archive, supersede, merge, link)
- Inbox skills (inbox-list, inbox-read, inbox-subscribe)

For each: is the skill ≤25 lines? Does it point at the canonical substrate descriptor? Does it duplicate substrate content? Refactor as needed.

### Dependencies + risks

- **pyshacl HTTP-resolve constraint**: pyshacl doesn't natively dereference IRIs as part of validation. Either subclass the validator OR post-process with a separate walker that does the cross-checks. Latter is simpler.
- **wikirole concept scheme**: shape constraint `prof:hasRole` membership requires the wikirole scheme at `/vault/ontology/wikirole` to be loadable + complete. Verify before relying on the constraint.
- **Two-stage commit for substrate**: the `/vault/working/curator-proposals/` container doesn't exist yet. Create it during Component 3 work, with permissive shape per D73 working/ semantics.
- **N3 Patch on `.meta`**: confirmed working from prior sprints (e.g., AddressBook overlay's `installsResourceMetaPatch`). Use the same pattern.

### Subsumes earlier task #10 (Pod-side lint/audit/curator skill)

Task #10 from the Rung 1.5 redesign session (filed as a Phase B2 prerequisite) collapses into this unified build. The pod-curator skill body (Component 3) IS the Phase B2 lint skill — same shape inputs, same reasoning loop, different work-queue source (audit report vs runtime `mem:*` event). Build once, apply to both.

---

## Pod-hosted memory-structure UI for transparency (2026-05-22)

The Pod runs on `localhost` (127.0.0.1 via `/etc/hosts`), so externally-hosted Solid apps (Penny, SolidOS at solidcommunity.net) only browse it via the user's own browser. Workable for read-only inspection, but not robust for end-users who need to see the substrate's memory structure (wikilinks, shapes, events, affordances, type-index, Memento history) at a glance.

**The actual need**: a substrate-aware UI served BY the Pod, same-origin, no CORS / OIDC redirect dance. Not just a generic LDP file browser — a transparency surface for:

- Dual-layer linking (wikilinks in body, projected predicates in `.meta`) rendered together
- Shape conformance per resource (which shape governs, current SHACL state)
- `/vault/wiki/.events/` substrate-signal stream (live via Solid Notifications subscription)
- Affordance catalog at `/vault/meta/affordances/` (what agents can do here)
- Type Index browsing (class → container routing)
- Memento history (time-travel queries with TimeMap rendering)

**Architectural sketch** (not yet a design):

- New CSS extension `memory-browser` serving static assets + a JSON API at `/vault/_ui/`
- Probably React/Preact + solid-client + N3.js (same stack as Penny)
- Or simpler: vanilla HTML + the existing JSON-LD context (`/vault/meta/context.jsonld`) for self-description
- Same-origin → no CORS, no OIDC popup, works with any browser without `mkcert -install`

**Why this matters beyond UX**: Rung 1.5 eval will need to observe agent behavior. A transparency surface that shows "what the agent saw, what it changed, what the substrate signalled" is useful for eval analysis even if not used by end-users.

**Trigger to start this**: post-Rung-1.5, OR when an end-user / demo needs human-readable Pod browsing as a primary affordance. Until then, the CLI (`solid-pod` in solid-agent-skills) and curl-based debugging cover developer needs.

Cross-refs: D75 (we explicitly traded the default container-browser HTML for clean markdown rendering — this would be the deliberate re-introduction of UI, scoped to substrate concerns).

## resource.shacl.ttl FAIR metadata retrofit (post-D97, 2026-05-19)

The D38 LDP RDFS/NRSource guard shape at `overlays/wiki-memory/shapes/resource.shacl.ttl` predates D97 and lacks the FAIR metadata properties (`rdfs:label`, `rdfs:comment`, `rdfs:isDefinedBy`, `dct:conformsTo`, `dct:created`, `dct:creator`) the rest of the L3 catalog now carries.

Exempted from `test_fair_metadata_present.py` (test fix in commit TBD) since the spec preserves it as-is per Phase B migration plan ("Preserved as-is. D38 invariant unchanged; not part of L3 content model"). Worth retrofitting as a future cleanup pass to make the L3 catalog uniformly FAIR-conformant.

Effort: ~10 minutes (just add the 6 properties).

## Shape catalog reconciliation (2026-05-18) — pyshacl fixture rebaseline

The shape-catalog reconciliation commit deleted the legacy `shapes/wiki-memory-l3/`
directory and re-pointed `tests/test_wiki_memory_l3_shapes.py` at the canonical
`overlays/wiki-memory/shapes/`. The four `test_bundle_fixture_validates` cases are
now `xfail` (strict) because the canonical shapes have tighter constraints than
the Rung-1.4-vintage fixtures.

Known fixture violations against canonical shapes:

- `karpathy-andrej.md.meta` — canonical `PersonShape` requires `foaf:name`
  (minCount 1); fixture has only `dct:title` + `foaf:nick`.
- Other bundle fixtures share the same combined-graph failure mode; need to
  re-validate each against canonical shapes individually to enumerate the
  delta.

This is part of **Shape Completion sprint** scope, not a standalone fix:
the sprint will retighten/finalize the shapes (page, source, person,
procedure, working) and add a Concept-specific shape, then rebaseline
fixtures to match. Once fixtures pass, remove the `@pytest.mark.xfail`
decorator and `strict=True` will catch any subsequent regression.

## ~~Phase C.10 — MemTrigger v1 wiring (Memory Structuring Sprint, 2026-05-18)~~

**Closed 2026-05-21** by MemTrigger detector wiring sprint (D101).
See `docs/superpowers/specs/2026-05-20-mem-trigger-detector-wiring-design.md`
and `docs/superpowers/plans/2026-05-20-mem-trigger-detector-wiring.md`.

All four detectors wired:
- BoundExceeded — real checkBound implementation via fetch() (D92 lock pattern)
- UnprocessableWrite — IUnprocessableWriteHook injected into ShaclValidator
- ContradictionDetected — IPostProjectionHook invoked by MarkdownProjectionListener
- ReflectionDue — setInterval timer in handle(); integration test deferred

Three of four mem_events integration tests passing on live Pod;
test_reflection_due_emits_event remains pytest.skip pending test-mode
config activation (artifact exists at `css/config/mem-trigger-test.json`
+ `css/config/solid-config-test.json`; activation pattern documented in
mem-trigger README).

### K1 consolidation note

`mem-trigger.json` now holds the WorkerParallelInitializer Override
listing all three listeners. Components.js rejected the configuration
when two files (markdown-projection.json + mem-trigger.json) both declared
Overrides on the same instance — "Found multiple Overrides targeting" is
a hard preprocessing error, not resolved by import order. Future memory
substrate listeners must be added to mem-trigger.json's handlers list.

## Phase 7a wiki-search — shipped (2026-05-18)

D87 ratified. Wiki-search CSS extension + Link MetadataWriter + capability
+ affordance descriptors + consumer CLI + Claude skill all shipped. Pod
returns OSLC Query 3.0 responses with WAC-filtered, AND-filtered,
score-sorted, paginated matches over recursive `/vault/wiki/` walks.
p95 latency: 26.7ms (D87 ceiling 500ms — 18.7× headroom).

Key commits (cogitarelink-solid):
- Implementation plan: `b064a79`
- Scaffold + interfaces: `d41f40c`, `5332c1a`
- Pure-Node engine + parsers + helpers: `1eafdab`, `7c1c054`, `821cf5b`,
  `0bd4bc3`, `fbb4e44`, `57abce4`
- Walker (recursive BFS + WAC subtree-omission): `c694407`, `5e9c6c1`
- Handler + Components.js + Dockerfile: `6cbccb1`
- Link MetadataWriter (Tier-1 discovery): `a014967`
- Capability + affordance descriptors: `7c68fca`
- E2E integration tests: `eb37bb7`
- Perf smoke (p95 26.7ms): `4905731`

Sibling repo (solid-agent-skills):
- Consumer CLI + Claude skill: `b17be6f`

### Architectural deviations from plan

- [x] ~~**D91 — Walker uses HTTP self-requests, not in-process ResourceStore.**~~
  **Provisional D91 retracted on 2026-05-18 spike.** The recorded narrative
  bundled two independent fixes ("HTTP-self-request rewrite" + `isReadAllowed`
  permission-shape fix) and credited the wrong one for resolving the original
  test failures. The actual root cause is re-entrant lock on the *request
  target itself* — not a general ResourceStore problem. Header forwarding
  to fix the anonymous-content leak is **architecturally impossible** under
  Solid-OIDC (DPoP proofs are bound to htm/htu/jti and one-shot; the server
  cannot mint replacement proofs without the client's private key).
  Replaced by Path 1a (DataAccessor for seed enumeration, ResourceStore for
  descendants). See `docs/plans/2026-05-18-wiki-search-walker-redesign.md`
  for the full reproduced failure mode, CSS architecture probes, multi-agent
  threat model, and revised recommendation. D92 ratification follows
  implementation sprint.

- [x] ~~**Wiki-search walker Path 1a redesign sprint.**~~ **Shipped 2026-05-18,
  commit `2f2f28b`.** Ratified as **D92** in
  `.claude/skills/decision-lookup/decisions.md`; synced to vault as D88
  (`SOLID-Pod-Decisions.md`). Implementation found two crash modes beyond
  the originally diagnosed re-entrant lock — both rooted in CSS's
  `N3StreamWriter` / `Guarded<Readable>` stream wrapping rather than in
  locking — so the final architecture uses `DataAccessor` for **all** Pod
  data access (`getChildren()` for container enumeration, `getMetadata()`
  for content-type checks, `getData()` for document bodies). No
  `ResourceStore.getRepresentation()` calls in the walker. p95 latency
  improved 3.5× (26.7ms → 7.6ms). 77/77 unit + 13/13 non-skipped
  integration tests pass. Findings recorded in
  `docs/plans/2026-05-18-wiki-search-walker-redesign.md` "Implementation
  findings" section.

- [ ] **WAC scenario integration tests un-stubbed.** Six tests in
  `tests/integration/test_wiki_search_e2e.py::TestWacScenarios` remain
  stubbed pending an authenticated-client fixture shared with
  `test_addressbook_e2e.py`. **Deferred under the behavior-before-security
  sequencing principle**: agent credential storage (DPoP key management,
  agent-vs-human WebID, VC delegation, refresh semantics) is its own
  design exercise downstream of Rung 1.5 (or equivalent) eval evidence
  about how agents actually traverse the substrate. Don't lock in a
  fixture shape until the credential model is designed; don't design the
  credential model until behavior is observed. See project MEMORY
  `behavior_before_security.md`.

- [ ] **VC credential extension (future research-track).** CSS v8 has
  the `@solidlab/policy-engine` VC matcher (`evaluateVc`) and ACP support,
  but **no `VerifiableCredentialExtractor`** ships out of the box.
  Roadmap in `docs/plans/2026-05-18-vc-credential-roadmap.md` covers:
  CSS v8 credential machinery state, the Inrupt UMA + Access Grants flow
  (gConsent), the SolidLab UMA AS landscape (real, MIT-licensed, but no
  W3C VC claim_token support yet), TypeScript VC library survey
  (`@digitalbazaar/vc` recommended core), and three routes — B rejected
  (build from scratch), C as v1 prototype (custom header + inline
  verifier, ~150 LOC), A' as v2 destination (SolidLab UMA + custom
  `VcVerifier` + `VcAuthorizer`, ~400 LOC contribution upstream).
  Not scoped to a sprint. Implementation triggers documented in the
  roadmap; typically Rung 1.5 eval evidence or a concrete use case
  requiring VC-gated access.

### Deferred to Phase 7b/c/d (out of scope for 7a)

- [ ] **Engine swap to BM25 or ripgrep** (Phase 7b). Decision criterion: if
  Rung 1.5 eval shows literal-witness recall < 90% on representative tasks,
  or p95 latency regresses past 500ms.
- [ ] **`oslc.where` structured filter** (RQ-Search-2). Either post-filter via
  Comunica over `.meta`, or push the structured filter into a pre-scan step.
  Defer until eval shows a real workload.
- [ ] **Hybrid RRF orchestrator** (Phase 7c). ~200 LOC; combines literal + BM25.
- [ ] **WebID-partitioned in-pod index** (Phase 7d, ESPRESSO pattern).
- [ ] **`_profile=alt` introspection** for the search response (low-priority).

### Deferred from Phase 7a implementation

- [ ] **WAC scenario integration tests** — see the dedicated entry above
  under "Architectural deviations from plan". Deferred under
  behavior-before-security; not blocked by Path 1a (Path 1a is shipped),
  blocked by the agent credential-model design exercise.
- [ ] **Score formula tuning** (RQ-Search-1). v1 baseline is density + log
  dampening; tune against Rung 1.5 eval evidence.
- [ ] **Whether to embed `.meta` triples in search responses** (RQ-Search-4).
  Phase 1 omits; revisit if Rung 1.5 shows agents repeatedly fetching `.meta`
  after a search hit.
- [ ] **Snapshot tokens for transactional pagination consistency**. Phase 1
  documents "stable-within-instant only"; revisit only if Rung 1.5 shows
  pagination drift hurts.

## Phase 5j (2026-05-16) — URI conformance close-out

### Deferred from D86 implementation

- [x] **PROF descriptor installation via overlay machinery.** Closed by Phase 5j close-out (2026-05-16) — see new section below for follow-ups.
  ~~5 descriptors written at `overlays/wiki-memory/profiles/{page,concept,source,person,procedure,working}.ttl` but the overlay manifest schema doesn't yet have `installsProfile` (parallel to `installsShape`, `installsAffordance`). To install:~~
  ~~1. Add `overlay:installsProfile` predicate to `css/config/pod-templates/base/ontology/overlay.ttl`~~
  ~~2. Parse it in `scripts/overlay/common.py` (mirror `shape_urls`/`affordance_urls`)~~
  ~~3. Add upload loop in `scripts/overlay/apply.py` step 3.5 (after affordances)~~
  ~~4. Update `overlays/wiki-memory/manifest.ttl` with the 5 profile URLs~~
  ~~\~15 LOC change. Files are committed; just unwired.~~

- [x] **`Link: rel="profile"` MetadataWriter CSS extension** (D86). Closed by Phase 5j close-out (2026-05-16) — see new section below for follow-ups.
  ~~Mirrors the `MementoLinkMetadataWriter` pattern at `css/extensions/memento/src/MementoLinkMetadataWriter.ts` (~30 LOC). Need:~~
  ~~1. New extension at `css/extensions/profile-link/` with package.json (lsd:* fields, `@cogitarelink/profile-link`), tsconfig.json, src/, dist/~~
  ~~2. `ProfileLinkMetadataWriter.ts`: path-based dispatch (`/vault/wiki/pages/*` → `wiki:PageProfile`, etc.) — use `addHeader` so Link composes with existing MementoLink + describedby headers~~
  ~~3. Components.js config that inserts the writer into the MetadataWriter ParallelHandler after `MetadataWriter_LinkRel`~~
  ~~4. Add `@cogitarelink/profile-link` to solid-config.json @context array and imports~~
  ~~5. Update Dockerfile with the symlink trick (per `css-extension` skill)~~
  ~~6. Tests: assert Link header presence on every resource GET~~
  ~~Design fully specified in `.claude/skills/solid-uri-conformance/SKILL.md` + `templates.md` Template E.~~

- [ ] **`_profile=alt` introspection view.**
  Reserved spec token (NOT `alternates` — see PROF research finding). Lists all profile × media-type combos for a resource. Part of the ProfileLinkMetadataWriter extension or a separate handler. Defer until Pod-bound agent eval shows a use case.

- [ ] **CSS storage description PATCH gate.**
  Surfaced during overlay apply: CSS returns `405 MethodNotAllowedHttpError "Only GET requests can target the storage description."` Overlay's storage-patch.ttl couldn't be applied at runtime — the wiki:* L3 pointers in `.well-known/solid` come exclusively from `css/config/void-description.json` (static StaticStorageDescriber). Decision: either (a) keep all storage description triples in static config (current state, works); (b) override CSS to allow PATCH on storage description; (c) move L3 pointers entirely into overlay-patched `/vault/.meta`. Currently working as-is; revisit if RQ-Substrate-3 successor surfaces.

### Closed by Phase 5j

- [x] **RQ-Substrate-3** — namespace mismatch resolved by D84 commitments (https, port-less, hash-namespace, extension-less). All 55+ source files migrated; volume wiped; Pod regenerated with new IRIs. Verified end-to-end.
- [x] **PROF descriptor installation via overlay machinery** — done via `overlay:installsProfile` + `overlay:installsRoleScheme` predicates in manifest + apply.py upload step. Wikirole SKOS scheme at `/vault/ontology/wikirole`.
- [x] **`Link: rel="profile"` MetadataWriter CSS extension** — done via `css/extensions/profile-link/` + Components.js wiring consolidated into memento.json. Emits one `Link: rel="profile"` per `dct:conformsTo` value in `.meta`. 32 integration tests green.

## Phase 5j close-out (2026-05-16) — Deferred follow-ups

### Architectural — schedule per Rung 1.5 evidence

- [ ] **Framing-2 refactor: drop wiki:*Affordance classes for pure PROF typing.**
  Affordances currently carry BOTH `a wiki:WriteAffordance` AND
  `a prof:ResourceDescriptor; prof:hasRole wikirole:*` (Framing 1.5
  additive, shipped in Phase 5j close-out). Pure-PROF refactor would
  retire the `wiki:*Affordance` classes from `wiki.ttl`, update any
  SHACL shapes or queries that target those classes, and possibly
  enrich the wikirole vocabulary further if eval shows agents reading
  those roles. Decision criterion: Rung 1.5 evidence of whether agents
  branch on `prof:hasRole` vs `rdf:type wiki:*Affordance`.

### Code findings to clean up

- [ ] **css/config/profile-link.json may be deletable.** Task 16 consolidated
  the profile-link Override into memento.json (Components.js forbids
  multiple Override declarations against the same component instance).
  If profile-link.json no longer carries any non-redundant config, delete
  it and remove the import from solid-config.json. Verify CSS still starts
  cleanly after deletion.

- [ ] **Apply.py body-triple vs .meta divergence.** Plan Tasks 6/7 added
  `dct:conformsTo` to RDF resource bodies for self-documentation, but
  CSS only reads `.meta` sidecar triples into `RepresentationMetadata`.
  Apply.py compensates by PATCHing `.meta` on every apply (Task 17 fix,
  idempotent). Long-term cleaner: either (a) drop the body declarations
  since they're redundant for header emission, or (b) build a
  MetadataReader that surfaces body `dct:conformsTo` into
  `RepresentationMetadata` for RDF resources. Defer decision until more
  body-vs-.meta patterns accumulate.

- [ ] **DCT vocabulary helper for the codebase.** CSS's `DC` export is a
  3-term subset (description/modified/title) and does not include
  conformsTo, references, hasPart, etc. `ProfileLinkMetadataWriter`
  inlined the named-node URI directly. If more DCT-using extensions are
  added, consider publishing a shared `vocab/dct.ts` helper or a
  project-wide constant module.

### Confirmation of close-out

- [x] **PROF descriptor installation via overlay machinery** — done via
  `overlay:installsProfile` + apply.py upload step.
- [x] **`Link: rel="profile"` MetadataWriter CSS extension** — done via
  `css/extensions/profile-link/` + Components.js wiring in memento.json.

## AddressBook substrate sprint (2026-05-17)

D87 + D88 ratified. Substrate shipped + agent-discoverable. Cross-batch
adversarial review surfaced these items. None are blockers; trim or address
as need arises.

### Future trims (do when justified, not now)

- [ ] **9 capability descriptors with no consumers** (`/vault/meta/capabilities/`):
  5 AddressBook-provided (vcard-individual-substrate, vcard-organization-substrate,
  external-anchor-tracking, contact-discovery, tmpl-vocabulary) + 1 wiki-memory
  (wiki-page-as-unit). All are speculative — built for hypothetical future
  overlays that don't exist yet. Cost-to-carry is ~50 lines of Turtle. Trim
  when a third overlay materializes and we can see which caps actually get
  consumed vs which were YAGNI violations. Cross-batch review identified;
  see `0f1295f..be26866` for sprint commits.

### Coverage gaps (next plan or backlog)

- [ ] **`verify.py` doesn't check bootstrap content, TypeIndex registrations,
  or container `.meta` patches landed correctly.** After `apply_overlay()` runs,
  verify only checks artifacts (containers, shapes, affordances, vocabularies,
  capabilities, templates). Missing: people.ttl/groups.ttl/index.ttl exist,
  TypeIndex contains the registration, container .meta has `ldp:constrainedBy`.
  Add when the next overlay's verify needs them.

- [ ] **`find-by-orcid` affordance not exercised end-to-end** via
  `solid-pod invoke`. E2E test falls back to direct GET+parse because the
  CLI isn't on PATH in the test runner. Add a proper affordance-invocation
  integration test when the AddressBook skill plan lands (the skill needs to
  exercise affordances anyway, so this work folds into that plan).

- [ ] **`org-find-by-ror` SPARQL test is too weak** — checks `owl:sameAs`
  in query text but doesn't verify `vcard:Organization` type-filtering.
  Could quietly accept a Person ORCID match. Two-line test strengthening.

### Cross-batch design lessons (captured for future plans)

- [ ] **Template-to-SHACL agreement tests are non-optional**: the
  AddressBook sprint's `vcard:inAddressBook` IRI bug — templates said
  `</vault/contacts/index.ttl#this>` but SHACL `sh:hasValue` resolved to
  `<https://pod.vardeman.me/contacts/index.ttl#this>` (server-root, not
  vault-root, due to CSS relative-IRI resolution quirk) — would have
  silently broken every agent following the template. Caught by the
  cross-batch review and the new parametric test in
  `tests/test_addressbook_templates.py::test_template_substituted_body_conforms_to_shape`.
  Any overlay that adds templates MUST add the equivalent agreement test.
  Consider hoisting this test pattern to a reusable test helper if a second
  overlay ships templates.

### AddressBook-specific deferred design choices

- [ ] **Person flat-file layout** (`/vault/contacts/Person/<uuid>.ttl` instead
  of design's `/vault/contacts/Person/<uuid>/index.ttl#this`): CSS
  shape-validator rejects sub-container creation within a constrained
  container, blocking the per-Person container approach intended for
  attachment co-location. Two options when attachment use-cases surface:
  (a) add a separate `Photo/` (or per-attachment-type) container with its
  own SHACL constraint; (b) drop `ldp:constrainedBy` on `Person/` and
  validate via a write-handler hook on individual cards instead.

- [ ] **SHACL relative-IRI resolution quirk on Pod**: shape uses
  `sh:hasValue </contacts/index.ttl#this>` which CSS resolves relative to
  server root, not vault root. Sprint resolved this by switching both
  shape and template to absolute IRIs (`<https://pod.vardeman.me/vault/...>`).
  Worth grepping all SHACL shapes in `overlays/*/shapes/` for relative IRI
  patterns and converting to absolute where the resolution would surprise
  agents. Defer until a second overlay shape uses `sh:hasValue` with a
  relative IRI.

- [ ] **Pod owner contact card** — no `/vault/profile/card#me`-linked
  AddressBook entry exists. Addressed by the next plan's `solid-pod
  setup-owner` CLI flow (would mint UUID, PUT card, add `owl:sameAs
  </vault/profile/card#me>`, PATCH people.ttl). Defer to that plan.

### Wiki URI scheme rethink (informed by Swartz)

- [ ] **Revisit wiki entity URIs in light of Aaron Swartz, *A Programmable
  Web: An Unfinished Work* (Synthesis Lectures on the Semantic Web, 2013,
  ed. Hendler).** The AddressBook substrate adopted opaque `UUIDv4` slugs
  for Person/Organization (class-by-class exception to "mnemonic over
  opaque for everything" per `solid-uri-conformance/references/deltas.md`).
  Swartz's positions on URI design (hash-vs-slash pragmatism, Wikipedia
  URLs as a good model, avoiding technical-leakage in URLs, JSON-LD over
  RDF/XML) deserve a careful read before extending the per-class-opacity
  pattern to other wiki entity classes. Specifically: which wiki:Resource
  subclasses have collision/rename risk substantively higher than the
  current name-slug assumption (where wikilink affordance is the design
  centerpiece)? Most likely candidates: none today; the wiki was designed
  for name-slug stability and the Pod-owner controls naming. But the
  question of when to mint opaque slugs for instances (vs vocabularies,
  covered by D84) is open.

  Action when picked up:
  1. Re-fetch Swartz's book (likely CC-licensed; check Hendler's site or
     archive.org) and read Chapter 4-5 specifically on URI design
  2. Synthesize the project's deltas (URI conformance skill), Swartz's
     positions, and the Cool URIs guidance into a single design-doc-level
     URI design principles reference
  3. Per-entity-class opacity audit (where is `UUIDv4` justified beyond
     Person/Org? Where does mnemonic-by-default still hold?)

  Surfaced during the AddressBook design conversation (2026-05-16); flagged
  again at sprint close-out (2026-05-17).

### Confirmation of close-out

- [x] AddressBook substrate shipped — see MEMORY.md ship entry
- [x] D87 + D88 ratified — see `decisions.md`
- [x] 38 commits pushed to origin/main (33dd1d9..be26866)
- [x] Template-to-SHACL agreement test pattern added (commit `04e26ef`)
- [x] Pre-push cleanups (consolidated TypeIndex mechanism, dead code, stale comments)

## Rung 1.4 close (2026-05-15)

### Critical — deferred to Rung 1.5 eval

- [ ] **RQ-Listener-1: Model A preservation across CSS .meta overwrite**.
  `test_agent_enrichment_survives_body_rewrite` xfailed with diagnosis. Mitigation paths:
  - Paths (A) Memento-history read, (B) `.meta.agent` sidecar, (C) PassthroughStore wrap analyzed in `docs/plans/2026-05-15-rq-listener-1-mitigation-design.md`.
  - Path (D) RDF-star triple-level provenance + reification shim explored in `docs/plans/2026-05-15-rdf-star-provenance-exploration.md` — **candidate, not committed**. Avoids the `.meta.agent` sidecar entirely by partitioning substrate vs agent triples via `prov:wasGeneratedBy` annotations on quoted triples. Tooling probe: N3.js ready, CSS conneg ready with overrides, rdflib lacks RDF-star (hard blocker for Python clients) — ~50 LOC reification shim closes that gap by serving classical `rdf:Statement` reification to non-star clients. Decision criteria documented; promotes to D82 only when Rung 1.5 eval evidence justifies.
  Decision criterion (general): if Rung 1.5 eval surfaces real agent-extension use cases (agents PATCHing `.meta` outside the governed set), pick between paths (B) and (D) based on whether per-triple provenance is load-bearing for RLM behavior. If eval shows agents never extend, reframe the xfail as documentation.

### Small — fix when needed

- [x] ~~**WIKI_NS central constant**.~~ **Closed by Phase 5j (D84)**: all `urn:example:wiki#` and port-baked refs migrated to `https://pod.vardeman.me/vault/ontology/wiki#`. If the Pod hostname ever changes, the substitution remains sed-replaceable — but the IRI is now Pod-namespace-authority style, not placeholder. The "central constant" idea no longer applies (predicate IRIs reflect deployment intent, not a future TBD mint).

- [ ] **`foaf:affiliation` frontmatter mapping**.
  PersonShape allows `foaf:affiliation`, `governedPredicates` includes it, but `frontmatterProjection.ts` has no `affiliation:` key. Agents can't set affiliation via body+frontmatter today. Two-line fix when an eval task needs affiliation traversal.

### Documented elsewhere (cross-references)

- **RQ-Pod-4** — Comunica `.meta` traversal gap, workaround documented at `docs/plans/2026-05-15-rq-pod-4-workaround-notes.md`. Decision point: Rung 1.5+ if explicit-source pattern becomes a bottleneck.
- **K2 (triple-hyphen slugs)** — `slug()` doesn't collapse consecutive hyphens. Accepted for v1 in `decisions-index.md`; refinement is post-spike.
- **K3 (`.author` → `dct:contributor`)** — class-hint dispatch can't differentiate concept-contributor from source-creator. Distinct `.creator` class hint is a Rung 1.5+ option.
- **Task 42 (context-driven listener dispatch)** — `wikilinkProjection.ts` uses hardcoded class-hint table instead of reading `/meta/context.jsonld` at runtime. Functionally equivalent; deferred to Rung 1.5 cleanup per D79.

## Owner-identity sprint (2026-05-17)

- **T4 PodOwnerPreferencesShape — sh:targetClass deviation from plan.** The plan specified `sh:targetNode </vault/settings/prefs.ttl#owner>`, but the shape uses `sh:targetClass prefs:PodOwnerPreferences` instead. Class-based targeting matches every other shape in the repo (compare `contact-card.shacl.ttl`) and is resilient to a future change in the prefs resource path. The test data and the prefs-init template (T6) both declare `a prefs:PodOwnerPreferences` on the subject, so the targeting catches the production case. No action needed — captured for the sprint reflection.

- **TLS dev-cert: solid-pod CLI should detect SELF_SIGNED_CERT_IN_CHAIN and either auto-resolve mkcert root CA or emit a clear remediation hint.** T30 cold-session surfaced an agent reaching for `NODE_TLS_REJECT_UNAUTHORIZED=0` (disables verification globally) instead of `NODE_EXTRA_CA_CERTS=$(mkcert -CAROOT)/rootCA.pem` (the D85 correct fix). The mkcert root CA exists at `$(mkcert -CAROOT)/rootCA.pem`, the Pod's cert is correctly signed by it — only documentation + UX of the failure mode were broken. Skill docs were updated to surface the right env var (`solid-agent-skills/skills/solid-{owner-identity,addressbook,wiki-memory-l3}/SKILL.md` Pre-flight section, commit `d430c24`). The deeper fix: `solid-agent-skills/src/lib/http.ts` should (option a) catch Node's `SELF_SIGNED_CERT_IN_CHAIN` error code and rewrite it as `"TLS verification failed against system trust store. If using a mkcert dev cert, run: export NODE_EXTRA_CA_CERTS=\"$(mkcert -CAROOT)/rootCA.pem\""`; or (option b) probe for `$(mkcert -CAROOT)/rootCA.pem` at startup and prepend it to `NODE_EXTRA_CA_CERTS` automatically when the user hasn't set it — zero-config dev ergonomics, no effect on prod since the file doesn't exist there. Picking up post-Rung-1.5.

- **`tmpl:targetResource` `rdfs:comment` over-constrains** (T6 code review). The vocab entry says *"Used for PATCH templates..."* but `prefs-init.ttl` proves PUT-on-fixed-IRI is equally valid. Broaden to: *"The specific resource a filled template is applied to, for templates that target a known IRI rather than minting a slug under a container. Works with both PUT (creating at a fixed path) and PATCH (modifying an existing resource)."* Lives in `overlays/addressbook/vocabulary/template.ttl`. Pick up next time the AddressBook vocab is touched; bumps `cap:tmpl-vocabulary` to v1.2.

- **`tmpl:Template` XOR invariant unenforced by SHACL** (T1 code review). The vocab `rdfs:comment` says exactly one of `tmpl:targetContainer` / `tmpl:targetResource` must be present, but this is documentation-only. Per-template tests in T6 (`assert not container` for prefs-init) and T7 (`assert not container` for webid-enrich) cover the immediate risk for this sprint's templates. A `TemplateShape` `sh:NodeShape` with `sh:xone` over the two predicates would enforce substrate-wide and surface in any future template's ValidationReport. Low-priority — current discipline is two assertions in test files.

## Path constraint primary-topic-only rdf:type extraction (post-Bug-E)

Bug E (2026-05-19) fixed a false positive where container `.meta`
PATCHes were rejected because `rdf:type` was extracted from ALL
subjects in the body. The current fix skips path constraint
checks entirely for `.meta` resources (Option 1).

The cleaner long-term fix is Option 2: restrict `rdf:type`
extraction to the primary-topic subject (the resource IRI or its
hash fragment). This would let the substrate enforce path
constraints on `.meta` content with precision, in case an L4 use
case demands it.

Effort: ~30 min in checkPathConstraint + new unit tests.

## Pre-existing test/build debt (surfaced during the D107 migration, 2026-05-28 — NOT migration-caused)

- **`test_wiki_memory_l3_discovery.py::test_wiki_containers_exist`** asserts the pre-D98 container names `pages`/`sources` (404 — D98 renamed `pages`→`concepts`, merged `sources`). Stale test; update to the D98 7-container set. Confirmed pre-existing (the rename predates this work; the test only surfaced because it's a live-Pod integration test rarely run green).
- **`test_synthesis_page.py::test_all_wiki_memory_shape_agent_instructions_reference_synthesis`** fails: `overlays/wiki-memory/shapes/howto.shacl.ttl`'s `sh:agentInstruction` does not reference the synthesis URL (`/vault/wiki/index.md`). Pre-existing coverage gap (howto shape untouched by D107). Either add the synthesis ref to the howto shape, or relax the test's "every shape" requirement.
- **`build:esm` is broken** in `css/extensions/markdown-projection`: `npm run build` = `build:esm && build:cjs`, and `build:esm` (default `tsconfig.json`, `moduleResolution: NodeNext`) cannot resolve `src-cjs/listener.ts`'s deep `@solid/community-server/dist/*` imports (TS2307) + an extension-less relative import (TS2835). The ESM output (`dist/`) is gitignored and **unused by CSS** (loader uses `dist-cjs` per `package.json` main/require/lsd:components). D107 Phase 3 worked around it by pointing the Dockerfile at `npm run build:cjs` (commit `90e2c9d`). Proper fix: either repair `build:esm` (add `.js` extensions + fix deep-import resolution) or drop the unused ESM build from the `build` script. Low priority (output unused), but `npm run build` failing locally is a footgun.

**D107 residual (optional, from final review 2026-05-28):** the substrate audit-shape *node identifiers* in `shapes/substrate/` are still `wiki:`-named (`wiki:StorageDescriptionShape`, `wiki:AffordanceDescriptorShape`, `wiki:SearchAffordanceShape`) though they're substrate-level shapes targeting `sub:`/`prof:` classes correctly. Renaming the shape IDs to `sub:` wasn't in D107 scope (they're internal identifiers, not governed predicates or served vocabulary) — slight residual of the same contamination class. Low-value rename-churn; do only if touching those files anyway. Also pending: refresh the upstream-skill delta docs that still name moved predicates (`solid-storage-description`, `solid-data-modelling`, `solid-affordance-descriptors`, `shacl-shapes` — they reference `wiki:typeIndex`/`wiki:shapeCatalog`/etc.).

## Pre-existing (earlier rungs)

- **RQ-Harness-1** — fabric namespace minting at `https://cogitarelink.org/ns/fabric#` — blocks all `fabric:*` predicates past prototype.
- **RQ-Eval-1/2/3** — task suite design, sub-agent config, GEPA convergence (Rung 1.5 work).
- **RQ-Memento-1/2**, **RQ-Federation-1** — see `decisions-index.md`.
