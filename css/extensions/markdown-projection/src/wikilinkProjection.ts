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
import { slug } from "../../shared/markdown-parsing/src/resolver.js";

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

// S3a rule (D76): strip leading `@` before slugifying
function applyS3a(title: string): string {
    return title.startsWith("@") ? title.slice(1) : title;
}

// Class hint → target container segment
const HINT_TO_CONTAINER: Record<string, string> = {
    source: "sources",
    author: "people",
    embed:  "pages",
};

function targetContainer(hint: string | undefined, title: string, sourceCtr: string): string {
    if (hint && HINT_TO_CONTAINER[hint]) return HINT_TO_CONTAINER[hint];
    if (isCitekey(title)) return "sources";
    return sourceCtr;
}

function projectionFor(hint: string | undefined, title: string): Projection {
    if (hint && HINT_TO_PROJECTION[hint]) return HINT_TO_PROJECTION[hint];
    if (isCitekey(title)) return CITEKEY_PROJECTION;
    return DEFAULT_PROJECTION;
}

// Extract the container segment from a base URI like
// http://localhost:3000/wiki/pages/foo.md → "pages"
function sourceContainerOf(baseUri: string): string {
    const m = baseUri.match(/\/wiki\/([^/]+)\//);
    return m ? m[1] : "pages";
}

// Extract the root (everything before /wiki/) from the base URI
function baseRoot(baseUri: string): string {
    const m = baseUri.match(/^(.+?)\/wiki\//);
    return m ? m[1] : "";
}

/**
 * Project all wikilinks in a markdown body to RDF quads.
 *
 * Per D98, THING-scoped triples use <baseUri#this> as subject and append
 * '#this' to the target URL.  PAGE-scoped triples (embed) keep <baseUri>
 * as subject and the bare target URL as object.
 *
 * @param body     Raw markdown text (YAML frontmatter wikilinks not extracted)
 * @param baseUri  Absolute URI of the containing resource (the page document IRI)
 */
export function projectWikilinks(body: string, baseUri: string): Quad[] {
    const pageIRI  = namedNode(baseUri);
    const thingIRI = namedNode(baseUri + "#this");
    const out: Quad[] = [];
    const root = baseRoot(baseUri);
    const sourceCtr = sourceContainerOf(baseUri);

    for (const link of extractWikilinks(body)) {
        const stripped = applyS3a(link.title);
        const slugged  = slug(stripped);
        const ctr      = targetContainer(link.classHint, link.title, sourceCtr);
        const targetPageURL = `${root}/wiki/${ctr}/${slugged}.md`;
        const proj     = projectionFor(link.classHint, link.title);

        const subject =
            proj.subject === "PAGE" ? pageIRI : thingIRI;
        const object =
            proj.subject === "PAGE"
                ? namedNode(targetPageURL)
                : namedNode(targetPageURL + "#this");

        out.push(quad(subject, proj.predicate, object));
    }

    return out;
}
