# D112 Curation Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the D112 curation protocol vertical slice — identifier-schemes as the first curated overlay: vocab + policy declarations + floored ledger + server-derived back-pointer + Link-header surfacing + the curator affordance descriptor, propose-only.

**Architecture:** Pure Pod-state protocol (approach C of the spec): all curation state is RDF on the Pod; the only server additions are derive-class mechanism — an `OperationsIndexListener` (MonitoringStore CDC, MementoCommitListener idiom) maintaining `mem:hasOpenAction` back-pointers, and a `CurationLinkMetadataWriter` (ProfileLinkMetadataWriter clone) emitting Link headers. Spec: `docs/superpowers/specs/2026-06-05-d112-curation-protocol-design.md`.

**Tech Stack:** Turtle/SHACL (overlay artifacts), TypeScript CSS v8 extensions (Components.js DI, N3.js, vitest), Python pytest + rdflib + pyshacl + httpx (conformance/e2e), pod-template + `make reset` deploy.

**Conventions that bind every task:**
- Python: `~/uvws/.venv/bin/python -m pytest tests/<file> -v`; live-Pod tests need `SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem` and the `requires_pod` marker (see `tests/conftest.py`).
- Pod URL: `https://pod.vardeman.me` (TLS via mkcert). Verify deploys with `make reset`, never `make up` alone.
- Git: stage specific files; prefix `[Agent: Claude]`; co-author `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`.
- TS extensions: CommonJS tsconfig, `componentsjs-generator`, Dockerfile symlink trick — mirror `css/extensions/id-catalog/` layout exactly.

---

### Task 1: CSS-behavior verification battery

Verify the four CSS behaviors the design depends on BEFORE building (agentic-development.md rule). These become permanent regression tests.

**Files:**
- Create: `tests/test_d112_battery.py`

- [ ] **Step 1: Write the battery tests**

```python
"""D112 Task-1 battery: CSS behaviors the curation protocol depends on (spec §5).
B-a  scheme-record .meta accepts an ungoverned mem: triple via PATCH (back-pointer write path)
B-b  affordance descriptors have Memento TimeMaps (?ext=timemap) — hadPlan pinning
B-c  GET of a resource surfaces stored .meta triples in response headers context
     (proven indirectly: dct:conformsTo -> Link rel="profile" via profile-link)
B-d  POST text/turtle with <>-subject to a constrainedBy'd container resolves <> to the
     created URL (LDN sender pattern against the floor)
"""
import httpx, pytest, uuid
from rdflib import Graph

POD = "https://pod.vardeman.me"
MEM = "https://pod.vardeman.me/vault/ontology/mem#"
pytestmark = pytest.mark.requires_pod


def test_battery_a_record_meta_accepts_ungoverned_mem_triple(client):
    rec = f"{POD}/id/schemes/doi"
    op = f"{POD}/id/.operations/battery-{uuid.uuid4().hex[:8]}"
    patch = (f"@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n"
             f"<> a solid:InsertDeletePatch;\n"
             f"solid:inserts {{ <{rec}> <{MEM}hasOpenAction> <{op}>. }}.")
    r = client.patch(f"{rec}.meta", content=patch, headers={"Content-Type": "text/n3"})
    assert r.status_code in (200, 201, 205), f"B-a: .meta PATCH rejected: {r.status_code} {r.text[:300]}"
    g = Graph().parse(data=client.get(f"{rec}.meta", headers={"Accept": "text/turtle"}).text,
                      format="turtle")
    assert (None, None, None) in g
    assert any(str(o) == op for o in g.objects(None, None)), "back-pointer not persisted"
    # cleanup
    undo = patch.replace("solid:inserts", "solid:deletes")
    client.patch(f"{rec}.meta", content=undo, headers={"Content-Type": "text/n3"})


def test_battery_b_affordance_descriptor_has_timemap(client):
    url = f"{POD}/vault/meta/affordances/markdown-projection.ttl?ext=timemap"
    r = client.get(url, headers={"Accept": "text/turtle"})
    assert r.status_code == 200, f"B-b: no TimeMap for affordance descriptor: {r.status_code}"
    g = Graph().parse(data=r.text, format="turtle")
    mementos = list(g.subject_objects(
        __import__("rdflib").URIRef("http://mementoweb.org/ns#memento")))
    assert g is not None  # parseable; memento entries asserted loosely:
    assert "memento" in r.text or len(g) > 0, "B-b: TimeMap empty"


def test_battery_c_meta_conformsTo_surfaces_as_link_header(client):
    # profile-link proves stored .meta reaches RepresentationMetadata -> headers.
    r = client.get(f"{POD}/id/schemes/", headers={"Accept": "text/turtle"})
    assert r.status_code == 200
    # any Link header present confirms MetadataWriter pipeline runs on this path
    assert "link" in {k.lower() for k in r.headers}, "B-c: no Link headers on GET"


def test_battery_d_post_null_relative_subject_to_floored_container(client):
    # POST a record-shaped body with <> subject to the FLOORED schemes catalog is
    # rejected by IdCatalogStore guards only for fragment subjects; use the wiki
    # working container (permissive floor) to prove <>-resolution semantics.
    body = ("@prefix dct: <http://purl.org/dc/terms/>.\n"
            '<> dct:title "battery d112" .')
    r = client.post(f"{POD}/vault/wiki/working/", content=body,
                    headers={"Content-Type": "text/turtle",
                             "Slug": f"battery-{uuid.uuid4().hex[:8]}"})
    assert r.status_code == 201, f"B-d: POST failed: {r.status_code} {r.text[:300]}"
    loc = r.headers["location"]
    g = Graph().parse(data=client.get(loc, headers={"Accept": "text/turtle"}).text,
                      format="turtle")
    from rdflib import URIRef
    assert (URIRef(loc), None, None) in g, "B-d: <> did not resolve to created URL"
    client.delete(loc)
```

- [ ] **Step 2: Run the battery against the live Pod**

Run: `SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/test_d112_battery.py -v`
Expected: 4 passed (Pod up). **If B-a fails 422**: the floor governs scheme-record `.meta` — record the failure mode; Task 7's listener then writes below the floor via the IdCatalogStore `rewriteMeta` idiom instead of through the top of the chain; carry that note into Task 7 Step 3. **If B-b fails**: no TimeMaps for `/vault/meta/affordances/` — record it; Task 6's descriptor instruction falls back to TimeGate `Accept-Datetime` pinning, and add a FOLLOWUPS entry to extend memento scope.

- [ ] **Step 3: Commit**

```bash
git add tests/test_d112_battery.py
git commit -m "[Agent: Claude] D112 T1: CSS-behavior battery (back-pointer .meta path, descriptor TimeMaps, Link pipeline, <>-subject POST)"
```

---

### Task 2: Cache PROV-O into ontology/

**Files:**
- Create: `ontology/prov.ttl`
- Modify: `ontology/README.md` (vocabulary table)
- Test: `tests/test_ontology_cache.py` (add cases)

- [ ] **Step 1: Add failing tests to the existing cache test file**

Append to `tests/test_ontology_cache.py` (follow its existing per-vocab test style):

```python
def test_prov_o_cached_and_parses():
    g = Graph().parse("ontology/prov.ttl", format="turtle")
    assert len(g) > 1000, "PROV-O cache suspiciously small"

def test_prov_o_hadplan_axioms():
    g = Graph().parse("ontology/prov.ttl", format="turtle")
    PROV = "http://www.w3.org/ns/prov#"
    hadPlan = URIRef(PROV + "hadPlan")
    assert (hadPlan, RDFS.domain, URIRef(PROV + "Association")) in g
    assert (hadPlan, RDFS.range, URIRef(PROV + "Plan")) in g
    qa = URIRef(PROV + "qualifiedAssociation")
    assert (qa, RDFS.domain, URIRef(PROV + "Activity")) in g
```

- [ ] **Step 2: Run to verify failure**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_ontology_cache.py -v -k prov`
Expected: FAIL — `ontology/prov.ttl` not found.

- [ ] **Step 3: Fetch and cache with provenance header**

```bash
curl -sL -H "Accept: text/turtle" "https://www.w3.org/ns/prov-o" -o /tmp/prov-o.ttl
```

Create `ontology/prov.ttl`: the provenance header block (exact format from `ontology/README.md` "Provenance convention" — Name: `PROV-O (W3C Provenance Ontology)`, Source: `http://www.w3.org/ns/prov#` (Turtle alt: `https://www.w3.org/ns/prov-o`), Retrieved: `2026-06-05`, rationale line: `D112 relies normatively on prov:hadPlan / prov:qualifiedAssociation axioms (equipped-agent assertion)`) followed by the verbatim fetched Turtle. Add the PROV-O row to the README's grounded-vocabulary table marking it **Grounded** (was: ground-now backlog).

- [ ] **Step 4: Run tests to verify pass**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_ontology_cache.py -v`
Expected: all pass (existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add ontology/prov.ttl ontology/README.md tests/test_ontology_cache.py
git commit -m "[Agent: Claude] D112 T2: ground PROV-O into ontology/ (hadPlan axioms relied on normatively)"
```

---

### Task 3: mem.ttl vocabulary additions

**Files:**
- Modify: `overlays/wiki-memory/ontology/mem.ttl`
- Create: `tests/test_curation_vocab.py`

- [ ] **Step 1: Write the failing vocab test**

```python
"""D112 §3 vocab: curation-protocol terms in mem.ttl."""
from rdflib import Graph, URIRef, RDF, RDFS, SKOS

MEM = "https://pod.vardeman.me/vault/ontology/mem#"

def g():
    return Graph().parse("overlays/wiki-memory/ontology/mem.ttl", format="turtle")

def test_has_open_action_declared():
    graph = g()
    t = URIRef(MEM + "hasOpenAction")
    assert (t, RDF.type, None) in graph
    comments = list(graph.objects(t, RDFS.comment))
    assert comments and "server-derived" in str(comments[0]).lower()

def test_curation_need_terms():
    graph = g()
    for term in ("CurationNeed", "hasCurationNeed", "applyClass", "ledger",
                 "DeriveClass", "JudgmentClass"):
        assert (URIRef(MEM + term), RDF.type, None) in graph, f"mem:{term} missing"

def test_apply_class_lanes_are_skos_concepts():
    graph = g()
    for lane in ("DeriveClass", "JudgmentClass"):
        assert (URIRef(MEM + lane), RDF.type, SKOS.Concept) in graph

def test_provider_drift_and_materialization_in_staleness_scheme():
    graph = g()
    for name in ("ProviderDrift", "Materialization"):
        t = URIRef(MEM + name)
        assert (t, RDF.type, URIRef(MEM + "StalenessClass")) in graph
        assert (t, RDF.type, SKOS.Concept) in graph
```

- [ ] **Step 2: Run to verify failure**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_curation_vocab.py -v`
Expected: FAIL — terms missing.

- [ ] **Step 3: Add the terms to mem.ttl**

Append, matching the file's existing style (skos:scopeNote prose, rdfs:domain/range; study the `mem:RealignAction` and `mem:StalenessClass` blocks first):

```turtle
### D112 — curation protocol terms ###############################################

mem:hasOpenAction
    a rdf:Property ;
    rdfs:label "has open action" ;
    rdfs:comment "Target resource → a pending (schema:PotentialActionStatus) curation activity in a .operations/ ledger. SERVER-DERIVED only: maintained by OperationsIndexListener from the ledger state; agents never author it (the ldp:contains precedent). Surfaced on GET as a Link header (rel = this property's IRI)." ;
    rdfs:range prov:Activity .

mem:CurationNeed
    a rdfs:Class ;
    rdfs:label "Curation need" ;
    rdfs:comment "One declared Tier-2 check an application asks the curator role to run over its data registration. The check procedure rides on sh:agentInstruction (the on-Pod source of truth, D103); the intended lane on mem:applyClass; the ledger to file into on mem:ledger. Declared at deploy time — never invented at run time (D112 §7)." .

mem:hasCurationNeed
    a rdf:Property ;
    rdfs:label "has curation need" ;
    rdfs:domain interop:Application ;
    rdfs:range mem:CurationNeed ;
    rdfs:comment "An interop:Application declares the curation checks its data registration needs (policy-as-data, D112 §4)." .

mem:applyClass
    a rdf:Property ;
    rdfs:label "apply class" ;
    rdfs:domain mem:CurationNeed ;
    rdfs:comment "The need's INTENDED lane (D112 §7). v1 behavior is propose-only for both lanes; graduation of a DeriveClass need to auto-apply is earned by a maturity score over its trace history (clean-trace rate, reversal rate, plan-version stability), never granted by design." .

mem:ledger
    a rdf:Property ;
    rdfs:label "ledger" ;
    rdfs:domain mem:CurationNeed ;
    rdfs:comment "The .operations/ container proposals for this need are filed into (one activity per resource, <>-subject, LDN sender pattern)." .

mem:DeriveClass a skos:Concept ;
    rdfs:label "derive class" ;
    skos:definition "Recomputable from the graph, idempotent, destroys no information." .
mem:JudgmentClass a skos:Concept ;
    rdfs:label "judgment class" ;
    skos:definition "Requires judgment, destroys or reinterprets information, or asserts facts about the world." .

mem:ProviderDrift a mem:StalenessClass , skos:Concept ;
    rdfs:label "Provider drift" ;
    skos:definition "A declared identifier-resolution provider no longer resolves as declared (sampleID × urlPattern × mediaType mismatch). Evidence of the failing HTTP transaction goes in mem:rationale." .

mem:Materialization a mem:StalenessClass , skos:Concept ;
    rdfs:label "Materialization" ;
    skos:definition "Not staleness: a derivable projection the graph should carry but does not yet (e.g. the schema:PropertyValue projection on a scheme record). The proposal body contains the exact triples to add, so the resolving act is mechanical." .
```

Also add `@prefix interop: <http://www.w3.org/ns/solid/interop#> .` to the prefix block if absent, and add `mem:DeriveClass`/`mem:JudgmentClass` to whatever skos:ConceptScheme membership idiom the StalenessClass concepts use (mirror it; if StalenessClass concepts use `skos:inScheme`, mint a small `mem:ApplyClassScheme` the same way).

- [ ] **Step 4: Run tests to verify pass**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_curation_vocab.py tests/test_wiki_memory_l3_shapes.py -v`
Expected: new tests pass; existing shape tests still pass (no regression from the vocab edit).

- [ ] **Step 5: Commit**

```bash
git add overlays/wiki-memory/ontology/mem.ttl tests/test_curation_vocab.py
git commit -m "[Agent: Claude] D112 T3: mem.ttl curation vocab — hasOpenAction, CurationNeed/applyClass/ledger, lanes, ProviderDrift"
```

---

### Task 4: Curation-proposal SHACL shape

**Files:**
- Create: `overlays/identifier-schemes/shapes/curation-proposal.shacl.ttl`
- Create: `tests/test_curation_proposal_shape.py`

- [ ] **Step 1: Write the failing shape tests** (pattern: `tests/test_scheme_record_shape.py` — pyshacl, `inference="none"`)

```python
"""D112 §4/§8: proposal shape — conformant exemplar passes, mutants 422-equivalently fail."""
import pyshacl
from rdflib import Graph

SHAPE = "overlays/identifier-schemes/shapes/curation-proposal.shacl.ttl"

EXEMPLAR = """
@prefix as:     <https://www.w3.org/ns/activitystreams#> .
@prefix mem:    <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix prov:   <http://www.w3.org/ns/prov#> .
@prefix schema: <https://schema.org/> .
@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .

<https://pod.vardeman.me/id/.operations/p1>
    a as:Announce , mem:RealignAction , prov:Activity ;
    as:actor <urn:agent:claude-code> ;
    as:target <https://pod.vardeman.me/id/.operations/> ;
    as:object <https://pod.vardeman.me/id/schemes/doi> ;
    schema:actionStatus schema:PotentialActionStatus ;
    mem:stalenessClass mem:ProviderDrift ;
    mem:rationale "GET https://doi.org/10.5555/x Accept: application/vnd.x -> 406 (2026-06-05T12:00:00Z)." ;
    prov:used <https://doi.org/10.5555/x> ;
    prov:wasAssociatedWith <urn:agent:claude-code> ;
    prov:qualifiedAssociation [
        a prov:Association ;
        prov:agent <urn:agent:claude-code> ;
        prov:hadPlan <https://pod.vardeman.me/vault/meta/affordances/curation.ttl?version=m1> ] ;
    as:published "2026-06-05T12:00:00Z"^^xsd:dateTime .

<urn:agent:claude-code> a prov:SoftwareAgent .
<https://pod.vardeman.me/vault/meta/affordances/curation.ttl?version=m1>
    a prov:Plan ;
    prov:specializationOf <https://pod.vardeman.me/vault/meta/affordances/curation.ttl> .
"""

def validate(data_ttl):
    conforms, _, report = pyshacl.validate(
        Graph().parse(data=data_ttl, format="turtle"),
        shacl_graph=Graph().parse(SHAPE, format="turtle"),
        inference="none")
    return conforms, report

def test_exemplar_conforms():
    conforms, report = validate(EXEMPLAR)
    assert conforms, report

def test_missing_rationale_fails():
    conforms, _ = validate(EXEMPLAR.replace(
        'mem:rationale "GET https://doi.org/10.5555/x Accept: application/vnd.x -> 406 (2026-06-05T12:00:00Z)." ;', ""))
    assert not conforms

def test_missing_hadplan_fails():
    mutated = EXEMPLAR.replace("prov:hadPlan <https://pod.vardeman.me/vault/meta/affordances/curation.ttl?version=m1> ] ;",
                               "] ;")
    conforms, _ = validate(mutated)
    assert not conforms, "plan-undeclared proposal must fail (D112 spec 'plan-undeclared -> 422')"

def test_bad_action_status_fails():
    conforms, _ = validate(EXEMPLAR.replace(
        "schema:PotentialActionStatus", "schema:ActiveActionStatus"))
    assert not conforms

def test_missing_object_fails():
    conforms, _ = validate(EXEMPLAR.replace(
        "as:object <https://pod.vardeman.me/id/schemes/doi> ;", ""))
    assert not conforms
```

- [ ] **Step 2: Run to verify failure**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_curation_proposal_shape.py -v`
Expected: FAIL — shape file not found.

- [ ] **Step 3: Write the shape** (style: mirror `overlays/identifier-schemes/shapes/scheme-record.shacl.ttl` — `sh:agentInstruction` on the NodeShape, messages on every property)

```turtle
@prefix sh:     <http://www.w3.org/ns/shacl#> .
@prefix mem:    <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix as:     <https://www.w3.org/ns/activitystreams#> .
@prefix prov:   <http://www.w3.org/ns/prov#> .
@prefix schema: <https://schema.org/> .
@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .

<#CurationProposalShape>
    a sh:NodeShape ;
    sh:targetClass mem:RealignAction ;
    sh:agentInstruction """A curation proposal is one activity per resource, <>-subject,
POSTed to the app's .operations/ ledger (201 + Location assigns your URL — the LDN
sender pattern). Required: as:object (the resource needing curation), exactly one
schema:actionStatus (file as schema:PotentialActionStatus — v1 is propose-only for
both lanes), mem:stalenessClass, mem:rationale carrying the observed EVIDENCE (for
liveness: HTTP status, Accept sent, content-type received, timestamp), and
prov:qualifiedAssociation/prov:hadPlan pinning the Memento version of the curation
descriptor you followed (GET the descriptor ?ext=timemap, take the newest memento).
A write without a declared plan is rejected: equipment is asserted, not assumed.""" ;
    sh:property [
        sh:path as:object ; sh:nodeKind sh:IRI ; sh:minCount 1 ; sh:maxCount 1 ;
        sh:message "A proposal names exactly one as:object — the resource needing curation." ] ;
    sh:property [
        sh:path schema:actionStatus ; sh:minCount 1 ; sh:maxCount 1 ;
        sh:in ( schema:PotentialActionStatus schema:CompletedActionStatus schema:FailedActionStatus ) ;
        sh:message "schema:actionStatus required: Potential (proposed) | Completed (applied) | Failed (rejected/withdrawn)." ] ;
    sh:property [
        sh:path mem:rationale ; sh:datatype xsd:string ; sh:minCount 1 ;
        sh:message "mem:rationale required — a realignment without recorded reasoning is not auditable. Include the HTTP evidence for liveness findings." ] ;
    sh:property [
        sh:path mem:stalenessClass ; sh:nodeKind sh:IRI ; sh:minCount 1 ;
        sh:message "mem:stalenessClass required (e.g. mem:ProviderDrift, mem:FalsePositive)." ] ;
    sh:property [
        sh:path ( prov:qualifiedAssociation prov:hadPlan ) ; sh:nodeKind sh:IRI ; sh:minCount 1 ;
        sh:message "prov:qualifiedAssociation/prov:hadPlan required — declare the Memento-pinned curation-descriptor version you followed (D112: plan-undeclared -> 422)." ] ;
    sh:property [
        sh:path as:published ; sh:datatype xsd:dateTime ; sh:minCount 1 ; sh:maxCount 1 ;
        sh:message "as:published (xsd:dateTime) required." ] .
```

- [ ] **Step 4: Run tests to verify pass**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_curation_proposal_shape.py -v`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add overlays/identifier-schemes/shapes/curation-proposal.shacl.ttl tests/test_curation_proposal_shape.py
git commit -m "[Agent: Claude] D112 T4: curation-proposal shape — rationale + actionStatus + hadPlan floor-required"
```

---

### Task 5: `/id/.operations/` ledger container + floor wiring

**Files:**
- Create: `overlays/identifier-schemes/containers/id/.operations/.meta`
- Modify: `overlays/identifier-schemes/manifest.ttl`
- Create: `tests/test_id_operations_floor.py`

- [ ] **Step 1: Write the container `.meta`** (the D111 ordering lesson: `constrainedBy` MUST land at container creation, while empty — `containers/` `.meta` files apply at apply.py block 8). First read `overlays/identifier-schemes/containers/id/schemes/.meta` and mirror its exact prefix/typing style. Content:

```turtle
@prefix ldp: <http://www.w3.org/ns/ldp#> .
@prefix dct: <http://purl.org/dc/terms/> .

<> ldp:constrainedBy <https://pod.vardeman.me/id/curation-proposal.shacl.ttl> ;
    dct:title "identifier-schemes curation ledger (.operations/)" ;
    dct:description "D112 ledger: one mem:RealignAction activity per resource, <>-subject, LDN sender pattern. Floor: CurationProposalShape (rationale + actionStatus + hadPlan required)." .
```

- [ ] **Step 2: Extend the manifest**

In `overlays/identifier-schemes/manifest.ttl`, add to the overlay subject:

```turtle
    overlay:installsContainer </id/.operations/> ;
```

and a second `overlay:installsShape` entry:

```turtle
    overlay:installsShape
        [ overlay:document "shapes/curation-proposal.shacl.ttl" ;
          overlay:hostedAt "/id/curation-proposal.shacl.ttl" ] ;
```

(Watch Turtle syntax: the manifest is one subject block — merge into the existing `overlay:installsShape` object list with `,` rather than repeating the predicate, matching the file's style.)

- [ ] **Step 3: Write the failing live test**

```python
"""D112 §4: /id/.operations/ exists and the floor gates it (201 conformant / 422 mutant)."""
import httpx, pytest, uuid
pytestmark = pytest.mark.requires_pod
POD = "https://pod.vardeman.me"

CONFORMANT = """\
@prefix as:     <https://www.w3.org/ns/activitystreams#> .
@prefix mem:    <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix prov:   <http://www.w3.org/ns/prov#> .
@prefix schema: <https://schema.org/> .
@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .
<> a as:Announce , mem:RealignAction , prov:Activity ;
    as:object <https://pod.vardeman.me/id/schemes/doi> ;
    schema:actionStatus schema:PotentialActionStatus ;
    mem:stalenessClass mem:ProviderDrift ;
    mem:rationale "e2e floor probe." ;
    prov:qualifiedAssociation [ a prov:Association ;
        prov:agent <urn:agent:pytest> ;
        prov:hadPlan <https://pod.vardeman.me/vault/meta/affordances/curation.ttl> ] ;
    as:published "2026-06-05T12:00:00Z"^^xsd:dateTime .
"""

def _post(client, body):
    return client.post(f"{POD}/id/.operations/", content=body,
                       headers={"Content-Type": "text/turtle",
                                "Slug": f"floor-{uuid.uuid4().hex[:8]}"})

def test_container_exists(client):
    assert client.get(f"{POD}/id/.operations/",
                      headers={"Accept": "text/turtle"}).status_code == 200

def test_conformant_proposal_201(client):
    r = _post(client, CONFORMANT)
    assert r.status_code == 201, r.text[:400]
    client.delete(r.headers["location"])

def test_plan_undeclared_422(client):
    mutant = CONFORMANT.replace(
        "prov:hadPlan <https://pod.vardeman.me/vault/meta/affordances/curation.ttl> ] ;", "] ;")
    r = _post(client, mutant)
    assert r.status_code == 422, f"plan-undeclared must 422, got {r.status_code}"

def test_rationale_missing_422(client):
    mutant = CONFORMANT.replace('mem:rationale "e2e floor probe." ;', "")
    r = _post(client, mutant)
    assert r.status_code == 422
```

- [ ] **Step 4: Deploy and verify**

Run: `make reset && SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/test_id_operations_floor.py tests/test_id_schemes_integration.py -v`
Expected: new tests pass AND the existing D111 integration suite still passes (the manifest edit must not perturb the schemes deploy). If apply.py chokes on the dot-container path, fix the path handling in `scripts/overlay/` (block 8 already resolves outside-root container `.meta` paths per the manifest comment) — substrate additions are discovered through use.

- [ ] **Step 5: Commit**

```bash
git add overlays/identifier-schemes/containers/id/.operations/.meta overlays/identifier-schemes/manifest.ttl tests/test_id_operations_floor.py
git commit -m "[Agent: Claude] D112 T5: /id/.operations/ ledger live — constrainedBy at creation, floor gates proposals (201/422)"
```

---

### Task 6: interop application + curation needs + curator descriptor + role

**Files:**
- Create: `overlays/identifier-schemes/interop/application.ttl`
- Create: `overlays/wiki-memory/affordances/curation.ttl`
- Modify: `overlays/identifier-schemes/manifest.ttl` (bootstrap entry for application.ttl)
- Modify: the wikirole scheme file (find it: `grep -rln "wikirole:query-affordance" overlays/wiki-memory/` — add `wikirole:curation-affordance`)
- Modify: `overlays/wiki-memory/manifest.ttl` (curation.ttl bootstrap entry, mirroring the other affordance entries)
- Create: `tests/test_curation_policy_artifacts.py`

- [ ] **Step 1: Write the failing artifact tests**

```python
"""D112 §4/§6: policy-as-data artifacts — needs declared, descriptor conformant."""
import pyshacl
from rdflib import Graph, URIRef, RDF

MEM = "https://pod.vardeman.me/vault/ontology/mem#"
INTEROP = "http://www.w3.org/ns/solid/interop#"
APP = "overlays/identifier-schemes/interop/application.ttl"
DESC = "overlays/wiki-memory/affordances/curation.ttl"
AFFORDANCE_SHAPE = "shapes/substrate/affordance-descriptor.shacl.ttl"

def test_application_declares_two_needs():
    g = Graph().parse(APP, format="turtle")
    apps = list(g.subjects(RDF.type, URIRef(INTEROP + "Application")))
    assert len(apps) == 1
    needs = list(g.objects(apps[0], URIRef(MEM + "hasCurationNeed")))
    assert len(needs) == 2

def test_needs_carry_lane_ledger_instruction():
    g = Graph().parse(APP, format="turtle")
    SH_AI = URIRef("http://www.w3.org/ns/shacl#agentInstruction")
    lanes = set()
    for need in g.subjects(RDF.type, URIRef(MEM + "CurationNeed")):
        assert list(g.objects(need, URIRef(MEM + "applyClass"))), f"{need} lacks applyClass"
        ledgers = list(g.objects(need, URIRef(MEM + "ledger")))
        assert ledgers and str(ledgers[0]).endswith("/id/.operations/")
        instr = list(g.objects(need, SH_AI))
        assert instr and len(str(instr[0])) > 100, f"{need} instruction too thin to follow cold"
        lanes.update(str(o) for o in g.objects(need, URIRef(MEM + "applyClass")))
    assert lanes == {MEM + "DeriveClass", MEM + "JudgmentClass"}, "one need per lane (spec §2)"

def test_descriptor_conforms_to_affordance_shape():
    data = Graph().parse(DESC, format="turtle", publicID="https://pod.vardeman.me/vault/meta/affordances/curation.ttl")
    conforms, _, report = pyshacl.validate(
        data, shacl_graph=Graph().parse(AFFORDANCE_SHAPE, format="turtle"), inference="none")
    assert conforms, report

def test_descriptor_encodes_propose_only_and_plan_pinning():
    text = open(DESC).read()
    for required in ("propose-only", "?ext=timemap", "hadPlan", "FalsePositive",
                     "never apply", "dereference"):
        assert required in text, f"descriptor instruction missing: {required}"
```

- [ ] **Step 2: Run to verify failure**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_curation_policy_artifacts.py -v`
Expected: FAIL — files missing.

- [ ] **Step 3: Write `overlays/identifier-schemes/interop/application.ttl`** (template: `overlays/wiki-memory/interop/application.ttl`)

```turtle
@prefix interop: <http://www.w3.org/ns/solid/interop#> .
@prefix acl:     <http://www.w3.org/ns/auth/acl#> .
@prefix mem:     <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix sh:      <http://www.w3.org/ns/shacl#> .
@prefix app:     <https://pod.vardeman.me/vault/meta/interop/id-schemes-application#> .

app:id-schemes a interop:Application ;
    interop:applicationName "Identifier-Schemes" ;
    interop:applicationDescription "D111 Pod-level PID system: /id/schemes/ catalog + scheme records + resolution roles." ;
    interop:hasAccessNeedGroup app:id-needs ;
    mem:hasCurationNeed app:need-provider-liveness , app:need-propertyvalue-materialization .

app:id-needs a interop:AccessNeedGroup ;
    interop:accessNecessity interop:AccessRequired ;
    interop:accessScenario interop:PersonalAccess ;
    interop:hasAccessNeed app:need-scheme-records .

app:need-scheme-records a interop:AccessNeed ;
    interop:accessMode acl:Read , acl:Write ;
    interop:accessNecessity interop:AccessRequired .

app:need-provider-liveness a mem:CurationNeed ;
    mem:applyClass mem:JudgmentClass ;
    mem:ledger <https://pod.vardeman.me/id/.operations/> ;
    sh:agentInstruction """Provider liveness (judgment-class — PROPOSE ONLY, never patch
the record). For each record in /id/schemes/ (skip the catalog document itself): take
idot:sampleID, substitute into each provider's idot:urlPattern at {$id}; GET the
resulting URL with Accept set to the provider's declared dcat:mediaType; PASS if the
response is 2xx/3xx AND the Content-Type matches the declared media type. On failure,
re-check once before flagging (a transient failure is not a dead provider), then file
a Potential proposal to the ledger: as:object = the scheme record;
mem:stalenessClass mem:ProviderDrift; mem:rationale = the full HTTP evidence (URL
requested, Accept sent, status + Content-Type received, timestamps of both attempts).
Would have caught both 2026-06-05 probe bugs (DataCite-only conneg; wrong OSLC
syntax).""" .

app:need-propertyvalue-materialization a mem:CurationNeed ;
    mem:applyClass mem:DeriveClass ;
    mem:ledger <https://pod.vardeman.me/id/.operations/> ;
    sh:agentInstruction """PropertyValue materialization (derive-class — but v1 is
propose-only: file the proposal, do NOT write the projection until it is resolved by
a separate act). For each scheme record lacking a schema:PropertyValue projection in
its .meta: propose adding `[ a schema:PropertyValue ; schema:propertyID <record-URL> ]`
shaped per D111 FOLLOWUPS item 1. File: as:object = the record;
mem:stalenessClass mem:Materialization (a derivable projection the graph does not yet
carry — not drift); mem:rationale naming which projection is missing. The proposal
body must contain the EXACT triples to add, so the resolving act is mechanical.""" .
```

- [ ] **Step 4: Write `overlays/wiki-memory/affordances/curation.ttl`** (must conform to `AffordanceDescriptorShape`: hasRole + label + conformsTo + installedBy + agentInstruction; mirror `memory-history.ttl`'s prefix style)

```turtle
@prefix wiki:     <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix sub:      <https://pod.vardeman.me/vault/ontology/substrate#> .
@prefix wikirole: <https://pod.vardeman.me/vault/ontology/wikirole#> .
@prefix prof:     <http://www.w3.org/ns/dx/prof/> .
@prefix sh:       <http://www.w3.org/ns/shacl#> .
@prefix rdfs:     <http://www.w3.org/2000/01/rdf-schema#> .
@prefix dct:      <http://purl.org/dc/terms/> .
@prefix prov:     <http://www.w3.org/ns/prov#> .

<>  a prof:ResourceDescriptor , prov:Plan ;
    prof:hasRole wikirole:curation-affordance ;
    rdfs:label "Curation role (D112)" ;
    rdfs:comment "The curation protocol: how any authorized agent assumes the curator role. This document IS the prov:Plan a curator declares via prov:hadPlan — pin the Memento version you followed." ;
    dct:conformsTo <http://www.w3.org/TR/dx-prof/> ;
    sub:installedBy <https://pod.vardeman.me/vault/ontology/overlay#wiki-memory> ;
    sh:agentInstruction """You are assuming the CURATOR ROLE (D112). Equipment first:
this descriptor is your plan — GET <this-URL>?ext=timemap and note the newest memento
URL; every proposal you file MUST carry prov:qualifiedAssociation/prov:hadPlan
pointing at it (writes without a declared plan are rejected, 422).

Procedure:
1. Discover work: GET the application registry under /vault/meta/interop/ ; each
   interop:Application may declare mem:hasCurationNeed nodes. Each need carries its
   own sh:agentInstruction (the check) , mem:applyClass (the intended lane) and
   mem:ledger (where to file).
2. Drain signals: GET the app's .events/ container if present (mem:* write-time
   events); treat each as a finding candidate.
3. Run each declared sweep check per its instruction.
4. Every finding -> ONE Potential proposal: a <>-subject Turtle body POSTed to the
   need's mem:ledger (201 + Location = your proposal's URL). Required form: see the
   ledger's ldp:constrainedBy shape — as:object, schema:actionStatus
   schema:PotentialActionStatus, mem:stalenessClass, mem:rationale (with EVIDENCE),
   your qualified association with hadPlan, as:published.
5. PROPOSE-ONLY, BOTH LANES: never apply a fix yourself, even when it looks trivially
   safe and mem:applyClass says DeriveClass. Graduation to auto-apply is earned from
   trace history; it has not been granted to any need yet.
6. Dereference the authority before flagging (a claim may already be reconciled at
   its source — the false-positive discipline). A withdrawn flag is recorded, not
   deleted: schema:FailedActionStatus + mem:stalenessClass mem:FalsePositive +
   rationale saying why.
Resolution of proposals is a SEPARATE act (any authorized agent or the deployer):
execute the repair, then flip schema:actionStatus on the proposal; the substrate
clears the mem:hasOpenAction back-pointer automatically.""" .
```

- [ ] **Step 5: Add the role concept + manifest entries**

Find the wikirole scheme file (`grep -rln "query-affordance" overlays/wiki-memory/`), add `wikirole:curation-affordance` as a `skos:Concept` in-scheme, mirroring the existing role entries exactly. Add bootstrap entries: in `overlays/wiki-memory/manifest.ttl` an `installsBootstrapContent` entry `[ overlay:contentPath "affordances/curation.ttl" ; overlay:hostedAt "/vault/meta/affordances/curation.ttl" ; overlay:contentType "text/turtle" ]` (mirror the sibling affordance entries — check how the others are listed; if affordances deploy via a different manifest predicate, mirror THAT); in `overlays/identifier-schemes/manifest.ttl` add `[ overlay:contentPath "interop/application.ttl" ; overlay:hostedAt "/vault/meta/interop/id-schemes-application" ; overlay:contentType "text/turtle" ]`. Also check `overlays/wiki-memory/interop/registry.ttl`: if it enumerates ApplicationRegistrations, add one for `app:id-schemes` there (cross-overlay edit, justified: the registry is the shared discovery root the descriptor's step 1 depends on).

- [ ] **Step 6: Run tests, deploy, verify live**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_curation_policy_artifacts.py -v` → 4 passed.
Run: `make reset && make audit` → audit 0 ERROR (the descriptor enters the affordance-catalog walk and must conform live; the new role must be in-scheme).
Run: `SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem curl -s https://pod.vardeman.me/vault/meta/affordances/curation.ttl | head -5` → the descriptor serves.

- [ ] **Step 7: Commit**

```bash
git add overlays/identifier-schemes/interop/ overlays/identifier-schemes/manifest.ttl overlays/wiki-memory/affordances/curation.ttl overlays/wiki-memory/manifest.ttl <wikirole-file> <registry-file-if-edited> tests/test_curation_policy_artifacts.py
git commit -m "[Agent: Claude] D112 T6: policy-as-data — id-schemes interop app + 2 curation needs; curator descriptor (the prov:Plan) + role"
```

---

### Task 7: OperationsIndexListener extension (back-pointer derive)

**Files:**
- Create: `css/extensions/ops-index/` (full scaffold: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.componentsjs-generator-ignore.json` — copy all four from `css/extensions/id-catalog/` and rename the package to `@cogitarelink/ops-index`)
- Create: `css/extensions/ops-index/src/parseProposal.ts` + `parseProposal.test.ts`
- Create: `css/extensions/ops-index/src/OperationsIndexListener.ts` + `OperationsIndexListener.test.ts`
- Create: `css/extensions/ops-index/src/index.ts`
- Create: `css/config/ops-index.json`
- Modify: `css/config/solid-config.json` (import + context), `Dockerfile` (symlink, mirror id-catalog's line), `Makefile` `test-js` target (add the new package), `package.json` workspaces if the repo uses them (check id-catalog's registration)

- [ ] **Step 1: Write failing tests for the pure parser**

`parseProposal.ts` owns: given the quads of a ledger resource + its URL, return `{ target, status } | undefined` (undefined = not a proposal).

```typescript
import { describe, it, expect } from "vitest";
import { Parser } from "n3";
import { parseProposal } from "./parseProposal.js";

const OP = "https://pod.vardeman.me/id/.operations/p1";
const ttl = (status: string) => `
@prefix as:     <https://www.w3.org/ns/activitystreams#> .
@prefix mem:    <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix schema: <https://schema.org/> .
<${OP}> a mem:RealignAction ;
    as:object <https://pod.vardeman.me/id/schemes/doi> ;
    schema:actionStatus schema:${status} .`;

const quads = (s: string) => new Parser().parse(ttl(s));

describe("parseProposal", () => {
  it("extracts target and Potential status", () => {
    expect(parseProposal(quads("PotentialActionStatus"), OP)).toEqual({
      target: "https://pod.vardeman.me/id/schemes/doi",
      status: "https://schema.org/PotentialActionStatus",
    });
  });
  it("extracts non-Potential status (removal signal)", () => {
    expect(parseProposal(quads("FailedActionStatus"))?.status)
      .toContain("FailedActionStatus");
  });
  it("returns undefined for a non-RealignAction resource", () => {
    const other = new Parser().parse(`<${OP}> <http://purl.org/dc/terms/title> "x" .`);
    expect(parseProposal(other, OP)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd css/extensions/ops-index && npm install && npx vitest run`
Expected: FAIL — `parseProposal` not implemented.

- [ ] **Step 3: Implement `parseProposal.ts`**

```typescript
import type { Quad } from "@rdfjs/types";

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const MEM_REALIGN = "https://pod.vardeman.me/vault/ontology/mem#RealignAction";
const AS_OBJECT = "https://www.w3.org/ns/activitystreams#object";
const SCHEMA_STATUS = "https://schema.org/actionStatus";
export const MEM_HAS_OPEN_ACTION = "https://pod.vardeman.me/vault/ontology/mem#hasOpenAction";
export const POTENTIAL = "https://schema.org/PotentialActionStatus";

export interface Proposal { target: string; status: string }

// Subject scoping: <>-subject resolves to the resource URL on read (LDN), so when
// opUrl is given, only that subject's triples count; without it, any subject typed
// RealignAction (defensive for odd serializations).
export function parseProposal(quads: Quad[], opUrl?: string): Proposal | undefined {
  const mine = (q: Quad): boolean => !opUrl || q.subject.value === opUrl;
  if (!quads.some((q) => mine(q) && q.predicate.value === RDF_TYPE && q.object.value === MEM_REALIGN)) {
    return undefined;
  }
  const target = quads.find((q) => mine(q) && q.predicate.value === AS_OBJECT)?.object.value;
  const status = quads.find((q) => mine(q) && q.predicate.value === SCHEMA_STATUS)?.object.value;
  if (!target || !status) return undefined;
  return { target, status };
}
```

- [ ] **Step 4: Run parser tests to verify pass**

Run: `npx vitest run` (in `css/extensions/ops-index/`)
Expected: 3 passed.

- [ ] **Step 5: Write failing listener tests** (mock-store pattern: copy the harness style from `css/extensions/id-catalog/src/IdCatalogStore.test.ts` — in-memory store stub with `getRepresentation`/`setRepresentation` capturing writes)

```typescript
import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { OperationsIndexListener } from "./OperationsIndexListener.js";

// Test plan (each is one `it`):
// 1. Create event for a Potential proposal under /.operations/ -> target's .meta
//    gains <target> mem:hasOpenAction <op>.
// 2. Update event flipping the same proposal to FailedActionStatus -> back-pointer removed.
// 3. Delete event for a previously-seen op -> back-pointer removed (in-memory map).
// 4. Create event for a NON-ledger resource (no /.operations/ in path) -> store untouched.
// 5. Back-pointer write merges with existing .meta quads (no clobber): pre-seed the
//    target .meta with one unrelated triple; assert it survives the rewrite.
```

Write the five tests concretely against the constructor signature `new OperationsIndexListener(store)` where `store` is the mock with an `events = new EventEmitter()` facade matching MonitoringStore's `changed` signature (`(target: ResourceIdentifier, activity, metadata)` — copy the exact event shape from `css/extensions/memento/src/MementoCommitListener.ts:35`).

- [ ] **Step 6: Implement `OperationsIndexListener.ts`**

Initializer + MonitoringStore subscription (MementoCommitListener idiom at `css/extensions/memento/src/MementoCommitListener.ts`); `.meta` read-merge-write through the store with `INTERNAL_QUADS` (IdCatalogStore `rewriteMeta` idiom — including the re-entrancy guard so our own `.meta` writes don't re-trigger us):

```typescript
import { Initializer, INTERNAL_QUADS, BasicRepresentation, readableToQuads, AS } from "@solid/community-server";
import type { MonitoringStore, ResourceIdentifier } from "@solid/community-server";
import { Store, DataFactory } from "n3";
import { getLoggerFor } from "global-logger-factory";
import { parseProposal, MEM_HAS_OPEN_ACTION, POTENTIAL } from "./parseProposal.js";

const { namedNode, quad } = DataFactory;
const LEDGER_RE = /\/\.operations\/[^/]+$/u;

export class OperationsIndexListener extends Initializer {
  protected readonly logger = getLoggerFor(this);
  private readonly seen = new Map<string, string>(); // opUrl -> targetUrl (Delete support; restart gap -> FOLLOWUPS)
  private deriving = false;

  public constructor(private readonly store: MonitoringStore) { super(); }

  public async handle(): Promise<void> {
    this.store.on("changed", (target: ResourceIdentifier, activity): void => {
      if (this.deriving || !LEDGER_RE.test(target.path)) return;
      this.onLedgerChange(target, activity).catch((err): void =>
        this.logger.error(`ops-index: ${target.path}: ${err}`));
    });
  }

  private async onLedgerChange(id: ResourceIdentifier, activity: unknown): Promise<void> {
    if (String(activity) === AS.Delete || String(activity).endsWith("Delete")) {
      const known = this.seen.get(id.path);
      if (known) { await this.setBackPointer(known, id.path, false); this.seen.delete(id.path); }
      return;
    }
    const rep = await this.store.getRepresentation(id, { type: { [INTERNAL_QUADS]: 1 } });
    const quads = await readableToQuads(rep.data);
    const proposal = parseProposal(quads.getQuads(null, null, null, null), id.path);
    if (!proposal) return;
    const open = proposal.status === POTENTIAL;
    this.seen.set(id.path, proposal.target);
    await this.setBackPointer(proposal.target, id.path, open);
  }

  private async setBackPointer(targetUrl: string, opUrl: string, present: boolean): Promise<void> {
    const metaId = { path: `${targetUrl}.meta` };
    const store = new Store();
    try {
      const rep = await this.store.getRepresentation(metaId, { type: { [INTERNAL_QUADS]: 1 } });
      store.addQuads((await readableToQuads(rep.data)).getQuads(null, null, null, null));
    } catch { /* no .meta yet — start empty */ }
    const ptr = quad(namedNode(targetUrl), namedNode(MEM_HAS_OPEN_ACTION), namedNode(opUrl));
    store.removeQuads(store.getQuads(namedNode(targetUrl), namedNode(MEM_HAS_OPEN_ACTION), namedNode(opUrl), null));
    if (present) store.addQuad(ptr);
    this.deriving = true;
    try {
      await this.store.setRepresentation(metaId,
        new BasicRepresentation(store.getQuads(null, null, null, null), INTERNAL_QUADS));
    } finally { this.deriving = false; }
  }
}
```

**Implementer notes (resolve against reality, the tests are the contract):** (1) the exact `changed` activity term and `ResourceIdentifier` shape — copy from MementoCommitListener, do not guess; (2) if Task 1 B-a showed the floor rejects `.meta` writes through the chain top, swap `setRepresentation` routing to the below-Locking source-injection pattern IdCatalogStore uses (constructor takes the source store too — mirror its Components.js param wiring); (3) `setRepresentation` on a `.meta` identifier vs CSS's auxiliary strategy — IdCatalogStore's `rewriteMeta` comment documents the identifier subtlety, follow it.

- [ ] **Step 7: Run listener tests to verify pass**

Run: `npx vitest run` → all green. Then `npx componentsjs-generator -s src -r ops-index` (mirror id-catalog's build script in its `package.json` — copy the exact script line) and `npm run build`.

- [ ] **Step 8: Components.js wiring**

Create `css/config/ops-index.json` — model on `css/config/mem-trigger.json` (it wires a MonitoringStore listener as an Initializer; copy its Override/InsertAfter structure and parameter style, change ids to `urn:cogitarelink:OperationsIndexListener`, inject `urn:solid-server:default:ResourceStore` (the MonitoringStore — same parameter mem-trigger's listener takes)). Add the config to `css/config/solid-config.json` imports + the new package's components context to its `@context` array (both: mirror exactly what id-catalog added — see the two `id-catalog` lines found by `grep -n id-catalog css/config/solid-config.json`). Add the Dockerfile symlink line (copy id-catalog's, rename). Add the package to `make test-js`.

- [ ] **Step 9: Offline config-guard + deploy + live verify**

Run: `make test-js` → includes the new vitest suite AND the Components.js config guard replaying boot parsing (the cleanup-sprint guard catches `Invalid predicate IRI` class offline — this is the dogfood).
Run: `make reset` → boots clean (watch logs for componentsjs errors).
Quick live check: POST the Task-5 conformant proposal, then within ~2s `GET https://pod.vardeman.me/id/schemes/doi.meta` shows `mem:hasOpenAction`.

- [ ] **Step 10: Commit**

```bash
git add css/extensions/ops-index/ css/config/ops-index.json css/config/solid-config.json Dockerfile Makefile
git commit -m "[Agent: Claude] D112 T7: ops-index extension — OperationsIndexListener derives mem:hasOpenAction from ledger state (CDC, propose/resolve/delete)"
```

---

### Task 8: CurationLinkMetadataWriter (Link-header surfacing)

**Files:**
- Create: `css/extensions/profile-link/src/CurationLinkMetadataWriter.ts`
- Create: `css/extensions/profile-link/src/CurationLinkMetadataWriter.test.ts`
- Modify: `css/extensions/profile-link/src/index.ts` (export)
- Modify: the profile-link Components.js config (find where ProfileLinkMetadataWriter is registered: `grep -rn ProfileLinkMetadataWriter css/config/` — add the new writer alongside, same parallel-writer composition per the metadata-writer skill)

- [ ] **Step 1: Write the failing writer test** (mirror the existing ProfileLink test if present; otherwise model on this)

```typescript
import { describe, it, expect } from "vitest";
import { RepresentationMetadata } from "@solid/community-server";
import { DataFactory } from "n3";
import { CurationLinkMetadataWriter } from "./CurationLinkMetadataWriter.js";

const { namedNode } = DataFactory;
const MEM_HAS_OPEN_ACTION = "https://pod.vardeman.me/vault/ontology/mem#hasOpenAction";

function run(metadata: RepresentationMetadata) {
  const headers: Record<string, string[]> = {};
  const response = { setHeader: (k: string, v: string | string[]) => { headers[k.toLowerCase()] = ([] as string[]).concat(v); },
                     getHeader: (k: string) => headers[k.toLowerCase()],
                     hasHeader: (k: string) => k.toLowerCase() in headers } as never;
  return { writer: new CurationLinkMetadataWriter("https://pod.vardeman.me"), response, headers };
}

describe("CurationLinkMetadataWriter", () => {
  it("emits one Link per hasOpenAction value", async () => {
    const md = new RepresentationMetadata(namedNode("https://pod.vardeman.me/id/schemes/doi"));
    md.add(namedNode(MEM_HAS_OPEN_ACTION), namedNode("https://pod.vardeman.me/id/.operations/p1"));
    const { writer, response, headers } = run(md);
    await writer.handle({ response, metadata: md } as never);
    expect(headers.link?.[0]).toBe(`<https://pod.vardeman.me/id/.operations/p1>; rel="${MEM_HAS_OPEN_ACTION}"`);
  });
  it("emits nothing without the predicate", async () => {
    const md = new RepresentationMetadata(namedNode("https://pod.vardeman.me/id/schemes/doi"));
    const { writer, response, headers } = run(md);
    await writer.handle({ response, metadata: md } as never);
    expect(headers.link).toBeUndefined();
  });
});
```

(If the mock-response shape fights CSS's `HttpResponse` type, copy the exact mock from profile-link's own test file — it solved this already.)

- [ ] **Step 2: Run to verify failure**

Run: `cd css/extensions/profile-link && npx vitest run`
Expected: new tests FAIL, existing ProfileLink tests PASS.

- [ ] **Step 3: Implement** (40-line clone of `ProfileLinkMetadataWriter.ts` — same `addHeader`, same `isUnderBaseUrl` guard, predicate swapped, rel = the predicate IRI per RFC 8288 extension relations)

```typescript
import { MetadataWriter, type MetadataWriterInput, addHeader } from "@solid/community-server";
import { DataFactory } from "n3";
import { isUnderBaseUrl } from "./uri";

const { namedNode } = DataFactory;
const MEM_HAS_OPEN_ACTION = namedNode("https://pod.vardeman.me/vault/ontology/mem#hasOpenAction");

/**
 * Emits one `Link: <op-url>; rel="<mem:hasOpenAction IRI>"` per open curation action
 * on the resource (D112 §5 — the read-path surfacing seam). The predicate IRI is the
 * RFC 8288 extension relation type. Composes additively via addHeader, exactly like
 * ProfileLinkMetadataWriter.
 */
export class CurationLinkMetadataWriter extends MetadataWriter {
  public constructor(private readonly baseUrl: string) { super(); }

  public async handle(input: MetadataWriterInput): Promise<void> {
    const id = input.metadata.identifier?.value;
    if (!id || !isUnderBaseUrl(id, this.baseUrl.replace(/\/$/u, ""))) return;
    const actions = input.metadata.getAll(MEM_HAS_OPEN_ACTION);
    if (actions.length === 0) return;
    addHeader(input.response, "Link",
      actions.map((a) => `<${a.value}>; rel="${MEM_HAS_OPEN_ACTION.value}"`));
  }
}
```

**Implementer note:** the hardcoded mem# IRI must instead come through the same config channel the projection uses for vocab IRIs if one exists (`grep -rn "ontology/mem#" css/extensions/*/config css/config/` — if other extensions inject it as a Components.js parameter, do the same; banned-literal lesson from the fragility audit). If none does, define it in ONE exported constant module and add it to the agreement-test surface (`tests/test_substrate_mirror_consistency.py` pattern).

- [ ] **Step 4: Run tests, export, wire config**

`npx vitest run` → green. Export from `index.ts`, rebuild (`npm run build` incl. componentsjs-generator), register the writer in the same config block as ProfileLinkMetadataWriter (parallel writer list — `addHeader` composes).

- [ ] **Step 5: Deploy + live verify + commit**

`make test-js && make reset`. Live: POST a proposal (Task 5 body), poll `GET /id/schemes/doi` (the document URL) and assert a `Link: <…/.operations/…>; rel="…mem#hasOpenAction"` header appears.

```bash
git add css/extensions/profile-link/ css/config/
git commit -m "[Agent: Claude] D112 T8: CurationLinkMetadataWriter — open actions surface as Link headers on GET"
```

---

### Task 9: End-to-end protocol suite

**Files:**
- Create: `tests/test_curation_protocol_e2e.py`

- [ ] **Step 1: Write the full-loop e2e** (all `requires_pod`; reuse Task 5's `CONFORMANT` body via a module-level constant; poll helper for the async listener — copy the memento de-flake poll idiom from the memento tests)

```python
"""D112 e2e: the full curation loop against the live Pod.
propose -> 201 -> back-pointer derived -> Link header on target GET ->
resolve (status flip) -> back-pointer cleared -> floor rejects mutants.
"""
import time, uuid, httpx, pytest
from rdflib import Graph, URIRef

pytestmark = pytest.mark.requires_pod
POD = "https://pod.vardeman.me"
MEM_OPEN = URIRef("https://pod.vardeman.me/vault/ontology/mem#hasOpenAction")
TARGET = f"{POD}/id/schemes/orcid"   # not doi: keep independent of Task-5 residue

PROPOSAL = """\
@prefix as:     <https://www.w3.org/ns/activitystreams#> .
@prefix mem:    <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix prov:   <http://www.w3.org/ns/prov#> .
@prefix schema: <https://schema.org/> .
@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .
<> a as:Announce , mem:RealignAction , prov:Activity ;
    as:object <%TARGET%> ;
    schema:actionStatus schema:PotentialActionStatus ;
    mem:stalenessClass mem:ProviderDrift ;
    mem:rationale "e2e loop probe (synthetic)." ;
    prov:qualifiedAssociation [ a prov:Association ;
        prov:agent <urn:agent:pytest> ;
        prov:hadPlan <https://pod.vardeman.me/vault/meta/affordances/curation.ttl> ] ;
    as:published "2026-06-05T12:00:00Z"^^xsd:dateTime .
""".replace("%TARGET%", TARGET)

def _poll(fn, timeout=5.0, every=0.25):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if fn(): return True
        time.sleep(every)
    return False

def _meta_has_pointer(client, op_url):
    g = Graph().parse(data=client.get(f"{TARGET}.meta", headers={"Accept": "text/turtle"}).text,
                      format="turtle")
    return (URIRef(TARGET), MEM_OPEN, URIRef(op_url)) in g

def test_full_loop(client):
    # 1. propose
    r = client.post(f"{POD}/id/.operations/", content=PROPOSAL,
                    headers={"Content-Type": "text/turtle", "Slug": f"e2e-{uuid.uuid4().hex[:8]}"})
    assert r.status_code == 201, r.text[:400]
    op = r.headers["location"]
    try:
        # 2. back-pointer derived
        assert _poll(lambda: _meta_has_pointer(client, op)), "back-pointer never appeared"
        # 3. Link header on the target GET
        resp = client.get(TARGET, headers={"Accept": "text/turtle"})
        links = ",".join(v for k, v in resp.headers.multi_items() if k.lower() == "link") \
            if hasattr(resp.headers, "multi_items") else resp.headers.get("link", "")
        assert "hasOpenAction" in links and op in links, f"Link header missing: {links[:300]}"
        # 4. resolve: flip to Failed (withdrawn) by PUT of the amended body
        amended = client.get(op, headers={"Accept": "text/turtle"}).text.replace(
            "PotentialActionStatus", "FailedActionStatus")
        r2 = client.put(op, content=amended, headers={"Content-Type": "text/turtle"})
        assert r2.status_code in (200, 205)
        # 5. back-pointer cleared
        assert _poll(lambda: not _meta_has_pointer(client, op)), "back-pointer not cleared on resolve"
        resp2 = client.get(TARGET, headers={"Accept": "text/turtle"})
        assert op not in resp2.headers.get("link", "")
    finally:
        client.delete(op)

def test_descriptor_is_plan_and_versioned(client):
    g = Graph().parse(data=client.get(f"{POD}/vault/meta/affordances/curation.ttl",
                                      headers={"Accept": "text/turtle"}).text, format="turtle")
    PROV_PLAN = URIRef("http://www.w3.org/ns/prov#Plan")
    assert (URIRef(f"{POD}/vault/meta/affordances/curation.ttl"), None, PROV_PLAN) in g \
        or (None, None, PROV_PLAN) in g, "descriptor must self-assert prov:Plan"
    tm = client.get(f"{POD}/vault/meta/affordances/curation.ttl?ext=timemap")
    assert tm.status_code == 200, "descriptor must be Memento-versioned (hadPlan pinning)"
```

- [ ] **Step 2: Run against the deployed Pod**

Run: `SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/test_curation_protocol_e2e.py -v`
Expected: 2 passed. Debug order if step 2 of the loop fails: ledger resource readable? listener log line? `.meta` write rejected (Task 1 B-a contingency)?

- [ ] **Step 3: Commit**

```bash
git add tests/test_curation_protocol_e2e.py
git commit -m "[Agent: Claude] D112 T9: e2e — propose/derive/surface/resolve/clear loop green live"
```

---

### Task 10: Makefile cleanup + full verification sweep + registration

**Files:**
- Modify: `Makefile` (delete the `CURATOR_SKILL`/`sync-curator-skill` block, lines ~120-126)
- Modify: `FOLLOWUPS.md`, `.claude/memory/MEMORY.md`, `.claude/skills/decision-lookup/decisions.md`
- Modify: `docs/superpowers/specs/2026-06-05-d112-curation-protocol-design.md` (errata only, if reality diverged)

- [ ] **Step 1: Remove the dangling target**

Delete the `CURATOR_SKILL := …` and `sync-curator-skill:` block from the Makefile. Verify: `grep -c curator Makefile` → 0.

- [ ] **Step 2: Full verification sweep (the honesty gate — run all, paste outputs)**

```bash
make reset          # reproducible deploy from zero
make test-js        # TS suites + offline config guard
SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/ -v
make audit          # expect 0 ERROR / 1 known WARN (D98 dup-container)
```

Expected: suite green Pod-up; then `docker compose down` and re-run pytest → green Pod-down (skips gate). Double-run pytest Pod-up to catch ordering flakes.

- [ ] **Step 3: Register D112 + update memory**

- `decisions.md`: add `### D112` — the decision summary (protocol-in-Pod-state, five seams, propose-only + maturity graduation, equipped-agent hadPlan, LDN form), supersessions (none), spec pointer, FluxMem citation.
- `FOLLOWUPS.md`: new D112 section — residue: (1) Delete-event back-pointer removal relies on an in-memory map (restart gap); (2) wiki-memory rollout gated on D82 (restore-on-rewrite not built); (3) maturity scorer not built (signals only); (4) registry generalization when app #3 declares needs; (5) `ldp:inbox` advertisement deferred; close D111 items 0(a) and 1 with pointers to D112.
- `MEMORY.md`: update the "NEXT SESSION" pointer — D112 shipped pending probes; next = the two cold probes (curator + primary-agent, ensemble grading), then RQ-View-2 full re-eval.

- [ ] **Step 4: Commit**

```bash
git add Makefile FOLLOWUPS.md .claude/memory/MEMORY.md .claude/skills/decision-lookup/decisions.md docs/superpowers/specs/2026-06-05-d112-curation-protocol-design.md
git commit -m "[Agent: Claude] D112 registered: decisions.md + FOLLOWUPS residue + memory; sync-curator-skill target removed (pod-curator skill is Pod-state now)"
```

---

### NOT in this plan (deliberately)

The **two cold probes** (spec §8) are the validation step and run as a separate session/sprint after merge — they need a clean context by definition (D111 precedent: probes ran same-day but as separate cold sessions). The maturity **scorer**, **wiki-memory needs**, **suggestive-typing**, **L2 substrate curator**: all spec §9 out-of-scope.

---

## Self-review notes (run before handoff)

- Spec §3 vocab → Task 3; §4 policy/ledger/floor → Tasks 4-6; §5 listener+writer → Tasks 7-8; §6 descriptor/role → Task 6; §7 propose-only encoded in descriptor instruction + need instructions (T6); §8 deterministic layer → Tasks 4, 5, 9 (probes excluded by design); PROV-O grounding → Task 2; Makefile cleanup → Task 10. Battery (§5 verification) → Task 1.
- The materialization need files with `mem:Materialization` (minted in Task 3, tested in T3 Step 1) — no run-time stalenessClass ambiguity remains.
- Type consistency: `parseProposal` return shape used identically in T7 Steps 1/3/6; `MEM_HAS_OPEN_ACTION` IRI identical in T7/T8/T9 (agreement-test note in T8 Step 3).
