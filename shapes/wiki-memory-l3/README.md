# Wiki-Memory L3 SHACL Shape Catalog

Six shapes, one per concern. `sh:targetClass` with `rdfs:subClassOf` inference means a `wiki:Concept` instance validates against ResourceShape AND ConceptShape automatically.

| File | Shape | Targets | Governed predicates |
|---|---|---|---|
| `resource.shacl.ttl` | ResourceShape | `wiki:Resource` (baseline for all) | rdf:type, dct:title, dct:identifier, dct:created, dct:modified, wiki:maturity |
| `concept.shacl.ttl` | ConceptShape | `wiki:Concept` | + skos:broader, skos:related, dct:subject, dct:references, dct:contributor, cito:extends, cito:agreesWith, cito:disagreesWith, prov:wasGeneratedBy |
| `source.shacl.ttl` | SourceShape | `wiki:Source` | + dct:creator (+ baseline) |
| `person.shacl.ttl` | PersonShape | `wiki:Person` | + foaf:nick |
| `procedure.shacl.ttl` | ProcedureShape | `wiki:Procedure` | + sh:agentInstruction |
| `working.shacl.ttl` | WorkingNoteShape | `wiki:WorkingNote` | only dct:title and dct:created required (permissive per D73) |

Each shape carries `sh:agentInstruction` documenting its governed-predicate set. The `MarkdownProjectionListener` reads these to determine which triples to refresh on body write (Model A).

Spec: `docs/superpowers/specs/2026-05-15-rung-1-4-wiki-memory-l3-implementation-design.md` §3.
