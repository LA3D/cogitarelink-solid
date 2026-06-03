// resolveGoverned.ts
//
// Resolve the per-resource governed-predicate set (page <> ∪ thing <#this>)
// from a projected quad array by reading the THING subject's rdf:type.
//
// R-T2 (audit R1.3 / FOLLOWUPS item 1): the listener used to resolve the
// governed set via detectClass(triples) — the FIRST rdf:type in the array.
// After the Bug-F filter (which strips the domain class off <> when invariants
// are emitted) the first rdf:type is the page's wiki:Page, so the listener fell
// back to COMMON_THING_PREDICATES (schema:Thing) — WITHOUT the skos axis. A
// concept body's skos:prefLabel/altLabel/definition/broader/… were therefore
// treated as ungoverned and never replaced on regovern. The MarkdownBodyProjector
// (D108 Front-2) already resolved this correctly by reading the <#this>-subject
// rdf:type; this is that exact resolution, extracted so the listener and the
// projector share ONE definition (no second drifting copy).

import type { Quad } from "n3";
import { getThingGovernedPredicates, PAGE_GOVERNED_PREDICATES } from "./governedPredicates.js";

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

/**
 * The Thing class IRI projected on <#this> for the given thing subject, or
 * undefined when no rdf:type is present on that subject (not substrate-governed).
 */
export function thingClassOf(quads: Quad[], thingIri: string): string | undefined {
    const q = quads.find(
        (t) => t.predicate.value === RDF_TYPE && t.subject.value === thingIri,
    );
    return q?.object.value;
}

/**
 * Resolve the full governed-predicate set (page ∪ thing) for a projected quad
 * array, keyed off the <#this> subject's rdf:type. Returns undefined when the
 * thing subject carries no rdf:type (the resource is not substrate-governed).
 *
 * The thing axis uses getThingGovernedPredicates(thingClass) — which for
 * skos:Concept includes the full skos + cito + dct:source/contributor set — so
 * the concept's content predicates are correctly governed (the bug this fixes).
 */
export function resolveGovernedFromQuads(quads: Quad[], thingIri: string): string[] | undefined {
    const thingClass = thingClassOf(quads, thingIri);
    if (thingClass === undefined) return undefined;
    const thingGoverned = getThingGovernedPredicates(thingClass).map((n) => n.value);
    const pageGoverned = PAGE_GOVERNED_PREDICATES.map((n) => n.value);
    return [...new Set([...pageGoverned, ...thingGoverned])];
}
