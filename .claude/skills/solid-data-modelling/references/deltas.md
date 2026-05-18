# Project deltas — solid-data-modelling

This Pod diverges from upstream Solid data-modelling defaults in four places.

## D34 — SKOS as foundation vocabulary

D34: SKOS as foundation vocabulary — first use of SKOS for end-user content in Solid ecosystem

**Authoritative artifact**: `ontology/vault-ontology.ttl` (PARA categories and memory partitions as SKOS ConceptSchemes).

## D46 — Shapes contributed upstream to solid/shapes

D46: Shapes contributed upstream to `solid/shapes` — domain-neutral shapes go upstream; vault-specific shapes stay local (revises D11)

**Authoritative artifact**: Domain-neutral shapes get proposed upstream to `solid/shapes`; vault-specific shapes stay in `shapes/`.

## D77 — Wiki-memory L3 SHACL shape catalog (5 shapes)

D77: Wiki-memory L3 SHACL shape catalog — five shapes, one per D76 container: `wiki:PageShape` (general wiki content, permissive), `wiki:SourceShape` (citation records with `dct:identifier` required), `wiki:PersonShape` (FOAF-based with `foaf:nick` aliases for cross-system linking), `wiki:ProcedureShape` (procedural memory with `sh:agentInstruction` carrying the procedure body), `wiki:WorkingNoteShape` (permissive per D73). Each carries `sh:agentInstruction` per D50. Flavor-within-shape pattern: 12+ vault L4 note types collapse into 5 L3 shapes distinguished by `.meta` predicates (`vault:kind`, `vault:isMOC`, `vault:isOrganization`) rather than separate containers. The vault L4 specialization extends via shape subclassing without modifying the L3 baseline. Shape files at `overlays/wiki-memory/shapes/{page,source,person,procedure,working}.shacl.ttl`.

**Authoritative artifact**: `overlays/wiki-memory/shapes/{page,source,person,procedure,working,resource}.shacl.ttl`. See sibling skill `solid-wiki-memory-l3`.

## D78 — Class-based shape targeting

D78: **Class-based shape targeting** — shapes target `rdf:type` (wiki:Concept, wiki:Source, wiki:Person, wiki:Procedure, wiki:WorkingNote) rather than container paths. REVISES D77. Solid Type Index does double duty for routing; SHACL `sh:targetClass` with `rdfs:subClassOf` inference gives automatic shape dispatch. L4 specialization via subclass. **Implementation note**: `sh:class` value-type constraints (e.g., "the target of dct:references must be a wiki:Source") cannot be enforced in per-resource validation because cross-resource targets aren't in the data graph. Shapes use `sh:nodeKind sh:IRI` only; cross-resource integrity belongs in whole-Pod SPARQL ASK checks (deferred to Rung 1.5).

**Authoritative artifact**: All shapes in `overlays/wiki-memory/shapes/` use `sh:targetClass` against `wiki:Page`, `wiki:Source`, etc., rather than container-path targeting. `wiki:Concept` is a subclass of `wiki:Page`, so `PageShape` applies to Concept instances via `rdfs:subClassOf` inference; a future `concept.shacl.ttl` will add Concept-only constraints when that sprint runs.
