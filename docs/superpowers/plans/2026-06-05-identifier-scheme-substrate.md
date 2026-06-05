# D111 Identifier-Scheme Substrate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Pod-level persistent-identifier system: a `/id/schemes/` catalog of dereferenceable scheme records whose fragment IRIs serve as RDF literal datatypes, with curl-grade enforcement, a server-derived catalog, authoring affordances, and overlay registration.

**Architecture:** `/id/` is a top-level LDP space in the existing CSS root file store, OUTSIDE the `/vault` storage root (rename-proof datatype IRIs). Scheme records are RDF Sources validated by `SchemeRecordShape` via the existing `ldp:constrainedBy` path; thin catalog entries are server-derived by a new `IdCatalogStore` in the resource-store chain; the markdown grammar's `^^prefix:local` datatype slot gains an `ids:` binding; overlays declare scheme needs via `overlay:registersScheme`.

**Tech Stack:** CSS v8 (Components.js DI), TypeScript/N3.js/vitest (extensions), Python/rdflib/pyshacl/httpx/pytest (client + tests), Turtle.

**Spec (read first):** `docs/superpowers/specs/2026-06-05-identifier-scheme-substrate-design.md` — especially §10 (implementer hazards) and §11 (decision reconciliation). The datatype IRI is `https://pod.vardeman.me/id/schemes/#<key>` (fragment on the CATALOG), never `…/schemes/<key>#this`.

**Conventions used throughout:**
- `POD = https://pod.vardeman.me` (the dev deployment; TLS via mkcert — export `SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem` before Python/curl against it, per `.claude/rules/agentic-development.md`)
- Python: `~/uvws/.venv/bin/python`
- Git: prefix `[Agent: Claude]`, co-author `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`, stage specific files
- The live Pod must be up (`make up`) for live-verification steps; offline steps say so.

---

### Task 1: CSS behavior battery for `/id/` (verify before building)

Per `.claude/rules/agentic-development.md` ("Verify CSS behavior before building anything that depends on it"). No repo changes; findings recorded in the commit message of Task 5 if surprises appear.

**Files:** none (live Pod probes).

- [ ] **Step 1: Verify the Pod is up**

Run: `curl -sk -o /dev/null -w '%{http_code}\n' https://pod.vardeman.me/vault/`
Expected: `200`

- [ ] **Step 2: Create a top-level container outside /vault**

```bash
curl -sk -X PUT https://pod.vardeman.me/id/schemes/ \
  -H 'Content-Type: text/turtle' -o /dev/null -w '%{http_code}\n'
```
Expected: `201` (CSS root file store serves the whole namespace; /vault is just the seeded storage). If `403/405`, STOP — the serving decision needs a config route instead; escalate to the human before proceeding.

- [ ] **Step 3: PUT a probe record + check Memento + .meta behaviors**

```bash
printf '<> <http://purl.org/dc/terms/title> "probe" .' | \
  curl -sk -X PUT https://pod.vardeman.me/id/schemes/probe \
  -H 'Content-Type: text/turtle' --data-binary @- -o /dev/null -w '%{http_code}\n'
curl -skI https://pod.vardeman.me/id/schemes/probe | grep -i -E 'link:.*(timegate|timemap)' | head -2
curl -sk -X PATCH https://pod.vardeman.me/id/schemes/.meta \
  -H 'Content-Type: text/n3' --data-binary '@prefix solid: <http://www.w3.org/ns/solid/terms#>.
<> a solid:InsertDeletePatch; solid:inserts { <> <http://purl.org/dc/terms/title> "probe-meta" . }.' \
  -o /dev/null -w '%{http_code}\n'
```
Expected: `201`; timegate/timemap Link headers present (Memento covers any path under baseUrl); `205` or `200` on the .meta PATCH.

- [ ] **Step 4: Verify constrainedBy is honored OUTSIDE /vault**

```bash
# Point the probe container at an existing strict shape, then write garbage:
curl -sk -X PATCH https://pod.vardeman.me/id/schemes/.meta \
  -H 'Content-Type: text/n3' --data-binary '@prefix solid: <http://www.w3.org/ns/solid/terms#>. @prefix ldp: <http://www.w3.org/ns/ldp#>.
<> a solid:InsertDeletePatch; solid:inserts { <https://pod.vardeman.me/id/schemes/> ldp:constrainedBy <https://pod.vardeman.me/vault/meta/shapes/source.shacl.ttl> . }.' \
  -o /dev/null -w '%{http_code}\n'
printf '<#this> a <https://pod.vardeman.me/vault/ontology/wiki#Source> .' | \
  curl -sk -X PUT https://pod.vardeman.me/id/schemes/bad-probe \
  -H 'Content-Type: text/turtle' --data-binary @- -o /dev/null -w '%{http_code}\n'
```
Expected: `422` on the second PUT (Source without dct:identifier — proves ShapeValidationStore fires outside /vault). If `201`, record the finding: the validator may be path-scoped — investigate `ShapeValidationStore` before Task 5.

- [ ] **Step 5: Clean up probes**

```bash
curl -sk -X DELETE https://pod.vardeman.me/id/schemes/probe -o /dev/null -w '%{http_code}\n'
curl -sk -X DELETE https://pod.vardeman.me/id/schemes/bad-probe -o /dev/null -w '%{http_code}\n'
curl -sk -X DELETE https://pod.vardeman.me/id/schemes/ -o /dev/null -w '%{http_code}\n'
```
Expected: `205`/`404`/`205` (bad-probe never existed if Step 4 worked). No commit for this task.

---

### Task 2: Ground `ontology/idot.ttl` + `ontology/datacite.ttl` (BLOCKING: confirm idot IRI)

**Files:**
- Create: `ontology/idot.ttl`
- Create: `ontology/datacite.ttl`
- Modify: `ontology/README.md` (add two rows + content entries)
- Test: `tests/test_ontology_cache.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_ontology_cache.py  (append if file exists; create otherwise)
from pathlib import Path
from rdflib import Graph

ONT = Path(__file__).parent.parent / "ontology"

def test_idot_cached_and_parses():
    g = Graph().parse(ONT / "idot.ttl", format="turtle")
    assert len(g) > 20
    # the three terms the scheme records use must exist as subjects
    ns = [str(s) for s in g.subjects()]
    for local in ("Namespace", "Resource", "idRegexPattern", "exampleIdentifier", "urlPattern"):
        assert any(s.endswith(local) for s in ns), f"idot term missing: {local}"

def test_datacite_cached_and_parses():
    g = Graph().parse(ONT / "datacite.ttl", format="turtle")
    assert len(g) > 100
    assert any(str(s).endswith("/doi") for s in g.subjects()), "datacite:doi individual missing"
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_ontology_cache.py -v`
Expected: FAIL (FileNotFoundError).

- [ ] **Step 3: BLOCKING — fetch and confirm the idot namespace IRI**

```bash
# Try the candidates; inspect what the vocabulary itself declares:
curl -sL -H 'Accept: text/turtle' https://identifiers.org/idot/ | head -40
curl -sL https://raw.githubusercontent.com/identifiers-org/identifiers-org.github.io/master/data/idot.ttl 2>/dev/null | head -40
curl -sL 'https://bioregistry.io/idot.ttl' | head -40
```
Read the fetched Turtle: the IRI the vocabulary declares for its own terms (e.g. what `idot:Namespace` actually expands to) is the confirmed namespace. **Record it; every later task uses it.** If all candidates are unreachable, fetch the HCLS-referenced copy (search `idot ontology ttl site:github.com`) — do NOT guess; this is the §9.1 blocking sub-step.

- [ ] **Step 4: Cache both files with provenance headers**

Save the fetched vocabularies verbatim, each prefixed with the `ontology/README.md` header block:

```
# identifiers.org types vocabulary (idot) — cached grounding artifact
# Source:    <CONFIRMED-NAMESPACE-IRI>   (Turtle alt: <fetched-URL>)
# Retrieved: <fill with today's actual date>
# Namespace: <CONFIRMED-NAMESPACE-IRI>    prefix: idot
# Status:    v0.3; registry live at registry.identifiers.org
# Use:       D111 scheme records (idot:Namespace/Resource/idRegexPattern/urlPattern/exampleIdentifier)
# Note:      verbatim cache — do not edit term defs; re-pull from source.
```

```bash
curl -sL https://sparontologies.github.io/datacite/current/datacite.ttl -o /tmp/datacite.ttl
# prepend the analogous header (Source: http://purl.org/spar/datacite/), save to ontology/datacite.ttl
```

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_ontology_cache.py -v`
Expected: 2 PASS. If the `idot` term-presence assertions fail because v0.3 names differ (e.g. `accessPattern` instead of `urlPattern`), update BOTH the test and the seed-record vocabulary usage in Task 4 to the actual term names — the cache is the source of truth, not this plan.

- [ ] **Step 6: Update `ontology/README.md`** — add `idot:`/`datacite:` rows to the partitioned-stack table (tier: **GROUNDED**) and two bullets under "Current contents" describing each file (mirror the `interop.ttl` bullet style, cite D111).

- [ ] **Step 7: Commit**

```bash
git add ontology/idot.ttl ontology/datacite.ttl ontology/README.md tests/test_ontology_cache.py
git commit -m "[Agent: Claude] D111: ground idot + datacite vocabularies (confirmed IRIs)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: `SchemeRecordShape` (TDD, offline pyshacl)

**Files:**
- Create: `shapes/substrate/scheme-record.shacl.ttl`
- Test: `tests/test_scheme_record_shape.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_scheme_record_shape.py
from pathlib import Path
from pyshacl import validate
from rdflib import Graph

SHAPE = Path(__file__).parent.parent / "shapes" / "substrate" / "scheme-record.shacl.ttl"
IDOT = "http://identifiers.org/idot/"   # ← replace with the Task-2 CONFIRMED IRI

GOOD = f"""
@prefix idot: <{IDOT}> . @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> . @prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix dct: <http://purl.org/dc/terms/> . @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
<https://pod.vardeman.me/id/schemes/doi> a foaf:Document ;
    dct:title "DOI scheme record" ; foaf:primaryTopic <https://pod.vardeman.me/id/schemes/#doi> .
<https://pod.vardeman.me/id/schemes/#doi> a idot:Namespace, skos:Concept, rdfs:Datatype ;
    skos:prefLabel "DOI"@en ; skos:definition "Digital Object Identifier."@en ;
    idot:idRegexPattern "^10\\\\." ; idot:exampleIdentifier "10.1038/sdata.2018.29" .
"""

def _validate(data: str) -> bool:
    sg = Graph().parse(SHAPE, format="turtle")
    dg = Graph().parse(data=data, format="turtle")
    ok, _, _ = validate(dg, shacl_graph=sg, inference="none")
    return ok

def test_conformant_record_passes():
    assert _validate(GOOD)

def test_missing_regex_fails():
    assert not _validate(GOOD.replace('idot:idRegexPattern "^10\\\\." ;', ""))

def test_missing_primary_topic_fails():
    assert not _validate(GOOD.replace(
        "foaf:primaryTopic <https://pod.vardeman.me/id/schemes/#doi> .",
        "dct:created \"2026-06-05\"^^xsd:date ."))

def test_topic_outside_catalog_namespace_fails():
    assert not _validate(GOOD.replace(
        "https://pod.vardeman.me/id/schemes/#doi", "https://example.org/elsewhere#doi"))

def test_missing_definition_fails():
    assert not _validate(GOOD.replace('skos:definition "Digital Object Identifier."@en ;', ""))
```

- [ ] **Step 2: Run to verify failure**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_scheme_record_shape.py -v`
Expected: FAIL (shape file missing).

- [ ] **Step 3: Write the shape**

```turtle
# shapes/substrate/scheme-record.shacl.ttl
@prefix sh:    <http://www.w3.org/ns/shacl#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix skos:  <http://www.w3.org/2004/02/skos/core#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .
@prefix idot:  <http://identifiers.org/idot/> .   # ← Task-2 CONFIRMED IRI
@prefix wiki:  <https://pod.vardeman.me/vault/ontology/wiki#> .

<> dct:conformsTo <https://www.w3.org/TR/shacl/> .

# SchemeRecordShape — the registration contract for /id/schemes/ records (D111 §7.2).
# Targets the record DOCUMENT (foaf:Document); the topic node carries the scheme
# semantics on the ABSTRACT fragment IRI (D111 §4.3 — never <> as subject for
# scheme triples; never resolveSubject()). Providers are optional: non-resolvable
# schemes are legal (§5.2). The regex is DATA for agents/Tier-2 — this shape
# requires its PRESENCE on the record; it never validates instance literals.
wiki:SchemeRecordShape
    a sh:NodeShape ;
    rdfs:label "Identifier-scheme record contract" ;
    rdfs:isDefinedBy <https://pod.vardeman.me/vault/ontology/wiki> ;
    dct:conformsTo <https://www.w3.org/TR/shacl/> ;
    dct:created "2026-06-05"^^xsd:date ;
    dct:creator <https://orcid.org/0000-0003-4091-6059> ;
    sh:targetClass foaf:Document ;
    sh:agentInstruction """To register a new identifier scheme: PUT one Turtle document to /id/schemes/<key>. The document <> is a foaf:Document with dct:title and foaf:primaryTopic </id/schemes/#<key>> (the abstract scheme IRI -- a fragment on the CATALOG document, used as the datatype of identifier literals). All scheme-describing triples use that abstract IRI as subject, written in full: triple-type it idot:Namespace + skos:Concept + rdfs:Datatype; give skos:prefLabel, skos:definition, idot:idRegexPattern (suggestive syntax -- never enforced on instances), idot:exampleIdentifier. Optionally add provider nodes (idot:Resource with idot:urlPattern using {$id}, dcat:servesDataset back to the scheme, dct:type a role from /id/roles), skos:exactMatch to a DataCite scheme individual, dct:conformsTo for specs. GET /id/schemes/doi for a worked exemplar. The catalog index entry is server-derived from your record -- write nothing else.""" ;
    sh:property [
        sh:path foaf:primaryTopic ;
        sh:minCount 1 ; sh:maxCount 1 ;
        sh:nodeKind sh:IRI ;
        sh:pattern "^https://pod\\.vardeman\\.me/id/schemes/#[A-Za-z][A-Za-z0-9_-]*$" ;
        sh:message "Record must have exactly one foaf:primaryTopic — a fragment IRI on the catalog document (…/id/schemes/#<key>)." ;
        sh:node wiki:SchemeTopicShape
    ] ;
    sh:property [
        sh:path dct:title ; sh:minCount 1 ;
        sh:message "Record document needs dct:title (Page frame)."
    ] .

wiki:SchemeTopicShape
    a sh:NodeShape ;
    rdfs:label "Scheme topic (the abstract scheme)" ;
    sh:property [ sh:path <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ;
        sh:hasValue idot:Namespace ;
        sh:message "Scheme must be typed idot:Namespace." ] ;
    sh:property [ sh:path <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ;
        sh:hasValue skos:Concept ;
        sh:message "Scheme must be typed skos:Concept." ] ;
    sh:property [ sh:path <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ;
        sh:hasValue rdfs:Datatype ;
        sh:message "Scheme must be typed rdfs:Datatype (it IS the literal datatype)." ] ;
    sh:property [ sh:path skos:prefLabel ; sh:minCount 1 ;
        sh:message "Scheme needs skos:prefLabel." ] ;
    sh:property [ sh:path skos:definition ; sh:minCount 1 ;
        sh:message "Scheme needs skos:definition." ] ;
    sh:property [ sh:path idot:idRegexPattern ; sh:minCount 1 ; sh:maxCount 1 ;
        sh:message "Scheme needs idot:idRegexPattern (suggestive syntax — data, not a floor)." ] ;
    sh:property [ sh:path idot:exampleIdentifier ; sh:minCount 1 ;
        sh:message "Scheme needs idot:exampleIdentifier (a worked example)." ] .
```

Note: `sh:targetClass foaf:Document` scopes by class, and the container's `constrainedBy` scopes by location — together exactly the container=gate / class=dispatch model. If Task 2 confirmed a different idot IRI, fix the two `@prefix idot:` lines (test + shape).

- [ ] **Step 4: Run tests to verify they pass**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_scheme_record_shape.py -v`
Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add shapes/substrate/scheme-record.shacl.ttl tests/test_scheme_record_shape.py
git commit -m "[Agent: Claude] D111: SchemeRecordShape — the registration contract (offline pyshacl TDD)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Seed records + roles document (8 records, all shape-validated offline)

**Files:**
- Create: `overlays/identifier-schemes/schemes/{doi,orcid,ror,arxiv,citekey,did,did-oyd,solid-resource}.ttl`
- Create: `overlays/identifier-schemes/roles.ttl`
- Test: `tests/test_scheme_seed_records.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_scheme_seed_records.py
from pathlib import Path
from pyshacl import validate
from rdflib import Graph, URIRef

ROOT = Path(__file__).parent.parent
SHAPE = ROOT / "shapes" / "substrate" / "scheme-record.shacl.ttl"
SEEDS = ROOT / "overlays" / "identifier-schemes" / "schemes"
KEYS = ["doi", "orcid", "ror", "arxiv", "citekey", "did", "did-oyd", "solid-resource"]
BASE = "https://pod.vardeman.me/id/schemes/"

def test_all_eight_seeds_exist():
    assert sorted(p.stem for p in SEEDS.glob("*.ttl")) == sorted(KEYS)

def test_each_seed_conforms_to_shape():
    sg = Graph().parse(SHAPE, format="turtle")
    for k in KEYS:
        dg = Graph().parse(SEEDS / f"{k}.ttl", format="turtle", publicID=f"{BASE}{k}")
        ok, _, report = validate(dg, shacl_graph=sg, inference="none")
        assert ok, f"{k}: {report}"

def test_each_topic_is_catalog_fragment():
    for k in KEYS:
        dg = Graph().parse(SEEDS / f"{k}.ttl", format="turtle", publicID=f"{BASE}{k}")
        topic = next(dg.objects(URIRef(f"{BASE}{k}"),
                     URIRef("http://xmlns.com/foaf/0.1/primaryTopic")))
        assert str(topic) == f"{BASE}#{k}", f"{k} topic is {topic} — hazard §10.1!"

def test_roles_doc_parses_with_four_roles():
    g = Graph().parse(ROOT / "overlays" / "identifier-schemes" / "roles.ttl",
                      format="turtle", publicID="https://pod.vardeman.me/id/roles")
    for r in ("landing-page", "metadata-record", "did-document", "the-resource"):
        assert (URIRef(f"https://pod.vardeman.me/id/roles#{r}"), None, None) in g
```

- [ ] **Step 2: Run to verify failure**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_scheme_seed_records.py -v`
Expected: FAIL (directory missing).

- [ ] **Step 3: Author the records.** Use RELATIVE IRIs (`<>`, `<#doi>` resolves against the record URL — wrong!). **No: the abstract IRIs must be written in FULL** (hazard §10.5; a `<#doi>` in the record doc resolves to `…/schemes/doi#doi`). The reference record:

```turtle
# overlays/identifier-schemes/schemes/doi.ttl
@prefix idot:     <http://identifiers.org/idot/> .   # Task-2 confirmed IRI
@prefix dcat:     <http://www.w3.org/ns/dcat#> .
@prefix dct:      <http://purl.org/dc/terms/> .
@prefix skos:     <http://www.w3.org/2004/02/skos/core#> .
@prefix rdfs:     <http://www.w3.org/2000/01/rdf-schema#> .
@prefix foaf:     <http://xmlns.com/foaf/0.1/> .
@prefix datacite: <http://purl.org/spar/datacite/> .
@prefix xsd:      <http://www.w3.org/2001/XMLSchema#> .

<> a foaf:Document ;
   dct:title "DOI identifier-scheme record" ;
   dct:created "2026-06-05"^^xsd:date ;
   foaf:primaryTopic <https://pod.vardeman.me/id/schemes/#doi> .

<https://pod.vardeman.me/id/schemes/#doi>
    a idot:Namespace, skos:Concept, rdfs:Datatype ;
    skos:prefLabel "DOI"@en ;
    skos:definition "Digital Object Identifier — persistent identifier for scholarly objects, resolved via the Handle System."@en ;
    skos:inScheme <https://pod.vardeman.me/id/schemes/> ;
    skos:exactMatch datacite:doi ;
    rdfs:seeAlso <https://registry.identifiers.org/registry/doi> ;
    idot:idRegexPattern "^10\\.\\d{4,9}[-._;()/:a-zA-Z0-9]+$" ;
    idot:exampleIdentifier "10.1038/sdata.2018.29" .

<#doi-org> a idot:Resource ;
    dct:title "doi.org — landing page"@en ;
    idot:urlPattern "https://doi.org/{$id}" ;
    dcat:servesDataset <https://pod.vardeman.me/id/schemes/#doi> ;
    dcat:mediaType <https://www.iana.org/assignments/media-types/text/html> ;
    dct:type <https://pod.vardeman.me/id/roles#landing-page> .

<#doi-org-conneg> a idot:Resource ;
    dct:title "doi.org — DataCite metadata via content negotiation"@en ;
    idot:urlPattern "https://doi.org/{$id}" ;
    dcat:servesDataset <https://pod.vardeman.me/id/schemes/#doi> ;
    dcat:mediaType <https://www.iana.org/assignments/media-types/application/vnd.datacite.datacite+json> ;
    dct:conformsTo <https://schema.datacite.org/> ;
    dct:type <https://pod.vardeman.me/id/roles#metadata-record> .
```

The other seven follow the same frame. Their distinguishing content (each gets full `<>` Page block, full triple-typing, prefLabel/definition/inScheme/regex/example as above):

| key | exactMatch / conformsTo / broader | regex | example | providers |
|---|---|---|---|---|
| `orcid` | `skos:exactMatch datacite:orcid` ; seeAlso registry.identifiers.org/registry/orcid | `^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$` | `0000-0003-4091-6059` | `<#orcid-org>` urlPattern `https://orcid.org/{$id}`, mediaType text/html, role landing-page |
| `ror` | `skos:exactMatch datacite:ror` (omit exactMatch if datacite lacks the individual — check `ontology/datacite.ttl`; then use only seeAlso registry entry) | `^0[a-hj-km-np-tv-z0-9]{6}[0-9]{2}$` | `00mkhxb43` | `<#ror-org>` urlPattern `https://ror.org/{$id}`, role landing-page; `<#ror-api>` urlPattern `https://api.ror.org/organizations/{$id}`, mediaType application/json, role metadata-record |
| `arxiv` | `skos:exactMatch datacite:arxiv` | `^(\d{4}\.\d{4,5}\|[a-z-]+(\.[A-Z]{2})?/\d{7})(v\d+)?$` | `2310.04363` | `<#arxiv-abs>` urlPattern `https://arxiv.org/abs/{$id}`, role landing-page |
| `citekey` | no external anchors; `skos:note "Local scheme — scope: this Pod. Resolves via the Pod's wiki-search affordance (?ext=search-grep), not the web."@en` | `^[a-z][a-z-]*-\d{4}(-[a-z0-9-]+)?$` | `vardeman-2026-d111` | `<#pod-search>` a idot:Resource ; dct:title "Pod wiki-search"@en ; idot:urlPattern `https://pod.vardeman.me/vault/wiki/?ext=search-grep&q={$id}` ; role metadata-record |
| `did` | `dct:conformsTo <https://www.w3.org/TR/did-core/>` | `^did:[a-z0-9]+:[a-zA-Z0-9.\-_:%]+$` | `did:web:pod.vardeman.me` | `<#uniresolver>` urlPattern `https://dev.uniresolver.io/1.0/identifiers/{$id}`, mediaType application/did+ld+json, conformsTo did-core, role did-document |
| `did-oyd` | `skos:broader <https://pod.vardeman.me/id/schemes/#did>` ; `dct:conformsTo <https://ownyourdata.github.io/oydid/>` ; `skos:note "Content-addressed (multihash of the DID document); resolution requires an OYDID resolver or known storage location; not guaranteed publicly resolvable."@en` | `^did:oyd:[1-9A-HJ-NP-Za-km-z]+(@[1-9A-HJ-NP-Za-km-z]+)?$` | `did:oyd:zQmcVHWDMeXtj273A9gNAnEG2EdrGEjtQiFuw9PncyVgs9z` | `<#uniresolver>` as in `did` |
| `solid-resource` | `dct:conformsTo <https://solidproject.org/TR/protocol>` ; `skos:note "The Pod's own scheme: resolution is HTTP GET under Solid access patterns and returns the resource ITSELF (LDP, conneg, WAC, Memento). This record documents the informal regime; HTTP enforces it — reading this record is never required to use it."@en` | `^https://[^\s]+$` | `https://pod.vardeman.me/vault/wiki/index.md` | `<#pod>` a idot:Resource ; dct:title "This Pod"@en ; idot:urlPattern `{$id}` ; role the-resource |

- [ ] **Step 4: Author the roles document**

```turtle
# overlays/identifier-schemes/roles.ttl
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix role: <http://www.w3.org/ns/dx/prof/role/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

<> a foaf:Document ; dct:title "Identifier resolution-result roles" .

<#scheme> a skos:ConceptScheme ; skos:prefLabel "Resolution-result roles"@en ;
    skos:definition "What a provider's resolution result IS relative to the identified thing (httpRange-14 made explicit per provider). Attached to provider nodes via dct:type — NOT prof:hasRole (D111 §3)."@en .

<#landing-page> a skos:Concept ; skos:inScheme <#scheme> ;
    skos:prefLabel "landing page"@en ;
    skos:definition "A human-oriented description page about the identified thing — not the thing."@en ;
    skos:broader role:guidance .

<#metadata-record> a skos:Concept ; skos:inScheme <#scheme> ;
    skos:prefLabel "metadata record"@en ;
    skos:definition "A machine-readable description of the identified thing (e.g. DataCite JSON, ROR JSON, OSLC results)."@en ;
    skos:broader role:schema .

<#did-document> a skos:Concept ; skos:inScheme <#scheme> ;
    skos:prefLabel "DID document"@en ;
    skos:definition "A DID document conforming to DID Core — a description of the DID subject, never the subject."@en ;
    skos:broader role:schema .

<#the-resource> a skos:Concept ; skos:inScheme <#scheme> ;
    skos:prefLabel "the resource itself"@en ;
    skos:definition "Resolution returns the identified resource itself with full protocol affordances (the Solid case)."@en .
```

- [ ] **Step 5: Run the tests**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_scheme_seed_records.py -v`
Expected: 4 PASS. (`test_each_topic_is_catalog_fragment` is the §10.1 hazard guard — if it fails you minted the wrong IRI form.)

- [ ] **Step 6: Commit**

```bash
git add overlays/identifier-schemes/ tests/test_scheme_seed_records.py
git commit -m "[Agent: Claude] D111: 8 seed scheme records + roles doc (shape-validated offline; fragment-IRI guard test)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: The `identifier-schemes` overlay (manifest + deploy + live verify)

**Files:**
- Create: `overlays/identifier-schemes/manifest.ttl`
- Create: `overlays/identifier-schemes/patches/id-schemes-container.n3`
- Modify: `docker-compose.yml:56-60` (pod-setup command — add the overlay FIRST in the apply sequence)

- [ ] **Step 1: Write the manifest** (existing predicates only — `installsContainer`, `installsBootstrapContent`, `installsShape`, `installsContainerMetaPatch` all already parse in `scripts/overlay/common.py`; check `Manifest` fields for exact names and mirror `overlays/addressbook/manifest.ttl` syntax):

```turtle
# overlays/identifier-schemes/manifest.ttl
@prefix overlay: <https://pod.vardeman.me/vault/ontology/overlay#> .
@prefix dct:     <http://purl.org/dc/terms/> .

<https://pod.vardeman.me/vault/ontology/overlay#identifier-schemes>
    a overlay:Overlay ;
    overlay:name "identifier-schemes" ;
    overlay:version "0.1" ;
    dct:description "D111 Pod-level PID system: /id/schemes/ catalog + scheme records + roles. Lives OUTSIDE the storage root (rename-proof datatype IRIs)." ;

    overlay:installsContainer </id/schemes/> ;

    overlay:installsShape </id/scheme-record.shacl.ttl> ;

    overlay:installsBootstrapContent
        [ overlay:document "schemes/doi.ttl" ;          overlay:hostedAt "/id/schemes/doi" ;          overlay:contentType "text/turtle" ] ,
        [ overlay:document "schemes/orcid.ttl" ;        overlay:hostedAt "/id/schemes/orcid" ;        overlay:contentType "text/turtle" ] ,
        [ overlay:document "schemes/ror.ttl" ;          overlay:hostedAt "/id/schemes/ror" ;          overlay:contentType "text/turtle" ] ,
        [ overlay:document "schemes/arxiv.ttl" ;        overlay:hostedAt "/id/schemes/arxiv" ;        overlay:contentType "text/turtle" ] ,
        [ overlay:document "schemes/citekey.ttl" ;      overlay:hostedAt "/id/schemes/citekey" ;      overlay:contentType "text/turtle" ] ,
        [ overlay:document "schemes/did.ttl" ;          overlay:hostedAt "/id/schemes/did" ;          overlay:contentType "text/turtle" ] ,
        [ overlay:document "schemes/did-oyd.ttl" ;      overlay:hostedAt "/id/schemes/did-oyd" ;      overlay:contentType "text/turtle" ] ,
        [ overlay:document "schemes/solid-resource.ttl"; overlay:hostedAt "/id/schemes/solid-resource" ; overlay:contentType "text/turtle" ] ,
        [ overlay:document "roles.ttl" ;                overlay:hostedAt "/id/roles" ;                overlay:contentType "text/turtle" ] ;

    overlay:installsContainerMetaPatch
        [ overlay:container </id/schemes/> ;
          overlay:patchDocument "patches/id-schemes-container.n3" ] .
```

**Check `common.py` first**: if `installsShape` deploys from a fixed local dir (e.g. `shapes/`), copy `shapes/substrate/scheme-record.shacl.ttl` into `overlays/identifier-schemes/shapes/` and reference per the addressbook pattern; keep the canonical copy in `shapes/substrate/` and add a drift check to `make check-validator-tbox`-style — simplest: the overlay copy IS a symlink-free duplicate and `tests/test_scheme_record_shape.py` gains an equality assertion:

```python
def test_overlay_shape_copy_matches_canonical():
    canon = (ROOT / "shapes/substrate/scheme-record.shacl.ttl").read_text()
    copy = (ROOT / "overlays/identifier-schemes/shapes/scheme-record.shacl.ttl").read_text()
    assert canon == copy
```

- [ ] **Step 2: Write the container meta patch**

```n3
# overlays/identifier-schemes/patches/id-schemes-container.n3
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix ldp:   <http://www.w3.org/ns/ldp#> .
@prefix dcat:  <http://www.w3.org/ns/dcat#> .
@prefix skos:  <http://www.w3.org/2004/02/skos/core#> .
@prefix dct:   <http://purl.org/dc/terms/> .
<> a solid:InsertDeletePatch ;
solid:inserts {
    <https://pod.vardeman.me/id/schemes/> a dcat:Catalog, skos:ConceptScheme ;
        dct:title "Identifier-scheme catalog" ;
        ldp:constrainedBy <https://pod.vardeman.me/id/scheme-record.shacl.ttl> .
} .
```

- [ ] **Step 3: Add the overlay to pod-setup, FIRST** — in `docker-compose.yml`, before the wiki-memory apply line:

```yaml
        python -m scripts.overlay.apply /overlays/identifier-schemes --target https://pod.vardeman.me/vault/ &&
```

(`absolutize()` joins path-absolute `hostedAt` like `/id/schemes/doi` to the host root — verified in the collision sweep.)

- [ ] **Step 4: Apply live and verify**

```bash
~/uvws/.venv/bin/python -m scripts.overlay.apply overlays/identifier-schemes --target https://pod.vardeman.me/vault/
curl -sk https://pod.vardeman.me/id/schemes/doi -H 'Accept: text/turtle' | grep -c '#doi'
curl -skI https://pod.vardeman.me/id/schemes/ | grep -i constrainedby
printf '<> <http://purl.org/dc/terms/title> "bad" .' | curl -sk -X PUT \
  https://pod.vardeman.me/id/schemes/bogus -H 'Content-Type: text/turtle' \
  --data-binary @- -o /dev/null -w '%{http_code}\n'
```
Expected: `grep -c` ≥ 3; constrainedBy Link header present; final PUT `422` (no primaryTopic → SchemeRecordShape rejects; if `201`, the validator needs `foaf:Document` typing — check the shape targets and the Task 1 Step 4 finding). If validation needs the record to declare `a foaf:Document` to be targeted, that's already in every seed.

- [ ] **Step 5: Commit**

```bash
git add overlays/identifier-schemes/ docker-compose.yml tests/test_scheme_record_shape.py
git commit -m "[Agent: Claude] D111: identifier-schemes overlay — /id/ space deployed (catalog + 8 records + roles + constrainedBy floor live)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: `id-catalog` extension — the server-derived catalog (TDD)

**Files:**
- Create: `css/extensions/id-catalog/package.json`, `tsconfig.json`, `vitest.config.ts` — scaffold with the `css-extension` skill pattern; copy `css/extensions/shape-validator/package.json` and rename (`name: "@cogitarelink/id-catalog"`, `lsd:module` etc.), keep `componentsjs-generator` build script.
- Create: `css/extensions/id-catalog/src/index.ts`, `src/IdCatalogStore.ts`, `src/deriveEntry.ts`
- Test: `css/extensions/id-catalog/src/deriveEntry.test.ts`, `src/IdCatalogStore.test.ts`

- [ ] **Step 1: Write the failing tests for the pure derivation logic**

```typescript
// css/extensions/id-catalog/src/deriveEntry.test.ts
import { describe, it, expect } from "vitest";
import { deriveThinEntry, findDerivedSubjects, CATALOG_FRAGMENT_RE } from "./deriveEntry";
import { Parser } from "n3";

const BASE = "https://pod.vardeman.me/id/schemes/";
const RECORD = `
@prefix idot: <http://identifiers.org/idot/> . @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> . @prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix dct: <http://purl.org/dc/terms/> .
<${BASE}doi> a foaf:Document ; dct:title "DOI" ; foaf:primaryTopic <${BASE}#doi> .
<${BASE}#doi> a idot:Namespace, skos:Concept, rdfs:Datatype ;
  skos:prefLabel "DOI"@en ; skos:definition "d"@en ;
  idot:idRegexPattern "^10" ; idot:exampleIdentifier "10.1/x" .`;

describe("deriveThinEntry", () => {
  it("derives exactly the normative thin-entry triple set (spec §4.4)", () => {
    const quads = new Parser({ baseIRI: `${BASE}doi` }).parse(RECORD);
    const entry = deriveThinEntry(quads, `${BASE}doi`, BASE);
    const s = `${BASE}#doi`;
    const got = new Set(entry.map(q => `${q.subject.value}|${q.predicate.value}|${q.object.value}`));
    expect(got).toEqual(new Set([
      `${s}|http://www.w3.org/1999/02/22-rdf-syntax-ns#type|http://identifiers.org/idot/Namespace`,
      `${s}|http://www.w3.org/1999/02/22-rdf-syntax-ns#type|http://www.w3.org/2004/02/skos/core#Concept`,
      `${s}|http://www.w3.org/1999/02/22-rdf-syntax-ns#type|http://www.w3.org/2000/01/rdf-schema#Datatype`,
      `${s}|http://www.w3.org/2004/02/skos/core#prefLabel|DOI`,
      `${s}|http://www.w3.org/2004/02/skos/core#inScheme|${BASE}`,
      `${s}|http://www.w3.org/2000/01/rdf-schema#isDefinedBy|${BASE}`,
      `${s}|http://xmlns.com/foaf/0.1/isPrimaryTopicOf|${BASE}doi`,
    ]));
  });
  it("returns null when the record has no catalog-fragment primaryTopic", () => {
    const quads = new Parser({ baseIRI: `${BASE}x` })
      .parse(`<${BASE}x> <http://xmlns.com/foaf/0.1/primaryTopic> <https://example.org/#x> .`);
    expect(deriveThinEntry(quads, `${BASE}x`, BASE)).toBeNull();
  });
});

describe("findDerivedSubjects (the PATCH guard)", () => {
  it("flags N3 patch text inserting triples about catalog fragments", () => {
    const patch = `@prefix solid: <http://www.w3.org/ns/solid/terms#>.
<> a solid:InsertDeletePatch; solid:inserts { <${BASE}#fake> a <http://example.org/T> . }.`;
    expect(findDerivedSubjects(patch, BASE).length).toBeGreaterThan(0);
  });
  it("passes patches that only touch the container subject", () => {
    const patch = `@prefix solid: <http://www.w3.org/ns/solid/terms#>.
<> a solid:InsertDeletePatch; solid:inserts { <${BASE}> <http://purl.org/dc/terms/title> "t" . }.`;
    expect(findDerivedSubjects(patch, BASE)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd css/extensions/id-catalog && npm install --ignore-scripts && npx vitest run`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the pure module**

```typescript
// css/extensions/id-catalog/src/deriveEntry.ts
// Pure derivation + guard logic for the server-managed catalog (D111 §4.4).
// The thin entry is the NORMATIVE set from the spec — nothing else is copied.
import { DataFactory, Parser, Quad } from "n3";
const { namedNode, quad } = DataFactory;

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SKOS = "http://www.w3.org/2004/02/skos/core#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const FOAF = "http://xmlns.com/foaf/0.1/";

export const CATALOG_FRAGMENT_RE = (catalogUrl: string): RegExp =>
  new RegExp(`^${catalogUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}#`);

// Derive the thin catalog entry for one record. quads = the record's parsed body
// (baseIRI = record URL). Returns null when the record lacks a catalog-fragment
// foaf:primaryTopic (the floor should have rejected it; belt-and-suspenders).
export function deriveThinEntry(quads: Quad[], recordUrl: string, catalogUrl: string): Quad[] | null {
  const frag = CATALOG_FRAGMENT_RE(catalogUrl);
  const topic = quads.find(q =>
    q.subject.value === recordUrl &&
    q.predicate.value === `${FOAF}primaryTopic` &&
    frag.test(q.object.value))?.object;
  if (!topic) return null;
  const label = quads.find(q =>
    q.subject.value === topic.value && q.predicate.value === `${SKOS}prefLabel`)?.object;
  const types = quads.filter(q =>
    q.subject.value === topic.value && q.predicate.value === RDF_TYPE);
  const t = namedNode(topic.value);
  const out: Quad[] = types.map(q => quad(t, namedNode(RDF_TYPE), q.object as any));
  if (label) out.push(quad(t, namedNode(`${SKOS}prefLabel`), label as any));
  out.push(quad(t, namedNode(`${SKOS}inScheme`), namedNode(catalogUrl)));
  out.push(quad(t, namedNode(`${RDFS}isDefinedBy`), namedNode(catalogUrl)));
  out.push(quad(t, namedNode(`${FOAF}isPrimaryTopicOf`), namedNode(recordUrl)));
  return out;
}

// Parse an N3 Patch body and return the catalog-fragment subjects it touches.
// Quoted graphs (solid:inserts/solid:deletes) parse as N3 formulas — walk ALL
// quads regardless of graph term. Used by IdCatalogStore to reject client
// patches that touch server-derived triples (D111 §4.4, ldp:contains precedent).
export function findDerivedSubjects(patchBody: string, catalogUrl: string): string[] {
  const frag = CATALOG_FRAGMENT_RE(catalogUrl);
  const quads = new Parser({ format: "text/n3", baseIRI: catalogUrl }).parse(patchBody);
  return [...new Set(quads.map(q => q.subject.value).filter(v => frag.test(v)))];
}
```

- [ ] **Step 4: Run tests to verify the pure module passes**

Run: `npx vitest run src/deriveEntry.test.ts`
Expected: 4 PASS.

- [ ] **Step 5: Write the store.** Mirror `AdmissionFloorStore`'s idioms exactly (PassthroughStore, cloneRepresentation, readableToString, logger; see `css/extensions/shape-validator/src/storage/AdmissionFloorStore.ts`). Behavior contract (write the vitest first using a stubbed `source` store object, asserting these):

1. `setRepresentation`/`modifyResource` targeting the catalog container or its `.meta` → throw `ConflictHttpError` **when** (PATCH case) `findDerivedSubjects(body) ≠ []` or (PUT case) always — UNLESS the internal `deriving` flag is set.
2. `setRepresentation`/`addResource` of a record under the catalog → clone the representation, pass the original downstream; on success, parse the clone (Turtle, baseIRI = record URL), `deriveThinEntry`, then internally rewrite the container `.meta`: read current `.meta` quads via `source.getRepresentation`, drop all quads whose subject matches `CATALOG_FRAGMENT_RE` for THIS record's topic, append the new entry, `source.setRepresentation` the `.meta` (with `deriving = true` around the call). In-band: the catalog reflects the record before the client's response returns.
3. `deleteResource` of a record → pass through; on success remove that record's fragment triples from `.meta` the same way.
4. Anything outside the catalog URL prefix → pure passthrough (zero overhead for the rest of the Pod).

```typescript
// css/extensions/id-catalog/src/IdCatalogStore.ts
import type {
  Representation, ResourceIdentifier, Conditions, ChangeMap,
} from '@solid/community-server';
import {
  PassthroughStore, BasicRepresentation, cloneRepresentation,
  readableToString, ConflictHttpError, INTERNAL_QUADS,
} from '@solid/community-server';
import { Parser, Writer, Store, DataFactory } from 'n3';
import { getLoggerFor } from 'global-logger-factory';
import { deriveThinEntry, findDerivedSubjects, CATALOG_FRAGMENT_RE } from './deriveEntry';

// Server-managed catalog derivation (D111 §4.4). Sits ABOVE PatchingStore so
// PATCH bodies are inspected as text before application; record writes flow
// down through the admission floor / ShapeValidationStore first, so only
// VALIDATED records derive entries. The internal .meta rewrite goes through
// this.source (below Locking) — single-writer dev Pod, documented trade-off:
// re-entering the top store would risk lock re-entrancy on the in-flight write.
export class IdCatalogStore extends PassthroughStore {
  protected readonly logger = getLoggerFor(this);
  private deriving = false;

  public constructor(
    source: any,
    private readonly catalogUrl: string,   // e.g. https://pod.vardeman.me/id/schemes/
  ) { super(source); }

  private isCatalog(id: ResourceIdentifier): boolean {
    return id.path === this.catalogUrl || id.path === `${this.catalogUrl}.meta`;
  }
  private isRecord(id: ResourceIdentifier): boolean {
    return id.path.startsWith(this.catalogUrl) &&
      id.path !== this.catalogUrl && !id.path.endsWith('.meta') && !id.path.endsWith('/');
  }

  public async modifyResource(id: ResourceIdentifier, patch: Representation,
      conditions?: Conditions): Promise<ChangeMap> {
    if (!this.deriving && this.isCatalog(id)) {
      const body = await readableToString((await cloneRepresentation(patch)).data);
      const touched = findDerivedSubjects(body, this.catalogUrl);
      if (touched.length > 0) {
        throw new ConflictHttpError(
          `Catalog entries are server-derived from /id/schemes/ records (D111). ` +
          `Write the record, not the index. Derived subjects touched: ${touched.join(', ')}`);
      }
    }
    return this.source.modifyResource(id, patch, conditions);
  }

  public async setRepresentation(id: ResourceIdentifier, rep: Representation,
      conditions?: Conditions): Promise<ChangeMap> {
    if (!this.deriving && this.isCatalog(id)) {
      throw new ConflictHttpError('The catalog representation is server-managed (D111 §4.4).');
    }
    if (!this.isRecord(id)) return this.source.setRepresentation(id, rep, conditions);
    const clone = await cloneRepresentation(rep);
    const result = await this.source.setRepresentation(id, rep, conditions);
    await this.deriveFor(id.path, await readableToString(clone.data),
      clone.metadata.contentType ?? 'text/turtle');
    return result;
  }

  public async deleteResource(id: ResourceIdentifier, conditions?: Conditions): Promise<ChangeMap> {
    const result = await this.source.deleteResource(id, conditions);
    if (this.isRecord(id)) await this.rewriteMeta(id.path, null);
    return result;
  }

  private async deriveFor(recordUrl: string, body: string, contentType: string): Promise<void> {
    try {
      const quads = new Parser({ baseIRI: recordUrl, format: contentType }).parse(body);
      const entry = deriveThinEntry(quads, recordUrl, this.catalogUrl);
      await this.rewriteMeta(recordUrl, entry);
    } catch (err) {
      this.logger.error(`catalog derivation failed for ${recordUrl}: ${err}`);
    }
  }

  // Replace this record's fragment triples in the container .meta (entry=null removes).
  private async rewriteMeta(recordUrl: string, entry: import('n3').Quad[] | null): Promise<void> {
    const metaId = { path: `${this.catalogUrl}.meta` };
    const store = new Store();
    try {
      const current = await this.source.getRepresentation(metaId, { type: { [INTERNAL_QUADS]: 1 } });
      for await (const q of current.data as any) store.addQuad(q);
    } catch { /* no .meta yet — fresh container */ }
    const frag = CATALOG_FRAGMENT_RE(this.catalogUrl);
    for (const q of store.getQuads(null, null, null, null)) {
      const aboutThisRecord =
        frag.test(q.subject.value) &&
        (entry ? q.subject.value === entry[0]?.subject.value
               : store.getQuads(q.subject, 'http://xmlns.com/foaf/0.1/isPrimaryTopicOf',
                                DataFactory.namedNode(recordUrl), null).length > 0);
      if (aboutThisRecord) store.removeQuad(q);
    }
    if (entry) for (const q of entry) store.addQuad(q);
    const ttl: string = await new Promise((res, rej) => {
      const w = new Writer({ format: 'text/turtle' });
      w.addQuads(store.getQuads(null, null, null, null));
      w.end((e, r) => e ? rej(e) : res(r));
    });
    this.deriving = true;
    try {
      await this.source.setRepresentation(metaId,
        new BasicRepresentation(ttl, 'text/turtle'));
    } finally { this.deriving = false; }
  }
}
```

Also `src/index.ts`: `export * from './IdCatalogStore'; export * from './deriveEntry';`

**Implementation honesty note for the executor:** the `.meta` read/write API details (auxiliary identifier form, INTERNAL_QUADS preference shape, whether `setRepresentation` on `.meta` is permitted internally) must be verified against `MarkdownProjectionListener`'s `.meta`-writing code in `css/extensions/markdown-projection/src/` — mirror ITS exact idiom if it differs from the sketch above (the standing fragility lesson: name and mirror the in-repo exemplar). The behavior contract in the tests is normative; the plumbing idiom is the exemplar's.

- [ ] **Step 6: Write `IdCatalogStore.test.ts`** — stub `source` as an in-memory object recording calls (`getRepresentation` returns a fixed `.meta`; `setRepresentation`/`modifyResource`/`deleteResource` record + resolve). Cover behaviors 1–4 above: 6 tests (reject PUT catalog; reject PATCH touching fragment; allow PATCH not touching fragment; record PUT derives entry incl. .meta rewrite content; record DELETE removes entry; non-catalog path passes through untouched).

- [ ] **Step 7: Run all extension tests**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 8: Build Components.js artifacts**

Run: `npm run build` (must include `componentsjs-generator` per the copied package.json)
Expected: `dist/` + `components/` generated without "Could not load class" errors.

- [ ] **Step 9: Commit**

```bash
git add css/extensions/id-catalog/
git commit -m "[Agent: Claude] D111: id-catalog extension — IdCatalogStore (server-derived catalog, PATCH guard, TDD)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Wire `id-catalog` into the server + live e2e

**Files:**
- Create: `css/config/id-catalog.json`
- Modify: `css/config/solid-config.json:2-19` (@context line + import line)
- Modify: `css/Dockerfile` (build block — mirror the markdown-projection block at lines 89-113: COPY, npm install --ignore-scripts, build, CSS symlink, scoped-package symlink)
- Modify: `Makefile:8-17` (add `css/extensions/id-catalog` to JS_EXTENSIONS)

- [ ] **Step 1: Write the config**

```json
{
  "@context": [
    "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^8.0.0/components/context.jsonld",
    "https://linkedsoftwaredependencies.org/bundles/npm/@cogitarelink/id-catalog/^0.1.0/components/context.jsonld"
  ],
  "@graph": [
    {
      "comment": "D111 §4.4 — server-derived identifier-scheme catalog. Sits between Locking and Patching so PATCH bodies are inspected as text BEFORE application; record writes still flow through AdmissionFloor/ShapeValidationStore below, so only validated records derive entries.",
      "@type": "Override",
      "overrideInstance": { "@id": "urn:solid-server:default:ResourceStore_Locking" },
      "overrideParameters": {
        "@type": "LockingResourceStore",
        "source": { "@id": "urn:cogitarelink:IdCatalogStore" }
      }
    },
    {
      "@id": "urn:cogitarelink:IdCatalogStore",
      "@type": "IdCatalogStore",
      "source": { "@id": "urn:solid-server:default:ResourceStore_Patching" },
      "catalogUrl": "https://pod.vardeman.me/id/schemes/"
    }
  ]
}
```

**Verify the override target:** check CSS's default chain ids with `grep -rn "ResourceStore_Locking" css/extensions/shape-validator/node_modules/@solid/community-server/config/ | head -3` — the LockingResourceStore override parameters must preserve its OTHER constructor params (locker etc.). If `overrideParameters` replaces all params, use the `OverrideParameter`-per-field form or instead insert by overriding `ResourceStore_Patching`'s consumer the way `solid-config.json:60-68` did for the floor. Mirror that exact Override mechanism — it's the in-repo exemplar for chain insertion.

- [ ] **Step 2: Wire imports** — in `css/config/solid-config.json`: add the id-catalog context URL to the `@context` array and `"./id-catalog.json"` to `"import"`.

- [ ] **Step 3: Dockerfile block** (after the markdown-projection block):

```dockerfile
# id-catalog — server-derived identifier-scheme catalog (D111 §4.4).
COPY extensions/id-catalog /community-server/extensions/id-catalog
RUN cd extensions/id-catalog && npm install --ignore-scripts && npm run build
RUN rm -rf /community-server/extensions/id-catalog/node_modules/@solid/community-server && \
    ln -sf /community-server /community-server/extensions/id-catalog/node_modules/@solid/community-server
RUN mkdir -p /community-server/node_modules/@cogitarelink && \
    ln -sf /community-server/extensions/id-catalog /community-server/node_modules/@cogitarelink/id-catalog
```

(Mirror the exact existing markdown-projection lines — flags and symlink targets included.)

- [ ] **Step 4: Makefile** — add `css/extensions/id-catalog \` to `JS_EXTENSIONS`.

- [ ] **Step 5: Rebuild + e2e**

```bash
make rebuild   # config guard runs at boot — Invalid-predicate-IRI class is dead, but watch the logs
docker compose logs css | grep -i -E 'error|IdCatalog' | head
# e2e 1: register a new scheme via raw curl (the §7.4 probe-2 loop, mechanically):
printf '@prefix foaf: <http://xmlns.com/foaf/0.1/> . @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> . @prefix idot: <http://identifiers.org/idot/> .
@prefix dct: <http://purl.org/dc/terms/> .
<> a foaf:Document ; dct:title "ACME id scheme" ; foaf:primaryTopic <https://pod.vardeman.me/id/schemes/#acme-id> .
<https://pod.vardeman.me/id/schemes/#acme-id> a idot:Namespace, skos:Concept, rdfs:Datatype ;
  skos:prefLabel "ACME"@en ; skos:definition "test scheme"@en ;
  idot:idRegexPattern "^A\\\\d+$" ; idot:exampleIdentifier "A1" .' | \
curl -sk -X PUT https://pod.vardeman.me/id/schemes/acme-id -H 'Content-Type: text/turtle' --data-binary @- -o /dev/null -w '%{http_code}\n'
# e2e 2: the derived entry is IMMEDIATELY in the catalog (in-band):
curl -sk https://pod.vardeman.me/id/schemes/ -H 'Accept: text/turtle' | grep -A2 '#acme-id'
# e2e 3: client PATCH touching a derived subject → 409:
curl -sk -X PATCH https://pod.vardeman.me/id/schemes/.meta -H 'Content-Type: text/n3' \
  --data-binary '@prefix solid: <http://www.w3.org/ns/solid/terms#>.
<> a solid:InsertDeletePatch; solid:inserts { <https://pod.vardeman.me/id/schemes/#fake> a <http://example.org/T> . }.' \
  -o /dev/null -w '%{http_code}\n'
# e2e 4: DELETE removes the derived entry:
curl -sk -X DELETE https://pod.vardeman.me/id/schemes/acme-id -o /dev/null -w '%{http_code}\n'
curl -sk https://pod.vardeman.me/id/schemes/ -H 'Accept: text/turtle' | grep -c '#acme-id' || true
```
Expected: `201`; grep shows the thin entry (prefLabel "ACME", isPrimaryTopicOf); `409`; `205` then `0`.

- [ ] **Step 6: Run the full JS guard suite**

Run: `make test-js`
Expected: all extensions PASS (id-catalog now in the loop).

- [ ] **Step 7: Commit**

```bash
git add css/config/id-catalog.json css/config/solid-config.json css/Dockerfile Makefile
git commit -m "[Agent: Claude] D111: wire IdCatalogStore into the store chain — derived catalog live (e2e: derive/409/delete verified)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Datatype prefix binding in span-literal projection (TDD)

**Files:**
- Modify: `css/extensions/markdown-projection/src/spanLiteralProjection.ts:6-13`
- Test: modify `css/extensions/markdown-projection/test/` span tests (or `src/` — match where the existing spanLiteralProjection tests live)

- [ ] **Step 1: Write the failing tests** (add to the existing spanLiteralProjection test file):

```typescript
import { DATATYPE_PREFIXES } from "../src/spanLiteralProjection";
// in the describe block:
it("projects ^^ids:doi to the catalog fragment datatype (D111 §6.2)", () => {
  const quads = projectSpanLiterals(
    "[10.1234/x]{.identifier^^ids:doi}",
    namedNode("https://pod.vardeman.me/x#this"),
    { identifier: "http://purl.org/dc/terms/identifier" });
  expect(quads[0].object.termType).toBe("Literal");
  expect((quads[0].object as any).datatype.value)
    .toBe("https://pod.vardeman.me/id/schemes/#doi");
});
it("projects an UNKNOWN datatype prefix as a plain literal (suggestive typing — no throw)", () => {
  const quads = projectSpanLiterals(
    "[X9]{.identifier^^zzz:mystery}",
    namedNode("https://pod.vardeman.me/x#this"),
    { identifier: "http://purl.org/dc/terms/identifier" });
  expect(quads[0].object.value).toBe("X9");
  expect((quads[0].object as any).datatype.value)
    .toBe("http://www.w3.org/2001/XMLSchema#string"); // N3 default for plain literal
});
it("still throws on unbound PREDICATE (governance unchanged)", () => {
  expect(() => projectSpanLiterals("[x]{.nope}", namedNode("https://p/x"), {}))
    .toThrow(/unbound predicate/);
});
```

(Use the exact import/call style of the file's existing tests — `[10.1234/x]{.identifier^^ids:doi}` is literal markdown text, no quotes inside the brackets.)

- [ ] **Step 2: Run to verify failure**

Run: `cd css/extensions/markdown-projection && npx vitest run`
Expected: new tests FAIL (`unbound datatype prefix: ids` throw; missing export).

- [ ] **Step 3: Implement**

```typescript
// replace spanLiteralProjection.ts lines 6-13 with:
// Datatype CURIE prefixes (D111 §6.2). Code-constant + agreement-test idiom, the
// same governance as CURIE_PREFIXES in frontmatterProjection.ts: the served
// context (overlays/wiki-memory/context-fragment.jsonld) carries matching
// declarations and curiePrefixAgreement.test.ts asserts the mirror. Unknown
// prefix => plain literal, never a throw (suggestive typing — Tier-2 curation
// flags it; the D50 silent-drop convention).
const XSD = "http://www.w3.org/2001/XMLSchema#";
export const DATATYPE_PREFIXES: Readonly<Record<string, string>> = {
  xsd: XSD,
  ids: "https://pod.vardeman.me/id/schemes/#",
};
function datatypeIRI(curie?: string): NamedNode | undefined {
  if (!curie) return undefined;
  const [pfx, local] = curie.split(":");
  const ns = DATATYPE_PREFIXES[pfx];
  return ns ? namedNode(ns + local) : undefined;  // unknown → plain literal
}
```

(No other lines change — `literal(s.text, datatypeIRI(s.datatype))` with `undefined` datatype already yields a plain literal in N3.js.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: all PASS, including the pre-existing span tests.

- [ ] **Step 5: Commit**

```bash
git add css/extensions/markdown-projection/src/spanLiteralProjection.ts css/extensions/markdown-projection/test/
git commit -m "[Agent: Claude] D111: DATATYPE_PREFIXES — ids: datatype binding; unknown prefix → plain literal (suggestive typing)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: The four-artifact context agreement batch (`ids:` everywhere)

The agreement web (spec §9.5): `CURIE_PREFIXES` ↔ `context-fragment.jsonld` ↔ renderer `DEFAULT_CONTEXT` ↔ `maps.json`. The guards (`curiePrefixAgreement.test.ts`, `contextAgreement.test.ts`) enforce set-equality — all four move in ONE commit.

**Files:**
- Modify: `css/extensions/markdown-projection/src/frontmatterProjection.ts:27-44` (add `"ids"` to CURIE_PREFIXES)
- Modify: `overlays/wiki-memory/context-fragment.jsonld` (add `"ids"` declaration)
- Modify: the markdown-render `DEFAULT_CONTEXT` (find with `grep -rn "DEFAULT_CONTEXT" css/extensions/markdown-render/src/`)
- Regenerate: `css/extensions/markdown-projection/maps.json` (via `scripts/emitMaps.ts` — check `package.json` for the emit script name)

- [ ] **Step 1: Run the agreement guards to see current green**

Run: `cd css/extensions/markdown-projection && npx vitest run test/curiePrefixAgreement.test.ts`
Expected: PASS (baseline).

- [ ] **Step 2: Add `ids:` to all four artifacts**

In `frontmatterProjection.ts` CURIE_PREFIXES: `"ids": "https://pod.vardeman.me/id/schemes/#",`
In `context-fragment.jsonld` @context: `"ids": "https://pod.vardeman.me/id/schemes/#",`
In markdown-render's `DEFAULT_CONTEXT`: the same pair.
Regenerate maps.json: run the emit script named in `css/extensions/markdown-projection/package.json` (look for `emitMaps`/`maps` script; e.g. `npm run emit-maps`).

- [ ] **Step 3: Run BOTH agreement guards + full suites**

Run: `cd css/extensions/markdown-projection && npx vitest run && cd ../markdown-render && npx vitest run`
Expected: all PASS — if either agreement test fails, one artifact was missed; the failure message names it.

- [ ] **Step 4: Redeploy the served context**

```bash
~/uvws/.venv/bin/python -m scripts.overlay.apply overlays/wiki-memory --target https://pod.vardeman.me/vault/
curl -sk https://pod.vardeman.me/vault/meta/context.jsonld | grep '"ids"'
```
Expected: the `ids` declaration in the live served context.

- [ ] **Step 5: Commit**

```bash
git add css/extensions/markdown-projection/src/frontmatterProjection.ts \
        css/extensions/markdown-projection/maps.json \
        overlays/wiki-memory/context-fragment.jsonld \
        css/extensions/markdown-render/src/
git commit -m "[Agent: Claude] D111: ids: prefix across the 4-artifact agreement web (CURIE_PREFIXES/context/DEFAULT_CONTEXT/maps.json)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: Frontmatter compact-identifier projection (TDD)

**Files:**
- Modify: `css/extensions/markdown-projection/src/frontmatterProjection.ts` (the identifier block)
- Test: `css/extensions/markdown-projection/test/frontmatterProjection.test.ts`

- [ ] **Step 1: Write the failing tests** (append to the existing frontmatter test file, matching its import style):

```typescript
it("types identifier: doi:10.1234/x with the doi scheme datatype, stripping the prefix", () => {
  const q = projectFrontmatter({ identifier: "doi:10.1234/x" })
    .find(q => q.predicate.value.endsWith("identifier"))!;
  expect(q.object.value).toBe("10.1234/x");
  expect((q.object as any).datatype.value).toBe("https://pod.vardeman.me/id/schemes/#doi");
});
it("keeps the FULL string for did identifiers (the prefix is part of the lexical form)", () => {
  const q = projectFrontmatter({ identifier: "did:web:pod.vardeman.me" })
    .find(q => q.predicate.value.endsWith("identifier"))!;
  expect(q.object.value).toBe("did:web:pod.vardeman.me");
  expect((q.object as any).datatype.value).toBe("https://pod.vardeman.me/id/schemes/#did");
});
it("projects unknown prefixes as the whole plain string (suggestive typing)", () => {
  const q = projectFrontmatter({ identifier: "isbn:978-3" })
    .find(q => q.predicate.value.endsWith("identifier"))!;
  expect(q.object.value).toBe("isbn:978-3");
  expect((q.object as any).datatypeString ?? (q.object as any).datatype.value)
    .toContain("XMLSchema#string");
});
it("projects absolute IRIs and citekey field unchanged (existing behavior)", () => {
  const a = projectFrontmatter({ identifier: "https://x.com" });
  expect(a.find(q => q.predicate.value.endsWith("identifier"))!.object.value).toBe("https://x.com");
  const c = projectFrontmatter({ citekey: "smith-2026-foo" });
  expect(c.find(q => q.predicate.value.endsWith("identifier"))!.object.value).toBe("smith-2026-foo");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/frontmatterProjection.test.ts`
Expected: first three FAIL.

- [ ] **Step 3: Implement** — replace the two identifier lines in `projectFrontmatter`:

```typescript
// D111 §6.2 — compact-identifier convention (identifiers.org form) on the
// identifier: field. Split on the FIRST colon; a registered scheme key types
// the literal with the catalog-fragment datatype. did keeps the full string
// (its regex anchors on the prefix — the lexical form IS the whole DID).
// Unknown prefix / no colon / absolute IRI → plain literal (suggestive typing;
// Tier-2 curation flags). citekey: field unchanged — untyped (typing local
// citekeys is curation-loop work, not floor work).
const IDS_NS = "https://pod.vardeman.me/id/schemes/#";
const SCHEME_KEYS = new Set(["doi", "orcid", "ror", "arxiv", "citekey", "did"]);
const KEEP_PREFIX = new Set(["did"]);

function identifierLiteral(raw: string) {
    if (raw.startsWith("http://") || raw.startsWith("https://")) return literal(raw);
    const colon = raw.indexOf(":");
    if (colon > 0) {
        const pfx = raw.slice(0, colon);
        if (SCHEME_KEYS.has(pfx)) {
            const lex = KEEP_PREFIX.has(pfx) ? raw : raw.slice(colon + 1);
            return literal(lex, namedNode(IDS_NS + pfx));
        }
    }
    return literal(raw);
}
```
and in `projectFrontmatter`:
```typescript
    // identifier wins over citekey; identifier gets compact-id typing, citekey stays plain
    if (fm.identifier) out.push(quad(subj, namedNode(DCT + "identifier"), identifierLiteral(fm.identifier)));
    else if (fm.citekey) out.push(quad(subj, namedNode(DCT + "identifier"), literal(fm.citekey)));
```

- [ ] **Step 4: Run the full extension suite** (catches regressions in the existing identifier tests)

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 5: Rebuild + redeploy the server** (projection runs server-side): `make rebuild`. Then live-check:

```bash
printf -- '---\ntype: source\ntitle: T\ncreated: 2026-06-05\nidentifier: doi:10.1234/d111-fm\n---\n# T\n' | \
curl -sk -X PUT 'https://pod.vardeman.me/vault/wiki/concepts/d111-fm-probe.md' \
  -H 'Content-Type: text/markdown' --data-binary @- -o /dev/null -w '%{http_code}\n'
curl -sk 'https://pod.vardeman.me/vault/wiki/concepts/d111-fm-probe.md.meta' -H 'Accept: text/turtle' | grep 'id/schemes/#doi'
curl -sk -X DELETE 'https://pod.vardeman.me/vault/wiki/concepts/d111-fm-probe.md' -o /dev/null
```
Expected: `201`; the `.meta` line shows `"10.1234/d111-fm"^^<https://pod.vardeman.me/id/schemes/#doi>`.

- [ ] **Step 6: Commit**

```bash
git add css/extensions/markdown-projection/src/frontmatterProjection.ts css/extensions/markdown-projection/test/frontmatterProjection.test.ts
git commit -m "[Agent: Claude] D111: frontmatter compact-identifier typing (doi:/orcid:/…; did keeps full lexical form; unknown → plain)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 11: `overlay:registersScheme` (manifest predicate + deploy block, TDD)

**Files:**
- Modify: `scripts/overlay/common.py` (Manifest dataclass + parser)
- Modify: `scripts/overlay/apply.py` (new deploy block in `apply_overlay`)
- Modify: `overlays/wiki-memory/manifest.ttl` + `overlays/addressbook/manifest.ttl`
- Test: `tests/test_overlay_registers_scheme.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_overlay_registers_scheme.py
from pathlib import Path
from scripts.overlay.common import parse_manifest  # check the actual parse entrypoint name in common.py

ROOT = Path(__file__).parent.parent

def test_wiki_memory_registers_three_schemes():
    m = parse_manifest(ROOT / "overlays" / "wiki-memory")
    assert set(map(str, m.registers_schemes)) == {
        "https://pod.vardeman.me/id/schemes/doi",
        "https://pod.vardeman.me/id/schemes/citekey",
        "https://pod.vardeman.me/id/schemes/orcid",
    }

def test_addressbook_registers_two_schemes():
    m = parse_manifest(ROOT / "overlays" / "addressbook")
    assert set(map(str, m.registers_schemes)) == {
        "https://pod.vardeman.me/id/schemes/orcid",
        "https://pod.vardeman.me/id/schemes/did",
    }

def test_overlay_without_registration_has_empty_tuple():
    m = parse_manifest(ROOT / "overlays" / "owner-identity")
    assert m.registers_schemes == ()
```

(If the parse entrypoint is a `Manifest.parse`/`load_manifest` function, adjust the import — read `common.py`'s bottom half first.)

- [ ] **Step 2: Run to verify failure**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_overlay_registers_scheme.py -v`
Expected: FAIL (no `registers_schemes` field / manifests lack the triples).

- [ ] **Step 3: Implement parsing** — in `common.py`, add to the `Manifest` dataclass:

```python
    registers_schemes: tuple[URIRef, ...] = ()
```
and in the manifest-parsing function (where other `OVERLAY.x` objects are read):
```python
    registers = tuple(g.objects(overlay_iri, OVERLAY.registersScheme))
```
threading it into the `Manifest(...)` construction.

- [ ] **Step 4: Implement the deploy block** — in `apply.py`'s `apply_overlay`, after capability checks (semantics per spec §6.1 — present=200 no-op with graph-diff log; absent=install bundled `schemes/{key}.ttl` if the overlay carries one, else hard error):

```python
        # 9d. registersScheme (D111 §6.1): ensure each declared scheme record exists.
        # Present (200) -> no-op; if the overlay bundles a record that differs from
        # the installed one, LOG and do not overwrite (conflicts -> curation loop).
        # Absent (404) -> install the bundled record, or fail if none bundled.
        for scheme in manifest.registers_schemes:
            url = absolutize(pod_url, str(scheme))
            key = url.rstrip("/").rsplit("/", 1)[-1]
            local = overlay_dir / "schemes" / f"{key}.ttl"
            r = client.head(url)
            if r.status_code == 200:
                if local.exists():
                    live = Graph().parse(data=client.get(url, headers={"Accept": "text/turtle"}).text,
                                         format="turtle", publicID=url)
                    mine = Graph().parse(local, format="turtle", publicID=url)
                    if not live.isomorphic(mine):
                        print(f"  registersScheme: {key} present but differs from bundled copy — NOT overwriting (curation)")
                print(f"  registersScheme: {key} present")
                continue
            if not local.exists():
                raise SystemExit(f"registersScheme: {url} absent and overlay bundles no schemes/{key}.ttl "
                                 f"— apply the identifier-schemes overlay first")
            resp = client.put(url, content=local.read_bytes(),
                              headers={"Content-Type": "text/turtle"})
            resp.raise_for_status()
            print(f"  registersScheme: installed {key}")
```

(Match `apply_overlay`'s existing client/print idioms — read blocks 9a–9c first and mirror.)

- [ ] **Step 5: Add the manifest triples** — `overlays/wiki-memory/manifest.ttl`:

```turtle
    overlay:registersScheme
        <https://pod.vardeman.me/id/schemes/doi> ,
        <https://pod.vardeman.me/id/schemes/citekey> ,
        <https://pod.vardeman.me/id/schemes/orcid> ;
```
`overlays/addressbook/manifest.ttl`:
```turtle
    overlay:registersScheme
        <https://pod.vardeman.me/id/schemes/orcid> ,
        <https://pod.vardeman.me/id/schemes/did> ;
```

- [ ] **Step 6: Run tests + live re-apply**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_overlay_registers_scheme.py -v`
Expected: 3 PASS.
Run: `~/uvws/.venv/bin/python -m scripts.overlay.apply overlays/wiki-memory --target https://pod.vardeman.me/vault/`
Expected: three `registersScheme: <key> present` lines, no errors.

- [ ] **Step 7: Commit**

```bash
git add scripts/overlay/common.py scripts/overlay/apply.py overlays/wiki-memory/manifest.ttl overlays/addressbook/manifest.ttl tests/test_overlay_registers_scheme.py
git commit -m "[Agent: Claude] D111: overlay:registersScheme — presence-check deploy block; wiki-memory + addressbook declare scheme needs

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 12: Discovery edge + substrate vocabulary + audit shape

**Files:**
- Modify: `css/config/void-description.json` (one StaticStorageDescriber entry)
- Modify: the substrate vocabulary source (find with `grep -rln "identifierSchemeCatalog\|affordanceCatalog" overlays/wiki-memory/ontology/ overlays/wiki-memory/vocabulary/` — add the term beside `sub:shapeCatalog`)
- Modify: `shapes/substrate/storage-description.shacl.ttl` (new required pointer)

- [ ] **Step 1: Add the storage-description entry** (in void-description.json, after the shapeCatalog entry):

```json
          {
            "comment": "D111: identifier-scheme catalog pointer — the Pod-level PID system at /id/ (OUTSIDE the storage root; rename-proof datatype IRIs)",
            "@type": "StaticStorageDescriber",
            "terms": [
              {
                "StaticStorageDescriber:_terms_key": "https://pod.vardeman.me/vault/ontology/substrate#identifierSchemeCatalog",
                "StaticStorageDescriber:_terms_value": "https://pod.vardeman.me/id/schemes/"
              }
            ]
          },
```

- [ ] **Step 2: Define `sub:identifierSchemeCatalog` in the substrate vocabulary** (beside its sibling catalog terms, mirroring their rdfs:label/comment style):

```turtle
sub:identifierSchemeCatalog a rdf:Property ;
    rdfs:label "identifier-scheme catalog" ;
    rdfs:comment "Points from a storage description to the Pod-level identifier-scheme catalog (D111). The catalog is a dcat:Catalog of dereferenceable scheme records whose fragment IRIs are the datatypes of identifier literals." ;
    rdfs:isDefinedBy <https://pod.vardeman.me/vault/ontology/substrate> .
```

- [ ] **Step 3: Require the pointer in the audit shape** — add to `wiki:StorageDescriptionShape`'s properties in `shapes/substrate/storage-description.shacl.ttl`:

```turtle
    sh:property [
        sh:path sub:identifierSchemeCatalog ;
        sh:minCount 1 ;
        sh:nodeKind sh:IRI ;
        sh:message "Storage description must point at the identifier-scheme catalog via sub:identifierSchemeCatalog (D111)."
    ] ;
```

- [ ] **Step 4: Rebuild + verify**

```bash
make rebuild
curl -sk https://pod.vardeman.me/vault/.well-known/solid -H 'Accept: text/turtle' | grep identifierSchemeCatalog
make audit
```
Expected: the pointer triple served; `make audit` 0 ERROR (the walker HEAD-checks the new pointer — `/id/schemes/` answers 200).

- [ ] **Step 5: Commit**

```bash
git add css/config/void-description.json shapes/substrate/storage-description.shacl.ttl overlays/wiki-memory/ontology/ overlays/wiki-memory/vocabulary/
git commit -m "[Agent: Claude] D111: sub:identifierSchemeCatalog discovery edge — served, vocab-defined, audit-required

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 13: `pod_audit.py` bijection check (defense-in-depth)

**Files:**
- Modify: `scripts/pod_audit.py` (new check after the shape-catalog walk, ~line 509+)
- Test: extend `tests/test_pod_audit_type_index.py`-style unit if the audit has offline-testable helpers; otherwise live verification via `make audit`

- [ ] **Step 1: Implement the check** (mirror `pod_audit.py`'s existing walk/finding idioms — severity constants, `findings.append` style):

```python
def check_scheme_catalog_bijection(client, findings, storage_desc_graph):
    """D111 §4.4 defense-in-depth: every derived catalog entry has a record whose
    foaf:primaryTopic points back, and every record has an entry. Enforcement is
    the IdCatalogStore (server-managed derivation); this catches substrate bugs
    and admin hand-edits, not agents."""
    SUB = Namespace("https://pod.vardeman.me/vault/ontology/substrate#")
    FOAF = Namespace("http://xmlns.com/foaf/0.1/")
    LDP = Namespace("http://www.w3.org/ns/ldp#")
    cats = list(storage_desc_graph.objects(None, SUB.identifierSchemeCatalog))
    if not cats:
        return  # pointer absence is the storage-description shape's finding, not ours
    cat_url = str(cats[0])
    g = Graph().parse(data=client.get(cat_url, headers={"Accept": "text/turtle"}).text,
                      format="turtle", publicID=cat_url)
    entries = {str(s) for s in g.subjects(FOAF.isPrimaryTopicOf, None)}
    records = {str(o) for o in g.objects(None, LDP.contains)
               if not str(o).endswith("/")}
    topics_of_records = set()
    for rec in records:
        rg = Graph().parse(data=client.get(rec, headers={"Accept": "text/turtle"}).text,
                           format="turtle", publicID=rec)
        t = next(rg.objects(URIRef(rec), FOAF.primaryTopic), None)
        if t is None:
            findings.append(("ERROR", f"scheme record {rec} has no foaf:primaryTopic"))
            continue
        topics_of_records.add(str(t))
    for orphan in entries - topics_of_records:
        findings.append(("ERROR", f"derived catalog entry {orphan} has no backing record (hand-edit?)"))
    for missing in topics_of_records - entries:
        findings.append(("ERROR", f"record topic {missing} missing from derived catalog (derivation bug)"))
```

Wire the call where the other walks run, passing the existing client/findings/storage-description graph (mirror the signature conventions actually in the file — adjust names to fit; the LOGIC above is normative).

- [ ] **Step 2: Run the audit live**

Run: `make audit`
Expected: 0 ERROR (the 1 known intentional WARN remains). Temporarily hand-PATCH a fake entry to prove the check fires, then revert:

```bash
# (the IdCatalogStore guard blocks the front door — go through the filesystem? NO.
#  Simplest negative test: temporarily comment the IdCatalogStore import in config? Skip —
#  assert the positive path only; the unit-level guard tests in Task 6 cover the negative.)
```

- [ ] **Step 3: Commit**

```bash
git add scripts/pod_audit.py
git commit -m "[Agent: Claude] D111: pod_audit scheme-catalog bijection check (defense-in-depth)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 14: Integration e2e suite (the §11.4 typed-literal path + the curl loop, as pytest)

**Files:**
- Create: `tests/test_id_schemes_integration.py`

- [ ] **Step 1: Write the tests** (mirror the Pod-availability gate used across `tests/` — the `requires_pod` marker / skipif fixture from `conftest.py`; read `tests/test_admission_floor_integration.py`'s header and copy its client/marker conventions exactly):

```python
# tests/test_id_schemes_integration.py
"""D111 e2e: the identifier-scheme substrate against the live Pod.
Covers spec §7.2 (registration loop), §4.4 (derived catalog, in-band),
§11.4 (typed literals survive the in-band projection path), §6.2 (authoring)."""
import os, pytest, httpx

POD = "https://pod.vardeman.me"
CAT = f"{POD}/id/schemes/"
pytestmark = pytest.mark.requires_pod  # match the repo's actual marker name

@pytest.fixture
def client():
    with httpx.Client(verify=os.environ.get("SSL_CERT_FILE", False) or False) as c:
        yield c

def test_catalog_dereferences_with_all_seed_entries(client):
    g = client.get(CAT, headers={"Accept": "text/turtle"}).text
    for key in ("doi", "orcid", "ror", "arxiv", "citekey", "did", "did-oyd", "solid-resource"):
        assert f"#{key}" in g, f"thin entry missing: {key}"

def test_datatype_iri_dereferences_to_catalog(client):
    # an agent holding "10.1/x"^^<…/id/schemes/#doi> GETs the datatype → the catalog answers
    r = client.get(f"{CAT}#doi", headers={"Accept": "text/turtle"})
    assert r.status_code == 200 and "prefLabel" in r.text

def test_record_has_abstract_subject_and_providers(client):
    t = client.get(f"{CAT}doi", headers={"Accept": "text/turtle"}).text
    assert f"<{CAT}#doi>" in t or "/id/schemes/#doi" in t
    assert "{$id}" in t and "idRegexPattern" in t

def test_nonconformant_registration_422_with_report(client):
    r = client.put(f"{CAT}zz-bad", content=b'<> <http://purl.org/dc/terms/title> "no topic" .',
                   headers={"Content-Type": "text/turtle"})
    assert r.status_code == 422 and "ValidationReport" in r.text

def test_curl_grade_registration_loop_and_derived_entry(client):
    body = f'''@prefix foaf: <http://xmlns.com/foaf/0.1/> . @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> . @prefix idot: <http://identifiers.org/idot/> .
@prefix dct: <http://purl.org/dc/terms/> .
<> a foaf:Document ; dct:title "e2e scheme" ; foaf:primaryTopic <{CAT}#zz-e2e> .
<{CAT}#zz-e2e> a idot:Namespace, skos:Concept, rdfs:Datatype ;
  skos:prefLabel "ZZ"@en ; skos:definition "e2e"@en ;
  idot:idRegexPattern "^Z\\\\d+$" ; idot:exampleIdentifier "Z1" .'''
    try:
        r = client.put(f"{CAT}zz-e2e", content=body.encode(),
                       headers={"Content-Type": "text/turtle"})
        assert r.status_code in (201, 205)
        cat = client.get(CAT, headers={"Accept": "text/turtle"}).text
        assert "#zz-e2e" in cat, "derived entry not in-band"
    finally:
        client.delete(f"{CAT}zz-e2e")
    assert "#zz-e2e" not in client.get(CAT, headers={"Accept": "text/turtle"}).text

def test_patch_touching_derived_entry_rejected(client):
    patch = f'''@prefix solid: <http://www.w3.org/ns/solid/terms#>.
<> a solid:InsertDeletePatch; solid:inserts {{ <{CAT}#fake> a <http://example.org/T> . }}.'''
    r = client.patch(f"{CAT}.meta", content=patch.encode(), headers={"Content-Type": "text/n3"})
    assert r.status_code == 409

def test_body_span_typed_literal_survives_inband_projection(client):
    """Spec §11.4: the D108 in-band path must carry ^^ids:doi unchanged."""
    md = ('---\ntype: source\ntitle: D111 span probe\ncreated: 2026-06-05\n'
          'identifier: doi:10.1234/seed\n---\n# P\n\n'
          '[10.5555/span-axis]{.identifier^^ids:doi}\n')
    url = f"{POD}/vault/wiki/concepts/d111-span-probe.md"
    try:
        r = client.put(url, content=md.encode(), headers={"Content-Type": "text/markdown"})
        assert r.status_code in (201, 205), r.text
        meta = client.get(f"{url}.meta", headers={"Accept": "text/turtle"}).text
        assert "id/schemes/#doi" in meta
        assert "10.1234/seed" in meta            # frontmatter compact-id, typed
        assert "10.5555/span-axis" in meta        # body span axis, typed
    finally:
        client.delete(url)
```

- [ ] **Step 2: Run against the live Pod**

Run: `SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/test_id_schemes_integration.py -v`
Expected: 7 PASS. (If `test_body_span_typed_literal...` fails on the span literal, the rebuilt server may predate Task 8 — `make rebuild` and rerun.)

- [ ] **Step 3: Run the FULL suite both ways**

Run: `make test` (Pod up) — expected: green, no new failures.
Run: `docker compose stop css && make test-py && docker compose start css` — expected: new integration tests SKIP cleanly via the marker (honest Pod-down green).

- [ ] **Step 4: Commit**

```bash
git add tests/test_id_schemes_integration.py
git commit -m "[Agent: Claude] D111: e2e suite — registration loop, derived catalog, 409 guard, typed-literal in-band path (§11.4)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 15: Reproducibility, docs, and decision registration

**Files:**
- Modify: `.claude/skills/decision-lookup/decisions.md` (D111 entry + D104/D87/D84 reconciliation amendments)
- Modify: `docs/decisions/typed-wikilink-syntax-provenance.md` (the `^^`/`@lang` Sparna deviation)
- Modify: `CLAUDE.md` (repo-structure section: add `overlays/identifier-schemes/` + `css/extensions/id-catalog/` lines)
- Modify: `.claude/memory/MEMORY.md` + `FOLLOWUPS.md` (state update; deferred items: PropertyValue materialization → sub-C, RO-Crate/Croissant seeds, WAC gate activation with the security profile, `Link rel="profile"` document-kind hints on catalog + record docs — needs `dct:conformsTo` in their `.meta` for the profile-link writer to fire; small, deferred)

- [ ] **Step 1: `make reset` reproducibility** — the gate for "substrate ≡ repo":

Run: `make reset && make verify`
Expected: seed completes; `make audit` 0 ERROR — proving a fresh volume reproduces the full `/id/` substrate (overlay first in pod-setup sequence). Then `SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/test_id_schemes_integration.py -v` → 7 PASS again.

- [ ] **Step 2: Register D111 in `decisions.md`** — full entry (statement, rationale, supersessions: none; cross-refs D104/D107/D108/D109/D110/D55/D83/D86/D88/D98) pointing at the spec; PLUS the three §11 amendments appended to the D104, D87, D84 entries verbatim from spec §11.1–11.3.

- [ ] **Step 3: Amend the provenance doc** — add a "Datatype/lang span-literal extension (D111)" section to `docs/decisions/typed-wikilink-syntax-provenance.md`: the Sparna draft has NO datatype syntax (verified 2026-06-05); `[text]{.pred^^prefix:local}` and `@lang` are wiki-memory's own extension on the lineage; datatype CURIEs resolve via `DATATYPE_PREFIXES` ↔ served-context agreement.

- [ ] **Step 4: Update CLAUDE.md repo structure + MEMORY.md/FOLLOWUPS.md** — MEMORY.md project-state: D111 shipped line (catalog live at `/id/schemes/`, datatype form, what's deferred); FOLLOWUPS: the three deferred items above + "lock-bypass note in IdCatalogStore.rewriteMeta (single-writer assumption — revisit at multi-agent WAC activation)".

- [ ] **Step 5: Final full verification + commit**

Run: `make test && make audit`
Expected: honestly green / 0 ERROR.

```bash
git add .claude/skills/decision-lookup/decisions.md docs/decisions/typed-wikilink-syntax-provenance.md CLAUDE.md .claude/memory/MEMORY.md FOLLOWUPS.md
git commit -m "[Agent: Claude] D111 registered: identifier-scheme substrate shipped (decisions.md + reconciliations + provenance amendment + memory)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

**Post-plan (not in this plan):** the §7.4 cold-agent probes (resolve + register) — run as a Rung-1.5-class eval session against the deployed substrate; vault decisions-log sync; the push decision.

---

## Plan self-review notes

- **Spec coverage:** §4.1 placement → T1/T5; §4.2 datatype form → T4 guard test + T8; §4.3 separation → T4 record frames; §4.4 derived catalog → T6/T7/T13; §4.5 discovery → T12; §5 records/roles → T4; §6.1 registration → T11; §6.2 authoring (span + frontmatter + agreement web) → T8/T9/T10; §7.1–7.2 floor → T3/T5/T14; §7.3 already verified pre-spec; §11 reconciliation → T15; §9.1 blocking idot confirm → T2. WAC gating: consciously NOT in plan (dev-allow-all auth; activates with the security profile — recorded in FOLLOWUPS, T15).
- **Known judgment calls encoded:** datatype prefixes as code-constant + agreement test (the CURIE_PREFIXES idiom) rather than Components.js param; IdCatalogStore between Locking and Patching (patch-text inspection before application); internal `.meta` rewrite below Locking (single-writer trade-off, documented); `did` keeps full lexical form in compact-id.
- **Exemplar-mirroring requirement (fragility lesson):** Tasks 6, 7, 11, 13, 14 each name their in-repo exemplar (`AdmissionFloorStore`, `solid-config.json` floor Override, apply.py blocks 9a–9c, pod_audit walk idioms, `test_admission_floor_integration.py` conventions) — executors must read the exemplar before writing.
