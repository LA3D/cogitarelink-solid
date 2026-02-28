# SOLID Pod Decisions Index

Always loaded. Concise index of all architectural decisions.

D1: CSS + Python adapter — CSS (TypeScript Pod server, file backend) + FastAPI adapter (Python, .well-known/ gateway, vault importer); not pure Python, not pure CSS
D2: Pod as fabric node type — Pod participates in fabric via `.well-known/` protocol (same as Oxigraph nodes); not client, not overlay
D3: Comunica for Pod SPARQL — client-side SPARQL federation over LDP resources; no data duplication into triplestore
D4: Oxigraph for fabric metadata only — catalog (VoID), crosswalks (SSSOM), navigational ontology; not Pod content
D5: Vault-to-Pod as MVP — Agentic Memory Systems concept notes (~20 files); not synthetic data, not full vault
D6: Markdown as primary Pod document format — Markdown with YAML frontmatter (content layer); Turtle for `.meta` sidecars (Layer B); JSON-LD for navigation index (Layer C)
D7: Frontmatter → RDF mapping via SHACL shape — SHACL shape defines predicate vocabulary per note type; default wikilink predicate = `skos:related`; importer reads shape, builds mapping, validates generated Turtle
D8: Solid Type Index as primary machine-actionable navigation — maps RDF class → container URL (coarse discovery)
D9: Dual-index pattern — Type Index (machines) + JSON-LD index (agents) + `.well-known/void` (fabric) + VAULT-INDEX.md (humans) coexist
D10: Three-layer Pod RDF architecture — Layer A: LDP container structure (automatic, CSS-generated); Layer B: resource metadata (Turtle `.meta` sidecars, SHACL-governed); Layer C: navigation indexes (Type Index, JSON-LD, VoID)
D11: Shared SHACL shapes — define in fabric, reference from Shape Trees; also governs frontmatter → RDF mapping (three-way enforcement: import, Pod write, fabric load)
D12: CoreProfile conformance for Pod — same PROF declaration as fabric nodes; `discover_endpoint()` works unchanged
D13: Comunica federation across Pod LDP + Oxigraph SPARQL — unified SPARQL layer; agent reasons about datasets (VoID), not servers
D14: `alsoKnownAs` DID-WebID bridge in first WebID profile — identity bridge as foundation, not add-on (Phase 1)
D15: VoID feature flags — `void:feature` entries distinguish Pod-type nodes (LDP browse) from triplestore-type nodes
D16: OSLC Query 3.0 for Pod search — standard URL parameters on LDP container GET (`oslc.searchTerms`, `oslc.where`, `oslc.select`)
D17: TRS 3.0 for change tracking — standard change data capture drives index sync; replaces filesystem watchers
D18: SQLite FTS5 + sqlite-vec — embedded hybrid search index sidecar; no additional container
D19: CSS extension via MonitoringStore + WaterfallHandler — Components.js DI config, not CSS fork
D20: PROV-O provenance on Pod resources — importer-generated in `.meta` sidecars; `prov:wasGeneratedBy`, `prov:wasDerivedFrom`, `prov:wasAttributedTo`; SHACL-validated
D21: Content integrity via `digestMultibase` — SHA-256 hashes in `.meta` sidecars; re-computed on TRS events
D22: `.well-known/sparql-examples` — behavioral SPARQL templates generated from SHACL shapes; `sh:SPARQLExecutable` format
D23: TBox cache in `/ontology/` container — local ontology stubs (SKOS, DC, PROV-O) for offline/constrained query resolution
D24: SSSOM crosswalk generation — wikilink names → Pod URIs, tags → SKOS concepts, frontmatter keys → predicates
D25: VC lifecycle for Pod access — ACP + `acp:vc` matchers; Credo-TS sidecar issues VCs; Phase 3 experiment
D26: LDN inbox multiplexing — type-based dispatch for VC delivery, TRS change, IoT notifications; single `POST /inbox`
D27: Schema-level TRS freshness — re-harvest VoID catalog when Pod data shape changes, not on every resource write

Full log: ~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md
Plan: ~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-PLAN.md
