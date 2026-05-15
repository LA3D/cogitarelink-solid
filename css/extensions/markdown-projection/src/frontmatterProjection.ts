// Projects YAML frontmatter fields to N3.js Quad objects for .meta sidecar writes.
//
// Only a governed subset of frontmatter keys is mapped — unknown keys are
// silently dropped (D50 hallucination guard).  The subject node is a placeholder
// named node; callers replace it with the actual resource URI before serialising.

import { DataFactory, Quad } from "n3";

const { namedNode, literal, quad } = DataFactory;

// Vault L4 → wiki-memory L3 shape-class mapping (D77 + MEMORY.md audit table)
const TYPE_MAP: Record<string, string> = {
    "concept":           "urn:example:wiki#Concept",
    "concept-note":      "urn:example:wiki#Concept",
    "moc":               "urn:example:wiki#Concept",
    "theory-note":       "urn:example:wiki#Concept",
    "method-note":       "urn:example:wiki#Concept",
    "finding":           "urn:example:wiki#Concept",
    "implementation-note": "urn:example:wiki#Concept",
    "source":            "urn:example:wiki#Source",
    "literature-note":   "urn:example:wiki#Source",
    "book-note":         "urn:example:wiki#Source",
    "external-resource": "urn:example:wiki#Source",
    "person":            "urn:example:wiki#Person",
    "author-note":       "urn:example:wiki#Person",
    "procedure":         "urn:example:wiki#Procedure",
    "working-note":      "urn:example:wiki#WorkingNote",
    "fleeting-note":     "urn:example:wiki#WorkingNote",
};

const XSD_DT  = "http://www.w3.org/2001/XMLSchema#dateTime";
const DCT     = "http://purl.org/dc/terms/";
const FOAF    = "http://xmlns.com/foaf/0.1/";
const WIKI    = "urn:example:wiki#";
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
