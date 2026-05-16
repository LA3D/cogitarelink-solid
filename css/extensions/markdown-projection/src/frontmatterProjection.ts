// Projects YAML frontmatter fields to N3.js Quad objects for .meta sidecar writes.
//
// Only a governed subset of frontmatter keys is mapped — unknown keys are
// silently dropped (D50 hallucination guard).  The subject node is a placeholder
// named node; callers replace it with the actual resource URI before serialising.

import { DataFactory, Quad } from "n3";

const { namedNode, literal, quad } = DataFactory;

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
        const cls = TYPE_MAP[fm.type];
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
