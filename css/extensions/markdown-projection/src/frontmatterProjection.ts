// Projects YAML frontmatter fields to N3.js Quad objects for .meta sidecar writes.
//
// Only a governed subset of frontmatter keys is mapped — unknown keys are
// silently dropped (D50 hallucination guard).  The subject node is a placeholder
// named node; callers replace it with the actual resource URI before serialising.

import { DataFactory, Quad } from "n3";

const { namedNode, literal, quad } = DataFactory;

// CURIE prefix map — the projection-side half of a mirror with the SERVED
// JSON-LD context at overlays/wiki-memory/context-fragment.jsonld (D79: the
// served context is the agents' source of truth). Reconciliation (R-T7): the
// invariant is set EQUALITY of the prefix-declaration terms across the two
// sides. Rationale — a frontmatter `type:` CURIE that resolves for an agent
// reading the served context MUST resolve here in projection, OR a CURIE this
// map can expand must be one the agent can find documented in the context.
// One-directional superset is too weak: a context-only prefix (sub/vann/td/xsd)
// silently fails to project; a projection-only prefix (prov/as/mem/owl/rdfs/
// vcard) that lands in .meta output has no published expansion an agent can
// look up. So both sides carry the union. context-fragment.jsonld was the wrong
// side for sub/vann/td/xsd (already declared there) AND for skos/dct (used by
// its term-CURIEs but never declared as prefixes — a latent JSON-LD defect this
// reconciliation fixes by adding the declarations there). Agreement test:
// css/extensions/markdown-projection/test/curiePrefixAgreement.test.ts (reads
// the fragment JSON + the maps sidecar, asserts equality).
const CURIE_PREFIXES: Record<string, string> = {
    "skos":   "http://www.w3.org/2004/02/skos/core#",
    "schema": "https://schema.org/",
    "foaf":   "http://xmlns.com/foaf/0.1/",
    "dct":    "http://purl.org/dc/terms/",
    "cito":   "http://purl.org/spar/cito/",
    "wiki":   "https://pod.vardeman.me/vault/ontology/wiki#",
    "sub":    "https://pod.vardeman.me/vault/ontology/substrate#",
    "mem":    "https://pod.vardeman.me/vault/ontology/mem#",
    "owl":    "http://www.w3.org/2002/07/owl#",
    "rdfs":   "http://www.w3.org/2000/01/rdf-schema#",
    "vcard":  "http://www.w3.org/2006/vcard/ns#",
    "prov":   "http://www.w3.org/ns/prov#",
    "as":     "https://www.w3.org/ns/activitystreams#",
    "vann":   "http://purl.org/vocab/vann/",
    "td":     "https://www.w3.org/2019/wot/td#",
    "xsd":    "http://www.w3.org/2001/XMLSchema#",
    "ids":    "https://pod.vardeman.me/id/schemes/#",
};

// Exported so the maps-sidecar emitter (scripts/emitMaps.ts) and the agreement
// test can read the canonical prefix map without re-scraping the source.
export const CURIE_PREFIX_MAP: Readonly<Record<string, string>> = CURIE_PREFIXES;

/**
 * Resolve a CURIE or absolute IRI string to a full IRI.
 * Returns the full IRI if resolvable, otherwise undefined.
 * Resolution order:
 *   1. CURIE form "prefix:local" → expand via CURIE_PREFIXES
 *   2. Absolute IRI (starts with "http://" or "https://") → return as-is
 *   3. Otherwise → undefined (falls through to TYPE_MAP short-form lookup)
 */
export function resolveCURIE(s: string): string | undefined {
    if (s.startsWith("http://") || s.startsWith("https://")) return s;
    const colon = s.indexOf(":");
    if (colon > 0) {
        const prefix = s.slice(0, colon);
        const local  = s.slice(colon + 1);
        const base   = CURIE_PREFIXES[prefix];
        if (base) return base + local;
    }
    return undefined;
}

// Vault L4 → wiki-memory L3 shape-class mapping (D77 + MEMORY.md audit table).
// Exported (TYPE_MAP_TOKENS) for the maps sidecar + the cross-language TYPE_MAP
// agreement test (R-T7): the TS projection map and scripts/lib/rdf_gen.py's map
// intentionally differ in COVERAGE (projection maps wiki types; the importer
// maps vault types), so the invariant is NOT full equality — it is (a) where
// BOTH maps define a token they agree on the class IRI, and (b) every class IRI
// here is governed by a shape in the deployed catalog (sh:targetClass set).
const TYPE_MAP: Record<string, string> = {
    "concept":           "https://pod.vardeman.me/vault/ontology/wiki#Concept",
    "concept-note":      "https://pod.vardeman.me/vault/ontology/wiki#Concept",
    "moc":               "https://pod.vardeman.me/vault/ontology/wiki#Concept",
    "theory-note":       "https://pod.vardeman.me/vault/ontology/wiki#Concept",
    "method-note":       "https://pod.vardeman.me/vault/ontology/wiki#Concept",
    "finding":           "https://pod.vardeman.me/vault/ontology/wiki#Concept",
    "implementation-note": "https://pod.vardeman.me/vault/ontology/wiki#Concept",
    "source":            "https://pod.vardeman.me/vault/ontology/wiki#Source",
    "literature-note":   "https://pod.vardeman.me/vault/ontology/wiki#Source",
    "book-note":         "https://pod.vardeman.me/vault/ontology/wiki#Source",
    "external-resource": "https://pod.vardeman.me/vault/ontology/wiki#Source",
    "person":            "https://pod.vardeman.me/vault/ontology/wiki#Person",
    "author-note":       "https://pod.vardeman.me/vault/ontology/wiki#Person",
    "procedure":         "https://pod.vardeman.me/vault/ontology/wiki#Procedure",
    "working-note":      "https://pod.vardeman.me/vault/ontology/wiki#WorkingNote",
    "fleeting-note":     "https://pod.vardeman.me/vault/ontology/wiki#WorkingNote",
};

// Exported for the maps sidecar + cross-language agreement test.
export const TYPE_MAP_TOKENS: Readonly<Record<string, string>> = TYPE_MAP;

/**
 * Resolve a frontmatter `type:` value to its class IRI.
 * Resolution order (single-sourced so the page-type projection and the
 * pipeline's Thing-class resolution can never diverge — C-T2c):
 *   1. CURIE form "prefix:local" / absolute IRI → resolveCURIE
 *   2. Short-form vault token (concept / source / person …) → TYPE_MAP
 *   3. Otherwise → undefined (unrecognized type is silently dropped — D50
 *      hallucination guard; the container fallback then governs the Thing class)
 *
 * Returns the class IRI a CURIE/absolute resolves to, OR the wiki: DISPATCH
 * class a short-form maps to (e.g. "source" → wiki:Source). Callers that need
 * the canonical Thing class (the sh:targetClass the catalog governs, e.g.
 * skos:Concept) map the result through WIKI_CLASS_TO_THING_CLASS.
 */
export function resolveFrontmatterType(type: unknown): string | undefined {
    if (typeof type !== "string") return undefined;
    return resolveCURIE(type) ?? TYPE_MAP[type];
}

// Maturity short-form token → wiki: lifecycle IRI. The vocabulary
// (overlays/wiki-memory/vocabulary/wiki.ttl) models maturity as IRI-valued
// skos:Concepts and PageShape constrains wiki:maturity sh:in
// ( wiki:draft wiki:validated wiki:core ) — so the projection MUST emit the
// IRI, not a plain string literal. A literal "draft" fails PageShape's
// InConstraintComponent (C-T2c ground truth). Unrecognized values are dropped
// (same D50 silent-drop convention as an unrecognized type:), so a typo never
// produces a triple PageShape would reject at write time.
const WIKI_NS = "https://pod.vardeman.me/vault/ontology/wiki#";
const MATURITY_MAP: Record<string, string> = {
    "draft":     WIKI_NS + "draft",
    "validated": WIKI_NS + "validated",
    "core":      WIKI_NS + "core",
};

// Exported for the maps sidecar + agreement test.
export const MATURITY_MAP_TOKENS: Readonly<Record<string, string>> = MATURITY_MAP;

// D111 §6.2 — compact-identifier convention (identifiers.org form) on the
// identifier: field. Split on the FIRST colon; a registered scheme key types
// the literal with the catalog-fragment datatype. did keeps the full string
// (its scheme regex anchors on "did:" — the lexical form IS the whole DID).
// Unknown prefix / no colon / absolute IRI → plain literal (suggestive typing;
// Tier-2 curation flags). citekey: field stays untyped (curation-loop work).
// IDS_NS is single-sourced from the CURIE map so the datatype IRI can never
// diverge from the served context's "ids" prefix.
const IDS_NS = CURIE_PREFIXES["ids"];
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

const XSD_DT  = "http://www.w3.org/2001/XMLSchema#dateTime";
const DCT     = "http://purl.org/dc/terms/";
const FOAF    = "http://xmlns.com/foaf/0.1/";
const WIKI    = "https://pod.vardeman.me/vault/ontology/wiki#";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

// Placeholder subject URI — callers must replace with actual resource URI
// before inserting triples into the .meta store.
const PLACEHOLDER_SUBJECT = "urn:placeholder:subject";

export interface Frontmatter {
    type?: string;
    title?: string;
    created?: string;
    modified?: string;
    maturity?: string;
    aliases?: string[];
    identifier?: string;
    citekey?: string;
    [k: string]: unknown;
}

export function projectFrontmatter(fm: Frontmatter): Quad[] {
    const subj = namedNode(PLACEHOLDER_SUBJECT);
    const out: Quad[] = [];

    if (fm.type) {
        // CURIE / absolute IRI / short-form vault token (concept, source, …)
        const cls = resolveFrontmatterType(fm.type);
        if (cls) out.push(quad(subj, namedNode(RDF_TYPE), namedNode(cls)));
    }

    if (fm.title)    out.push(quad(subj, namedNode(DCT + "title"),    literal(fm.title)));
    if (fm.created)  out.push(quad(subj, namedNode(DCT + "created"),  literal(fm.created,  namedNode(XSD_DT))));
    if (fm.modified) out.push(quad(subj, namedNode(DCT + "modified"), literal(fm.modified, namedNode(XSD_DT))));
    // maturity is IRI-valued (wiki:draft/validated/core) — PageShape sh:in
    // rejects a string literal. Map the short-form token to its IRI; drop
    // unrecognized values (D50).
    if (fm.maturity) {
        const m = MATURITY_MAP[fm.maturity];
        if (m) out.push(quad(subj, namedNode(WIKI + "maturity"), namedNode(m)));
    }

    // identifier wins over citekey; identifier gets compact-id typing, citekey stays plain
    if (fm.identifier) out.push(quad(subj, namedNode(DCT + "identifier"), identifierLiteral(fm.identifier)));
    else if (fm.citekey) out.push(quad(subj, namedNode(DCT + "identifier"), literal(fm.citekey)));

    if (fm.aliases && Array.isArray(fm.aliases)) {
        for (const a of fm.aliases) {
            out.push(quad(subj, namedNode(FOAF + "nick"), literal(a)));
        }
    }

    return out;
}
