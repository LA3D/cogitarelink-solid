// wikilinkProjection.ts
//
// Projects typed wikilinks from a raw markdown body to N3.js Quad objects.
//
// Implements the dual-layer linking commitment (D71): body wikilinks at the
// token layer are projected to RDF predicates at the data layer so SPARQL
// agents can query the same edges that LLM agents write naturally as [[links]].
//
// D98 Page+Thing pattern: each hint specifies (a) which subject the triple is
// attached to — the page resource <> (PAGE) or the Thing <#this> (THING) —
// and (b) the predicate IRI.  THING-scoped objects also append '#this' so
// wikilinks become Thing-to-Thing typed edges.
//
// S3a rule (D76): strip leading `@` from citekey-style titles before slugifying
// to prevent JSON-LD keyword collisions and RFC 3986 encoding inconsistencies.
//
// Container routing (D76): class hint (or `@`-prefix heuristic) determines
// which /wiki/{pages,sources,people,procedures,working}/ container the target
// URI is minted in.

import { DataFactory } from "n3";
import type { NamedNode, Quad } from "n3";
import { extractWikilinks } from "../../shared/markdown-parsing/src/wikilinks.js";
import { targetUrlFor, WIKI_SEGMENT, DEFAULT_CONTENT_CONTAINER } from "../../shared/markdown-parsing/src/wikiUrl.js";
import { DEFAULT_WIKI_TYPE_INDEX } from "./typeIndexLookup.js";

const { namedNode, quad } = DataFactory;

const SKOS   = "http://www.w3.org/2004/02/skos/core#";
const CITO   = "http://purl.org/spar/cito/";
const SCHEMA = "https://schema.org/";
const DCT    = "http://purl.org/dc/terms/";
const WIKI   = "https://pod.vardeman.me/vault/ontology/wiki#";

export type ProjectionSubject = "PAGE" | "THING";

export interface Projection {
    subject: ProjectionSubject;
    predicate: NamedNode;
}

export const HINT_TO_PROJECTION: Record<string, Projection> = {
    // Thing-to-Thing typed edges (subject = <#this>, object = <target#this>)
    related:     { subject: "THING", predicate: namedNode(SKOS + "related") },
    broader:     { subject: "THING", predicate: namedNode(SKOS + "broader") },
    narrower:    { subject: "THING", predicate: namedNode(SKOS + "narrower") },
    extends:     { subject: "THING", predicate: namedNode(CITO + "extends") },
    supports:    { subject: "THING", predicate: namedNode(CITO + "agreesWith") },
    criticizes:  { subject: "THING", predicate: namedNode(CITO + "disagreesWith") },
    cites:       { subject: "THING", predicate: namedNode(CITO + "cites") },
    source:      { subject: "THING", predicate: namedNode(DCT  + "source") },
    author:      { subject: "THING", predicate: namedNode(DCT  + "contributor") },
    affiliation: { subject: "THING", predicate: namedNode(SCHEMA + "affiliation") },
    location:    { subject: "THING", predicate: namedNode(SCHEMA + "location") },
    attendee:    { subject: "THING", predicate: namedNode(SCHEMA + "attendee") },
    organizer:   { subject: "THING", predicate: namedNode(SCHEMA + "organizer") },
    about:       { subject: "THING", predicate: namedNode(SCHEMA + "about") },
    member:      { subject: "THING", predicate: namedNode(SCHEMA + "member") },
    tool:        { subject: "THING", predicate: namedNode(SCHEMA + "tool") },
    supply:      { subject: "THING", predicate: namedNode(SCHEMA + "supply") },
    step:        { subject: "THING", predicate: namedNode(SCHEMA + "step") },

    // Page-scoped (subject = <>, object = target page URL)
    embed:       { subject: "PAGE",  predicate: namedNode(WIKI + "embeds") },
};

// Minimal opinionated kernel (Option B): the smallest predicate→class entailment
// set that makes a freshly-minted Pod usable as agentic memory with the D106
// guardrails intact. The Pod's /vault/meta/routing.jsonld EXTENDS this at runtime
// (RoutingLoader); this kernel is the bootstrap default used before the doc loads
// or if it is absent — same status as DEFAULT_WIKI_TYPE_INDEX. Navigation
// predicates (skos:related/broader, cito:*) entail nothing → default content container.
export const BOOTSTRAP_PREDICATE_TO_CLASS: Record<string, string> = {
    [SCHEMA + "affiliation"]: SCHEMA + "Organization",
    [SCHEMA + "location"]:    SCHEMA + "Place",
    [DCT + "contributor"]:    SCHEMA + "Person",
};

// Inverts the container→class Type Index: given a class IRI, return the wiki
// container segment (e.g. "organizations") it is registered under. Matches the
// profile's /<WIKI_SEGMENT>/<segment>/ layout — the storage root is irrelevant
// here because we only extract the trailing segment.
const WIKI_SEGMENT_RE = new RegExp(`/${WIKI_SEGMENT}/([^/]+)/$`);

export function classToContainerSegment(
    classIri: string,
    typeIndex: Record<string, string>,
): string | undefined {
    for (const [prefix, cls] of Object.entries(typeIndex)) {
        if (cls === classIri) {
            const m = prefix.match(WIKI_SEGMENT_RE);
            if (m) return m[1];
        }
    }
    return undefined;
}

// Legacy citekey fallback predicate (dct:references) — routed as THING-scoped
const CITEKEY_PROJECTION: Projection = {
    subject: "THING",
    predicate: namedNode(DCT + "references"),
};

// Default when no hint and no citekey — THING-scoped skos:related
const DEFAULT_PROJECTION: Projection = {
    subject: "THING",
    predicate: namedNode(SKOS + "related"),
};

export interface ProjectWikilinkArgs {
    pageIRI: NamedNode;       // <>  — the page document IRI
    thingIRI: NamedNode;      // <#this> — the Thing described by the page
    hint: string;              // class hint without leading dot
    targetPageURL: string;     // resolved URL of the target page
}

/**
 * Project a body wikilink to one or more RDF triples.
 *
 * Per D98, the object IRI of THING-scoped triples is the target's Thing
 * fragment (`<target.md#this>`).  PAGE-scoped triples (embed) reference
 * the resource itself without appending '#this'.
 */
export function projectWikilink(args: ProjectWikilinkArgs): Quad[] {
    const projection = HINT_TO_PROJECTION[args.hint];
    if (!projection) return [];

    const subject =
        projection.subject === "PAGE" ? args.pageIRI : args.thingIRI;

    const object =
        projection.subject === "PAGE"
            ? namedNode(args.targetPageURL)
            : namedNode(args.targetPageURL + "#this");

    return [quad(subject, projection.predicate, object)];
}

// ---------------------------------------------------------------------------
// Internal helpers (same as before)
// ---------------------------------------------------------------------------

function isCitekey(title: string): boolean {
    return title.startsWith("@");
}

// S3a rule (D76): the leading-`@` strip is now applied inside the shared minter
// (targetUrlFor → stripCitekeyMarker) so render and projection strip identically.
// DEFAULT_CONTENT_CONTAINER ("concepts") is imported from the shared minter so
// the projection's fall-through default and the render path share one source.

// D106: hint → predicate → entailed class (predicateToClass) → container via the
// inverted Type Index. Defaults to concepts/ when the predicate entails no class
// or the class is not Type-Index-registered (forward/cross-container ref — the
// minted IRI is best-effort; the curator reconciles divergence). predicateToClass
// is injected (Pod routing.jsonld at runtime; bootstrap kernel otherwise).
function targetContainer(
    hint: string | undefined,
    title: string,
    typeIndex: Record<string, string>,
    predicateToClass: Record<string, string>,
): string {
    const proj = projectionFor(hint, title);
    const cls = predicateToClass[proj.predicate.value];
    if (cls) {
        const seg = classToContainerSegment(cls, typeIndex);
        if (seg) return seg;
    }
    return DEFAULT_CONTENT_CONTAINER;
}

function projectionFor(hint: string | undefined, title: string): Projection {
    if (hint && HINT_TO_PROJECTION[hint]) return HINT_TO_PROJECTION[hint];
    if (isCitekey(title)) return CITEKEY_PROJECTION;
    return DEFAULT_PROJECTION;
}

// Recover the storage root (everything before /<WIKI_SEGMENT>/) from a resource
// URI. Used ONLY as the fallback when projectWikilinks is called without an
// explicit wikiRoot (e.g. unit tests). The production callers (pipeline → listener
// / MarkdownBodyProjector) pass the injected storage base in, so the root no longer
// depends on the deployment carrying a literal /wiki/ split point.
const BASE_ROOT_RE = new RegExp(`^(.+?)/${WIKI_SEGMENT}/`);
function baseRoot(baseUri: string): string {
    const m = baseUri.match(BASE_ROOT_RE);
    return m ? m[1] : "";
}

/**
 * Project all wikilinks in a markdown body to RDF quads.
 *
 * Per D98, THING-scoped triples use <baseUri#this> as subject and append
 * '#this' to the target URL.  PAGE-scoped triples (embed) keep <baseUri>
 * as subject and the bare target URL as object.
 *
 * Container routing (D106): the target container is resolved from the
 * projected predicate IRI via predicateToClass (entailment map) and the
 * inverted Type Index. Falls back to concepts/ when no entailment exists
 * or the entailed class is not Type-Index-registered.
 *
 * @param body           Raw markdown text (YAML frontmatter wikilinks not extracted)
 * @param baseUri        Absolute URI of the containing resource (the page document IRI)
 * @param typeIndex      Container path prefix → Thing class IRI map (defaults to DEFAULT_WIKI_TYPE_INDEX)
 * @param predicateToClass  Predicate IRI → entailed class IRI map (defaults to BOOTSTRAP_PREDICATE_TO_CLASS)
 * @param wikiRoot       Storage root URL the target IRIs are minted under, e.g.
 *                       "https://pod.example/vault". Threaded from the pipeline
 *                       (which gets it from the injected storage base) so the root
 *                       is config-derived, not recovered by splitting baseUri on a
 *                       literal /wiki/. Omit to recover the root from baseUri
 *                       (backward-compat fallback for unit tests).
 */
export function projectWikilinks(
    body: string,
    baseUri: string,
    typeIndex: Record<string, string> = DEFAULT_WIKI_TYPE_INDEX,
    predicateToClass: Record<string, string> = BOOTSTRAP_PREDICATE_TO_CLASS,
    wikiRoot?: string,
): Quad[] {
    const pageIRI  = namedNode(baseUri);
    const thingIRI = namedNode(baseUri + "#this");
    const out: Quad[] = [];
    const root = (wikiRoot ?? baseRoot(baseUri)).replace(/\/$/, "");

    for (const link of extractWikilinks(body)) {
        // Resolve the container via the richer routing (live Type Index +
        // predicate→class entailment), then mint through the SINGLE shared URL
        // minter so render (default routing) and projection (this richer
        // routing, falling through to the same defaults) agree by construction
        // wherever the live index is silent (audit R1.1 dual-view identity).
        const ctr = targetContainer(link.classHint, link.title, typeIndex, predicateToClass);
        const targetPageURL = targetUrlFor({
            title: link.title,
            classHint: link.classHint,
            wikiRoot: root,
            container: ctr,
        });
        const proj     = projectionFor(link.classHint, link.title);

        const subject = proj.subject === "PAGE" ? pageIRI : thingIRI;
        const object  = proj.subject === "PAGE"
            ? namedNode(targetPageURL)
            : namedNode(targetPageURL + "#this");

        out.push(quad(subject, proj.predicate, object));
    }
    return out;
}
