// Model A: governed-predicate sets per L3 wiki-memory shape class (D77).
//
// Each set defines which predicates the projection listener is allowed to
// write into a .meta sidecar for resources of that class.  Predicates NOT in
// the set are silently dropped — this prevents agent hallucinations from
// polluting the durable graph layer (D50/D72).
//
// URN class keys intentionally use urn:example:wiki# for now; they will be
// replaced with the minted namespace once RQ-Harness-1 resolves.

const RESOURCE_BASELINE = [
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    "http://purl.org/dc/terms/title",
    "http://purl.org/dc/terms/identifier",
    "http://purl.org/dc/terms/created",
    "http://purl.org/dc/terms/modified",
    "urn:example:wiki#maturity",
    "http://www.w3.org/ns/prov#wasGeneratedBy",
];

const CONCEPT_ADDITIONS = [
    "http://www.w3.org/2004/02/skos/core#broader",
    "http://www.w3.org/2004/02/skos/core#related",
    "http://purl.org/dc/terms/subject",
    "http://purl.org/dc/terms/references",
    "http://purl.org/dc/terms/contributor",
    "http://purl.org/spar/cito/extends",
    "http://purl.org/spar/cito/agreesWith",
    "http://purl.org/spar/cito/disagreesWith",
];

const SOURCE_ADDITIONS = [
    "http://purl.org/dc/terms/creator",
];

const PERSON_ADDITIONS = [
    "http://xmlns.com/foaf/0.1/nick",
    "http://xmlns.com/foaf/0.1/affiliation",
];

const PROCEDURE_ADDITIONS = [
    "http://www.w3.org/ns/shacl#agentInstruction",
];

const WORKING_NOTE_ONLY = [
    "http://purl.org/dc/terms/title",
    "http://purl.org/dc/terms/created",
];

export const GOVERNED_FOR: Record<string, string[]> = {
    "urn:example:wiki#Resource":    RESOURCE_BASELINE,
    "urn:example:wiki#Concept":     [...RESOURCE_BASELINE, ...CONCEPT_ADDITIONS],
    "urn:example:wiki#Source":      [...RESOURCE_BASELINE, ...SOURCE_ADDITIONS],
    "urn:example:wiki#Person":      [...RESOURCE_BASELINE, ...PERSON_ADDITIONS],
    "urn:example:wiki#Procedure":   [...RESOURCE_BASELINE, ...PROCEDURE_ADDITIONS],
    "urn:example:wiki#WorkingNote": WORKING_NOTE_ONLY,
};

export function governedPredicates(classUri: string): string[] {
    const set = GOVERNED_FOR[classUri];
    if (!set) throw new Error(`No governed-predicate set for class: ${classUri}`);
    return set;
}
