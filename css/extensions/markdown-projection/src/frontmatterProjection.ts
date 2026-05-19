// Projects YAML frontmatter fields to N3.js Quad objects for .meta sidecar writes.
//
// Only a governed subset of frontmatter keys is mapped — unknown keys are
// silently dropped (D50 hallucination guard).  The subject node is a placeholder
// named node; callers replace it with the actual resource URI before serialising.

import { DataFactory, Quad } from "n3";

const { namedNode, literal, quad } = DataFactory;

// CURIE prefix map — mirrors the JSON-LD context at overlays/wiki-memory/context-fragment.jsonld
// and the vault ontology. Supports 'skos:Concept', 'schema:Person', etc. in frontmatter type: fields.
const CURIE_PREFIXES: Record<string, string> = {
    "skos":   "http://www.w3.org/2004/02/skos/core#",
    "schema": "https://schema.org/",
    "foaf":   "http://xmlns.com/foaf/0.1/",
    "dct":    "http://purl.org/dc/terms/",
    "cito":   "http://purl.org/spar/cito/",
    "wiki":   "https://pod.vardeman.me/vault/ontology/wiki#",
    "mem":    "https://pod.vardeman.me/vault/ontology/mem#",
    "owl":    "http://www.w3.org/2002/07/owl#",
    "rdfs":   "http://www.w3.org/2000/01/rdf-schema#",
    "vcard":  "http://www.w3.org/2006/vcard/ns#",
    "prov":   "http://www.w3.org/ns/prov#",
    "as":     "https://www.w3.org/ns/activitystreams#",
};

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

// Vault L4 → wiki-memory L3 shape-class mapping (D77 + MEMORY.md audit table)
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
        // Resolution order: CURIE → absolute IRI → TYPE_MAP short-form
        const curie = resolveCURIE(fm.type);
        const cls   = curie ?? TYPE_MAP[fm.type];
        if (cls) out.push(quad(subj, namedNode(RDF_TYPE), namedNode(cls)));
    }

    if (fm.title)    out.push(quad(subj, namedNode(DCT + "title"),    literal(fm.title)));
    if (fm.created)  out.push(quad(subj, namedNode(DCT + "created"),  literal(fm.created,  namedNode(XSD_DT))));
    if (fm.modified) out.push(quad(subj, namedNode(DCT + "modified"), literal(fm.modified, namedNode(XSD_DT))));
    if (fm.maturity) out.push(quad(subj, namedNode(WIKI + "maturity"), literal(fm.maturity)));

    // identifier wins over citekey; both map to dct:identifier
    const id = fm.identifier ?? fm.citekey;
    if (id) out.push(quad(subj, namedNode(DCT + "identifier"), literal(id)));

    if (fm.aliases && Array.isArray(fm.aliases)) {
        for (const a of fm.aliases) {
            out.push(quad(subj, namedNode(FOAF + "nick"), literal(a)));
        }
    }

    return out;
}
