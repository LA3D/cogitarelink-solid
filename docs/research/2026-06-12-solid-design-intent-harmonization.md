# Harmonizing the probe results with Solid's design intent (pre-SP2 grounding pass)

**Purpose** (Chuck, 2026-06-12): before writing the SP2 plan, put the original Solid design
intent — the SAI/interoperability spec, Shape Trees, the W3C WG state, and Verborgh's design
arc — back in context; synthesize it with our experimental results; and close two SP2 forks
(write-contract **Turtle-first**, the **configured-client** question) on that grounding.

**Sources (live-fetched 2026-06-12 + vault):**
- SAI spec: solid.github.io/data-interoperability-panel/specification/ (CG draft, 2025-09-17,
  v0.1) + application primer.
- Shape Trees: github.com/shapetrees/specification (`index.bs`, w3c/ED; ontology 2020-07-01).
- W3C: Linked Web Storage WG charter (2024-09); **LWS Protocol 1.0 FPWD 2026-03-31**
  (w3.org/TR/lws10-core/); auth-suite FPWDs 2026-04.
- Verborgh: *Paradigm Shifts* (2017), *Shaping Linked Data Apps* (2019), *Re-decentralizing
  the Web* (2019), *Let's talk about pods* (2022), *No more raw data* (2023), *The Web's data
  triad* (2024) — ruben.verborgh.org; vault notes under `03 - Resources/` (External Resources +
  Literature: `@verborgh-2022-lets-talk-about-pods`, `@dedecker-2022-whats-in-a-pod`,
  `@verborgh-2023-trust-envelopes`, `W3C Standards/SAI`, `W3C Standards/Shape Trees`).
- In-repo: `docs/research/2026-06-08-solid-view-mechanism-vs-profiles.md` (verified *What's in
  a Pod?* reading), `ontology/README.md` (D109 §5 basis).

## 1. The upstream landscape, as of 2026-06

- **The standards track is narrower than our stack.** The Solid WG was chartered as the
  **Linked Web Storage WG**; its sole normative deliverable is **LWS Protocol 1.0** (FPWD
  2026-03-31, from Solid Protocol 0.11 + Fedora API). **SAI, Shape Trees, and Type Index are
  all NOT WG deliverables** — SAI is a CG draft (99+ open issues, relitigating its data
  model), Shape Trees is an Editor's Draft frozen since 2021 with the `st:references`
  enforcement implemented **nowhere**, Type Index is a CG ED but is what actually ships.
  There is no spec-side pressure to choose between Type Index and SAI.
- **SAI's intended consumption path is NOT exploratory.** The owner-side chain (WebID
  `interop:hasRegistrySet` → registries → DataRegistrations → `registeredShapeTree`) is a
  *declaration* the spec deliberately makes access-controllable (§3: the Registry Set is a
  separate resource from the profile *so it can be protected*). The app-side path never walks
  it: an app goes WebID → `interop:hasAuthorizationAgent` → (HTTP Link rel
  `interop#registeredAgent`) → its own Application Registration → Access/Data Grants (§7.1,
  §9). Discovery is **grant-mediated through an Authorization Agent runtime** — which exists
  as a reference implementation (`sai-js`) and in no production deployment; Inrupt shipped a
  simpler VC-grants model instead. SAI says **nothing** about how an agent orients in a pod:
  no indexes, no progressive disclosure, no cold-start story.
- **Shape Trees**: namespace is **plural** `…/ns/shapetrees#` (spec body + ontology) — our
  usage is conformant; the singular range in SAI's cached `interop.ttl` is *upstream* drift.
  `st:NonRDFResource` is first-class (unlike SAI, which is all-Turtle/LDP throughout and
  silent on non-RDF). The spec's consumption model is *enforcement machinery* (plant/unplant,
  `st:Manager`, server-side validation interception) — our declaration-only subset
  (`st:shape`→SHACL, no Manager) is deliberate, and the research confirms nobody runs the
  full machinery. `st:Description` is specified as **human-facing** ("describe a ShapeTree to
  a *user* in scenarios like authorization or **data listings**").

## 2. Verborgh's design arc, compressed to what SP2 needs

1. **Apps are stateless views; the pod is the authoritative state** (*Shifts* 2017,
   *Redecentralize* 2019). "Applications *ask* rather than *store*."
2. **The pod is a hybrid contextualized knowledge graph**; documents are *derived* URL↔graph
   mappings, "each triple can be assigned to multiple documents"; he explicitly calls for a
   **"view definition language and a view processor"** (*Pods* 2022). [= ViewAssembler D113.]
3. **Footprints inform *writing* only, not reading; reading is link-following** (*Shapes*
   2019). Shapes are the interop contract — "a shape is not an end point but a connection
   point" — published as Linked Data for reuse.
4. **Indexes are legitimate but derived**: "the document `lastnames.ttl` serves as a
   searchable index of all contacts" (*Shapes*); virtualized views replace manual index
   maintenance (*Pods*). His Type-Index critique: registries that clients must "maintain
   faithfully" re-conflate document-primacy — **derive discoverability server-side** instead.
5. **Servers must enforce; never rely on "clients' goodwill"** (*Triad* 2024). Pods should
   expose **multiple read interfaces per client group** — as different interfaces/URLs, not
   negotiation — "single interfaces cannot simultaneously optimize for clients reading one
   fact versus those accessing bulk data."
6. **No more raw data** (2023): responses should carry **trust envelopes** — data +
   provenance + policy + signature; derived *claims* with provenance instead of raw values.

## 3. Harmonization — probes × intent

| Probe result (2026-06) | Upstream intent | Verdict |
|---|---|---|
| Cold agents don't bootstrap pod-delivered dispositions (E5 0/3); definition-line index routes 20–30× (idxview); skill channel closes the leak (SP1 3/3) | SAI has **no orientation story at all** (grant-mediated, AA runtime); Verborgh: derive discoverability, `lastnames.ttl`-style indexes | **Gap-fill, not deviation.** Our Ad/An index views + skill channel occupy a hole the specs leave open; the derived `index.md` child IS Verborgh's index pattern, validated |
| **Write twin probe**: floor is the load-bearing quality station; required-or-derived only — zero volunteered `prov:*` even with the disposition | Verborgh *Triad*: "servers enforce, never clients' goodwill"; *Raw*: every response wrapped in provenance/policy | **Empirical rediscovery of the design intent.** The agentic write contract (MUST describe writes) is the construct-side of trust envelopes; the read-side fused governed-context + audit disposition is the consume-side |
| H0: agents follow `describedby` robustly; conneg works; `?_profile=` selection **never reached** (H0/H1/E8) | *What's in a Pod?* uses **no** PROF/conneg-by-profile — views are different URLs over one graph; *Triad*'s "multiple interfaces" = interface families, not negotiation | **The strip-back is Verborgh-aligned.** Views-as-named-resources (index.md, fused, Person view) over views-as-negotiation |
| Generalization probe: execution generalizes via CLI (Comunica); curl tier enumerates — a genuine tier boundary | *Shifts*: "interfaces become queries", client-side query engines bridge varying pod interface expressivity | **Tier boundary is by design.** D3/D29 (SPARQL client-side) is the *Shifts* architecture; don't fight it |
| E7/E5b: grounding channel teaches — dereferenceable, content-laden vocabulary definitions do instruction work | *Shapes*/*Redecentralize*: shapes + layered agreements published as Linked Data are the contract medium | **Ground-now policy (D109) validated from both sides** |
| D112/twin: agents satisfy shapes minimally at the property level | Shape Trees: validation is the server's job (plant/Manager interception) | Same conclusion, different machinery: we enforce via the D108 floor (SHACL over `.meta`/body) instead of the unimplemented ST runtime — a **documented subset**, not a gap |

**One place we extend intent (record it, don't hide it):** `st:Description` is specified
human-facing; we consume it agent-facing for app orientation. "Data listings" in the spec's
own use-case list is adjacent — this is an extension of audience, not of semantics. Likewise
SAI's registries: we seed the owner-side declarations *per spec §3* (including
`hasRegistrySet` on the WebID card — our planned fix is exactly conformant), but our
consumer is a skill-equipped cold agent reading them directly under dev-allow-all, not an
Authorization Agent — legitimate today (the AA runtime is nowhere in production), and the
spec's access-control intent means **the RegistrySet is NOT Layer-0 material**: under the
security profile it becomes a protected resource, so the anonymous orientation surface must
not depend on it.

## 4. Fork landings

### 4a. Turtle-first (CONFIRMED, now grounded)

The write contract lands on **RDF-native lanes first** — `.operations/` ledgers, `/id/`,
`/contacts/`, probe-style app containers — and the markdown/projection lane follows once D82
(`.meta.agent` sidecar) ships. Grounding: (i) every upstream contract is RDF-native — SAI is
all-Turtle and silent on non-RDF; ST's validation algorithm assumes shape+focus-node over
RDF; Verborgh's shapes/footprints operate on the graph. The markdown lane is *our* hybrid-
graph realization (D58 dual-layer), where the upstream gives no contract to conform to and
where D82 bites. (ii) The twin probe ran on exactly the Turtle lane and the floor mechanics
held end-to-end (zero Pod-side failures). (iii) D73 is preserved: `working/` low-ceremony;
contract attaches at crystallization. The markdown extension is a **named SP2 follow-on
gated on D82**, not a silent omission.

### 4b. Configured-client (DECIDED: drop the selection machinery)

The strip-back removes `?_profile=` *selection* and `alt`; keeps `rel="profile"` +
`dct:conformsTo` + PROF descriptors as hints + `?_profile=fused` (aggregation). Grounding:
the hypothesized configured-client class does not exist on any current trajectory — SAI's
Authorization Agent does grant-mediated LDP, not conneg-by-profile; LWS standardizes
neither; no DCAT-harvester/OGC consumer is in this Pod's audience; and H0/H1/E8 showed the
selection layer is unreachable even for capable agents. Verborgh's "multiple interfaces per
client group" argument (*Triad*) is satisfied the way he means it — **add derived views at
named URLs via the ViewAssembler** (more interfaces), not negotiation on one URL. If a
configured-client class ever arrives, the re-entry path is a new derived view + a profile
*hint*, both of which we keep. (This honors D86's provenance: the hint half validated, the
selection half served a client that never arrived.)

## 5. Deltas to the SP2 block list (from this pass)

1. **RegistrySet ≠ Layer-0**: seed `hasRegistrySet` on the WebID card (spec-conformant), but
   the anonymous orientation surface (storage description → agent guide → index views) must
   not route *through* the registries — they are access-controllable by design. Layer-0
   orientation and An-layer declarations are separate disclosure tiers.
2. **No ST runtime**: do not build plant/Manager/`st:managedBy` machinery — nobody else has;
   our floor (D108) is the enforcement; keep `st:shape`→SHACL declarations as the documented
   subset. Record the `st:Description` audience extension in the overlay README.
3. **Namespace stance**: keep plural `shapetrees#`; annotate the SAI `interop.ttl` singular
   range as upstream drift (already in `ontology/shapetrees.ttl` header — point the SP2
   surfacing commit at it).
4. **Write contract = trust-envelope construct side**: phrase the §6 contract's spec text in
   these terms (provenance + purpose travel with the data); the read-side fused view is the
   envelope's delivery. Aligns the contract with where Verborgh is pushing (2023–24) rather
   than only our L2 invariants.
5. **Watch LWS**: substrate tracks CSS/Solid Protocol 0.11; LWS Protocol 1.0 (FPWD) is the
   eventual conformance target — no action in SP2, but the plan should name it so the next
   conformance pass checks against it.

**Net:** the probes did not contradict the original design intent anywhere; in three places
(server-side enforcement, derived indexes, views-as-URLs) they empirically rediscovered it,
and in two places (cold orientation, agent-facing st:Description) we fill or extend gaps the
specs acknowledge or leave open. SP2 can proceed on the existing block list with the five
deltas above; the two forks are closed (Turtle-first; drop selection machinery). The third
fork — **prov:agent derivation timing** — was closed same day (Chuck, 2026-06-12):
**DEFER to the security profile**, recorded as a named SP2 follow-on. Rationale: D112
already scoped identity-derivation as activating with auth, and a derived placeholder
identity under dev-allow-all asserts provenance the substrate cannot warrant — which cuts
against the trust-envelope framing this pass landed on (provenance must be *warrantable*,
not just present).
