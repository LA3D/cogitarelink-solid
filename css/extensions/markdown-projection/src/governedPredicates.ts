// governedPredicates.ts
//
// Per-subject governed-predicate map for D81 Model A predicate-level
// governance, sharpened by D98 Page+Thing two-subject pattern.
//
// PAGE_GOVERNED_PREDICATES: predicates the substrate manages on the
//   page resource <> (page-level metadata).
//
// THING_GOVERNED_PREDICATES: predicates the substrate manages on the
//   Thing <#this>, keyed by the Thing's rdf:type. Each entry includes
//   the common ThingShape predicates plus type-specific ones.
//
// GOVERNED_FOR / governedPredicates(): legacy flat-string API kept for
//   backward compat with listener.ts (CJS caller). Returns the union of
//   PAGE + Thing predicates for the resource's wiki: class. Task 21 will
//   migrate listener.ts to the per-subject API; until then this shim
//   ensures the build stays green.

import { DataFactory } from "n3";
import type { NamedNode } from "n3";

const { namedNode } = DataFactory;

const DCT    = "http://purl.org/dc/terms/";
const SCHEMA = "https://schema.org/";
const SKOS   = "http://www.w3.org/2004/02/skos/core#";
const CITO   = "http://purl.org/spar/cito/";
const FOAF   = "http://xmlns.com/foaf/0.1/";
const ORG    = "http://www.w3.org/ns/org#";
const PROV   = "http://www.w3.org/ns/prov#";
const WIKI   = "https://pod.vardeman.me/vault/ontology/wiki#";
const RDF    = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const SHACL  = "http://www.w3.org/ns/shacl#";

// ---------------------------------------------------------------------------
// Page-level predicates (subject = <> / the page resource)
// ---------------------------------------------------------------------------

export const PAGE_GOVERNED_PREDICATES: NamedNode[] = [
    namedNode(DCT    + "title"),
    namedNode(DCT    + "created"),
    namedNode(DCT    + "modified"),
    namedNode(SCHEMA + "mainEntity"),
    namedNode(WIKI   + "maturity"),
    namedNode(PROV   + "wasGeneratedBy"),
    namedNode(WIKI   + "embeds"),
];

// ---------------------------------------------------------------------------
// Common Thing predicates (subject = <#this>)
// Every concrete Thing class inherits these.
// ---------------------------------------------------------------------------

const COMMON_THING_PREDICATES: NamedNode[] = [
    namedNode(SCHEMA + "name"),
    namedNode(SCHEMA + "mainEntityOfPage"),
    namedNode(SCHEMA + "identifier"),
    namedNode(SCHEMA + "sameAs"),
    namedNode(SCHEMA + "description"),
    namedNode(SCHEMA + "image"),
    namedNode(SCHEMA + "keywords"),
    namedNode(SCHEMA + "dateCreated"),
];

// ---------------------------------------------------------------------------
// Per-class Thing predicate lists (include COMMON_THING_PREDICATES)
// ---------------------------------------------------------------------------

const concept: NamedNode[] = [
    ...COMMON_THING_PREDICATES,
    namedNode(SKOS + "prefLabel"),
    namedNode(SKOS + "altLabel"),
    namedNode(SKOS + "definition"),
    namedNode(SKOS + "broader"),
    namedNode(SKOS + "narrower"),
    namedNode(SKOS + "related"),
    namedNode(SKOS + "exactMatch"),
    namedNode(SKOS + "closeMatch"),
    namedNode(CITO + "extends"),
    namedNode(CITO + "agreesWith"),
    namedNode(CITO + "disagreesWith"),
    namedNode(CITO + "cites"),
];

const person: NamedNode[] = [
    ...COMMON_THING_PREDICATES,
    namedNode(SCHEMA + "givenName"),
    namedNode(SCHEMA + "familyName"),
    namedNode(SCHEMA + "email"),
    namedNode(SCHEMA + "affiliation"),
    namedNode(FOAF  + "nick"),
    namedNode(ORG   + "hasMembership"),
];

const place: NamedNode[] = [
    ...COMMON_THING_PREDICATES,
    namedNode(SCHEMA + "address"),
    namedNode(SCHEMA + "geo"),
    namedNode(SCHEMA + "latitude"),
    namedNode(SCHEMA + "longitude"),
    namedNode(SCHEMA + "containedInPlace"),
    namedNode(SCHEMA + "containsPlace"),
];

const event: NamedNode[] = [
    ...COMMON_THING_PREDICATES,
    namedNode(SCHEMA + "startDate"),
    namedNode(SCHEMA + "endDate"),
    namedNode(SCHEMA + "location"),
    namedNode(SCHEMA + "attendee"),
    namedNode(SCHEMA + "organizer"),
    namedNode(SCHEMA + "about"),
    namedNode(SCHEMA + "superEvent"),
    namedNode(SCHEMA + "subEvent"),
];

const organization: NamedNode[] = [
    ...COMMON_THING_PREDICATES,
    namedNode(SCHEMA + "legalName"),
    namedNode(SCHEMA + "parentOrganization"),
    namedNode(SCHEMA + "subOrganization"),
    namedNode(SCHEMA + "member"),
    namedNode(SCHEMA + "foundingDate"),
    namedNode(SCHEMA + "dissolutionDate"),
];

const howto: NamedNode[] = [
    ...COMMON_THING_PREDICATES,
    namedNode(SCHEMA + "step"),
    namedNode(SCHEMA + "tool"),
    namedNode(SCHEMA + "supply"),
    namedNode(SCHEMA + "totalTime"),
];

// ---------------------------------------------------------------------------
// Public: per-class map (keyed by rdf:type IRI)
// ---------------------------------------------------------------------------

export const THING_GOVERNED_PREDICATES: Record<string, NamedNode[]> = {
    [SKOS   + "Concept"]:      concept,
    [SCHEMA + "Person"]:       person,
    [SCHEMA + "Place"]:        place,
    [SCHEMA + "Event"]:        event,
    [SCHEMA + "Organization"]: organization,
    [SCHEMA + "HowTo"]:        howto,
    [SCHEMA + "Thing"]:        COMMON_THING_PREDICATES,
};

/**
 * Get the full governed predicate set for a Thing of the given rdf:type.
 * Returns COMMON_THING_PREDICATES for unknown classes (L4 subclasses
 * inherit common Thing predicates automatically).
 */
export function getThingGovernedPredicates(thingClassIRI: string): NamedNode[] {
    return THING_GOVERNED_PREDICATES[thingClassIRI] ?? COMMON_THING_PREDICATES;
}

// ---------------------------------------------------------------------------
// Legacy flat-string API (backward compat — listener.ts CJS caller)
//
// Maps the old wiki: class keys used in the listener to a flat string[]
// union of page + thing predicates. Task 21 will replace this with per-
// subject N3 Patch delete clauses; this shim keeps the build green.
// ---------------------------------------------------------------------------

// Old wiki: class IRI → Thing class IRI (for THING_GOVERNED_PREDICATES lookup)
const WIKI_CLASS_TO_THING_CLASS: Record<string, string> = {
    [WIKI + "Concept"]:     SKOS   + "Concept",
    [WIKI + "Source"]:      SCHEMA + "Thing",    // no dedicated source class yet
    [WIKI + "Person"]:      SCHEMA + "Person",
    [WIKI + "Procedure"]:   SCHEMA + "HowTo",
    [WIKI + "WorkingNote"]: SCHEMA + "Thing",
    [WIKI + "Resource"]:    SCHEMA + "Thing",
};

// Additional legacy predicates that the old GOVERNED_FOR sets included and that
// are not covered by PAGE_GOVERNED_PREDICATES or THING_GOVERNED_PREDICATES.
const LEGACY_EXTRAS: Record<string, string[]> = {
    [WIKI + "Concept"]: [
        DCT + "subject",
        DCT + "references",
        DCT + "contributor",
    ],
    [WIKI + "Source"]: [
        DCT + "creator",
    ],
    [WIKI + "Person"]: [
        FOAF + "affiliation",
    ],
    [WIKI + "Procedure"]: [
        SHACL + "agentInstruction",
    ],
};

// Flat string[] for the legacy callers — union of page + thing + legacy extras
function flatLegacySet(wikiClass: string): string[] {
    const pageIris   = PAGE_GOVERNED_PREDICATES.map(n => n.value);
    const thingClass = WIKI_CLASS_TO_THING_CLASS[wikiClass] ?? SCHEMA + "Thing";
    const thingIris  = (THING_GOVERNED_PREDICATES[thingClass] ?? COMMON_THING_PREDICATES)
        .map(n => n.value);
    const extras     = LEGACY_EXTRAS[wikiClass] ?? [];
    // Also include rdf:type + dct:identifier used by old RESOURCE_BASELINE
    const baseline   = [RDF + "type", DCT + "identifier"];
    const all        = new Set([...pageIris, ...thingIris, ...extras, ...baseline]);
    return [...all];
}

/** @deprecated Use PAGE_GOVERNED_PREDICATES + THING_GOVERNED_PREDICATES directly. */
export const GOVERNED_FOR: Record<string, string[]> = {
    [WIKI + "Resource"]:    flatLegacySet(WIKI + "Resource"),
    [WIKI + "Concept"]:     flatLegacySet(WIKI + "Concept"),
    [WIKI + "Source"]:      flatLegacySet(WIKI + "Source"),
    [WIKI + "Person"]:      flatLegacySet(WIKI + "Person"),
    [WIKI + "Procedure"]:   flatLegacySet(WIKI + "Procedure"),
    [WIKI + "WorkingNote"]: flatLegacySet(WIKI + "WorkingNote"),
};

/** @deprecated Use getThingGovernedPredicates + PAGE_GOVERNED_PREDICATES directly. */
export function governedPredicates(classUri: string): string[] {
    const set = GOVERNED_FOR[classUri];
    if (!set) throw new Error(`No governed-predicate set for class: ${classUri}`);
    return set;
}
