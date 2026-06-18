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
const MEM    = "https://pod.vardeman.me/vault/ontology/mem#";

// Pod base IRI — single-sourced from WIKI (the wiki vocab lives under <podbase>/vault/…)
// so the profile IRIs can never diverge from the rest of the pod-hosted namespace.
const PODBASE = WIKI.slice(0, WIKI.indexOf("/vault/"));  // "https://pod.vardeman.me"

// ---------------------------------------------------------------------------
// Page-level predicates (subject = <> / the page resource)
// ---------------------------------------------------------------------------

export const PAGE_GOVERNED_PREDICATES: NamedNode[] = [
    namedNode(DCT    + "title"),
    namedNode(DCT    + "created"),
    namedNode(DCT    + "modified"),
    namedNode(DCT    + "conformsTo"),  // resource-kind hint (D86); derived from the wiki class → profile IRI
    namedNode(SCHEMA + "mainEntity"),
    namedNode(WIKI   + "maturity"),
    namedNode(PROV   + "wasGeneratedBy"),
    namedNode(WIKI   + "embeds"),
    // The agentic write contract (sub:WriteContractShape, foaf:Document on <>). Governed
    // because it is BODY-AUTHORED (rationale: frontmatter → mem:rationale on <>): the
    // projection clears + re-projects it on every rewrite. An agent must NOT add it via a
    // direct .meta PATCH expecting it to persist independently — it is substrate-managed.
    namedNode(MEM    + "rationale"),
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

// wiki:Source ⊑ skos:Concept; SourceShape sh:node ConceptShape (inherits the skos
// + cito axis) and ADDS dct:identifier (minCount 1) — the agent-authored external
// identifier (DOI / arXiv / citekey / ORCID) on <#this>. So the Source governed set
// is the concept set + dct:identifier. dct:identifier is NOT added to COMMON or to
// concept: only SourceShape constrains it (C-T2 / option C).
const source: NamedNode[] = [
    ...concept,
    namedNode(DCT + "identifier"),
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
    [WIKI   + "Source"]:       source,
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
    [WIKI + "Source"]:      WIKI   + "Source",   // own governed set: concept axis + dct:identifier (C-T2)
    [WIKI + "Person"]:      SCHEMA + "Person",
    [WIKI + "Procedure"]:   SCHEMA + "HowTo",
    [WIKI + "WorkingNote"]: SCHEMA + "Thing",
    [WIKI + "Resource"]:    SCHEMA + "Thing",
};

// wiki: dispatch class IRI → PROF profile IRI (resource-kind hint, D86). The
// projector derives <> dct:conformsTo <profile> from the resource's wiki class
// so ProfileLinkMetadataWriter emits Link: rel="profile". Slugs mirror the Python
// importer's CONTENT_PROFILE_MAP (scripts/lib/rdf_gen.py) — the two write paths
// must agree on the profile a class conforms to. Unmapped → DEFAULT_PROFILE.
const PROFILE_BASE = PODBASE + "/vault/meta/profiles/";
export const WIKI_CLASS_TO_PROFILE: Record<string, string> = {
    [WIKI + "Concept"]:     PROFILE_BASE + "concept",
    [WIKI + "Source"]:      PROFILE_BASE + "source",
    [WIKI + "Person"]:      PROFILE_BASE + "person",
    [WIKI + "Procedure"]:   PROFILE_BASE + "procedure",
    [WIKI + "WorkingNote"]: PROFILE_BASE + "working",
    // Place/Event/Organization have no wiki: dispatch class — their pages type
    // via CURIE frontmatter (type: schema:Place), so fmDispatch IS the schema:
    // class IRI; key on it directly (SP2-T8 class-profile-hint completeness).
    [SCHEMA + "Place"]:        PROFILE_BASE + "place",
    [SCHEMA + "Event"]:        PROFILE_BASE + "event",
    [SCHEMA + "Organization"]: PROFILE_BASE + "organization",
};
export const DEFAULT_PROFILE = PROFILE_BASE + "page";

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

