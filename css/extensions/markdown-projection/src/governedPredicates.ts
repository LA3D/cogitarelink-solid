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
// resolveGovernedForWikiClass(): resolves the per-subject governed-predicate
//   sets (page + thing) for a wiki: class IRI. Used by the listener to
//   build the two-subject N3 Patch delete clause per D98.

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
    namedNode(DCT  + "source"),
    namedNode(DCT  + "contributor"),
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

// wiki: class IRI → Thing class IRI (for THING_GOVERNED_PREDICATES lookup)
export const WIKI_CLASS_TO_THING_CLASS: Record<string, string> = {
    [WIKI + "Concept"]:     SKOS   + "Concept",
    [WIKI + "Source"]:      SCHEMA + "Thing",    // no dedicated source class yet
    [WIKI + "Person"]:      SCHEMA + "Person",
    [WIKI + "Procedure"]:   SCHEMA + "HowTo",
    [WIKI + "WorkingNote"]: SCHEMA + "Thing",
    [WIKI + "Resource"]:    SCHEMA + "Thing",
};

// ---------------------------------------------------------------------------
// Per-subject governed-predicate resolution (D81 Model A + D98 two-subject)
// ---------------------------------------------------------------------------

export interface TwoSubjectPredicates {
    page:  string[];  // predicates governed on <> (page resource)
    thing: string[];  // predicates governed on <#this> (Thing)
}

/**
 * Resolve the page and thing governed-predicate sets for a wiki: class IRI.
 * Maps the wiki: class to the canonical Thing class, then returns:
 *   - page:  PAGE_GOVERNED_PREDICATES as string[]
 *   - thing: getThingGovernedPredicates(thingClass) as string[]
 *
 * Falls back to COMMON_THING_PREDICATES for unknown wiki: classes.
 */
export function resolveGovernedForWikiClass(wikiClassIRI: string): TwoSubjectPredicates {
    const thingClass = WIKI_CLASS_TO_THING_CLASS[wikiClassIRI] ?? SCHEMA + "Thing";
    return {
        page:  PAGE_GOVERNED_PREDICATES.map(n => n.value),
        thing: getThingGovernedPredicates(thingClass).map(n => n.value),
    };
}

