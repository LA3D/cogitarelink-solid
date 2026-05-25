// projectionPipeline.ts
//
// Combines frontmatterProjection + wikilinkProjection into the full .meta
// projection pass described by D58/D71/D72.
//
// Additional derivations beyond the individual projection modules:
//   - dct:title — extracted from the first H1 heading when not in frontmatter
//   - dct:identifier — derived from the URI slug when not in frontmatter
//   - prov:wasGeneratedBy — on <>.meta: the projector audit stamp; on <resource>:
//     the generating mem:Action, derived from the operation log (RQ-Listener-1)
//   - substrate invariants — Page+Thing bridge per D98 (emitSubstrateInvariants)

import { DataFactory, NamedNode, Quad } from "n3";
import * as YAML from "yaml";
import { projectFrontmatter, Frontmatter, resolveCURIE } from "./frontmatterProjection.js";
import { projectWikilinks } from "./wikilinkProjection.js";
import { resolveThingClass, TypeIndex, DEFAULT_WIKI_TYPE_INDEX } from "./typeIndexLookup.js";
import type { ActionProvenance } from "./operationLog.js";

const { namedNode, literal, quad } = DataFactory;

const DCT_TITLE                = "http://purl.org/dc/terms/title";
const DCT_IDENTIFIER           = "http://purl.org/dc/terms/identifier";
const PROV_GEN_BY              = "http://www.w3.org/ns/prov#wasGeneratedBy";
const AFFORDANCE_PATH          = "/meta/affordances/markdown-projection";
const RDF_TYPE                 = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SCHEMA_MAIN_ENTITY       = "https://schema.org/mainEntity";
const SCHEMA_MAIN_ENTITY_OF_PAGE = "https://schema.org/mainEntityOfPage";
const WIKI_PAGE                = "https://pod.vardeman.me/vault/ontology/wiki#Page";

// ---------------------------------------------------------------------------
// Substrate invariants (D98 Page+Thing bridge)
// ---------------------------------------------------------------------------

export interface SubstrateInvariantsArgs {
    pageIRI: NamedNode;   // <>
    thingIRI: NamedNode;  // <#this>
    thingClass: string;    // rdf:type IRI for the Thing
}

/**
 * Emit the four substrate-invariant triples present on every L3 page (D98):
 *   <>      a wiki:Page
 *   <>      schema:mainEntity   <#this>
 *   <#this> a <thingClass>
 *   <#this> schema:mainEntityOfPage <>
 *
 * These are always set by the substrate on body PUT and cannot be overridden
 * by the agent. They are part of the substrate-governed predicate set.
 */
export function emitSubstrateInvariants(args: SubstrateInvariantsArgs): Quad[] {
    return [
        quad(args.pageIRI, namedNode(RDF_TYPE), namedNode(WIKI_PAGE)),
        quad(args.pageIRI, namedNode(SCHEMA_MAIN_ENTITY), args.thingIRI),
        quad(args.thingIRI, namedNode(RDF_TYPE), namedNode(args.thingClass)),
        quad(args.thingIRI, namedNode(SCHEMA_MAIN_ENTITY_OF_PAGE), args.pageIRI),
    ];
}

// ---------------------------------------------------------------------------
// Frontmatter splitting
// ---------------------------------------------------------------------------

function splitFrontmatter(body: string): { fm: Frontmatter; rest: string } {
    if (!body.startsWith("---\n")) return { fm: {}, rest: body };
    const end = body.indexOf("\n---\n", 4);
    if (end < 0) return { fm: {}, rest: body };
    const fmText = body.slice(4, end);
    const rest   = body.slice(end + 5);
    try {
        return { fm: YAML.parse(fmText) ?? {}, rest };
    } catch {
        return { fm: {}, rest };
    }
}

// ---------------------------------------------------------------------------
// H1 extraction
// ---------------------------------------------------------------------------

function extractH1(text: string): string | undefined {
    const m = text.match(/^#\s+(.+)$/m);
    return m ? m[1].trim() : undefined;
}

// ---------------------------------------------------------------------------
// URI slug extraction
// Pulls the filename stem from a URI like
//   http://localhost:3000/wiki/pages/wiki-memory-l3-profile.md
//   → "wiki-memory-l3-profile"
// ---------------------------------------------------------------------------

function uriSlug(uri: string): string {
    const last = uri.split("/").pop() ?? "";
    return last.endsWith(".md") ? last.slice(0, -3) : last;
}

// ---------------------------------------------------------------------------
// Pod root extraction
// http://localhost:3000/wiki/pages/foo.md → http://localhost:3000
// ---------------------------------------------------------------------------

function podRoot(uri: string): string {
    try {
        const u = new URL(uri);
        return `${u.protocol}//${u.host}`;
    } catch {
        // Fallback: strip everything after the third slash segment
        const m = uri.match(/^(https?:\/\/[^/]+)/);
        return m ? m[1] : "";
    }
}

// ---------------------------------------------------------------------------
// Subject rebinding (placeholder → real URI)
// ---------------------------------------------------------------------------

function rebindSubject(triples: Quad[], realSubject: string): Quad[] {
    const real = namedNode(realSubject);
    return triples.map(t =>
        quad(real, t.predicate as any, t.object as any),
    );
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export const projectionPipeline = {
    /**
     * Run the full projection pipeline for a resource body.
     *
     * @param resourceUri  Absolute URI of the resource being written
     * @param body         Raw resource body (may include YAML frontmatter)
     * @param typeIndex    Optional Type Index map (container prefix → class IRI).
     *                     When provided, substrate invariants (D98) are emitted
     *                     when a Thing class can be resolved. Pass an empty
     *                     object or omit to skip invariant emission (backward compat).
     */
    async run(
        resourceUri: string,
        body: string,
        typeIndex: TypeIndex = DEFAULT_WIKI_TYPE_INDEX,
        action?: ActionProvenance,
    ): Promise<Quad[]> {
        const { fm, rest } = splitFrontmatter(body);

        // Frontmatter → quads (subject still urn:placeholder:subject)
        const fmTriples = rebindSubject(projectFrontmatter(fm), resourceUri);

        // Body wikilinks → quads (subject = resourceUri)
        const wikiTriples = projectWikilinks(rest, resourceUri);

        // Derived: dct:title from H1 when frontmatter carries no title
        const derived: Quad[] = [];
        if (!fm.title) {
            const h1 = extractH1(body);
            if (h1) {
                derived.push(quad(namedNode(resourceUri), namedNode(DCT_TITLE), literal(h1)));
            }
        }

        // Derived: dct:identifier from URI slug when frontmatter carries no identifier/citekey
        if (!fm.identifier && !fm.citekey) {
            const id = uriSlug(resourceUri);
            if (id) {
                derived.push(quad(namedNode(resourceUri), namedNode(DCT_IDENTIFIER), literal(id)));
            }
        }

        // Metadata-provenance audit stamp (design §3.1 statement #3): the
        // projector generated the *metadata document*, not the resource. Attach
        // it to the .meta-document subject — NOT the resource — to free
        // prov:wasGeneratedBy on the resource for operation provenance.
        const affordanceUri = `${podRoot(resourceUri)}${AFFORDANCE_PATH}`;
        const auditStamp = quad(
            namedNode(`${resourceUri}.meta`),
            namedNode(PROV_GEN_BY),
            namedNode(affordanceUri),
        );

        // Resource generation (design §3.2, RQ-Listener-1): derived from the
        // operation log when an action targets this resource. Pointer-only — the
        // resource carries just prov:wasGeneratedBy pointing at the announcement
        // resource; the announcement itself (a dereferenceable resource) carries
        // the action type/time. Absent for non-operation resources (plain PUTs).
        const provTriples: Quad[] = [auditStamp];
        if (action) {
            provTriples.push(quad(namedNode(resourceUri), namedNode(PROV_GEN_BY), namedNode(action.activityUrl)));
        }

        // Substrate invariants (D98 Page+Thing bridge) — emitted when Type Index
        // can resolve a Thing class. frontmatterType (fm.type) wins over container.
        const invariants: Quad[] = [];
        // Resolve fm.type to a full IRI: CURIE form (skos:Concept), absolute IRI,
        // or short vault form (concept → wiki:Concept via TYPE_MAP already handled
        // by projectFrontmatter; here we need the IRI for resolveThingClass).
        // resolveCURIE returns undefined for short vault strings like "concept" — in
        // that case we fall through to container-based resolution in typeIndex.
        const fmTypeIRI =
            typeof fm.type === "string" ? resolveCURIE(fm.type) : undefined;
        const thingClass = resolveThingClass(
            new URL(resourceUri).pathname,
            typeIndex,
            fmTypeIRI,
        );
        if (thingClass) {
            const pageIRI  = namedNode(resourceUri);
            const thingIRI = namedNode(`${resourceUri}#this`);
            invariants.push(...emitSubstrateInvariants({ pageIRI, thingIRI, thingClass }));
        }
        // When thingClass is undefined: no invariants emitted, no warning here
        // (listener context has better logging; pipeline stays pure).

        // Bug F: When invariants emit the Thing's rdf:type on <#this>, prevent
        // frontmatter projection from also emitting the same type on <> (the page
        // resource). The page resource should be typed only as wiki:Page (set by
        // invariants); the domain class belongs exclusively on <#this>.
        const filteredFmTriples = invariants.length > 0
            ? fmTriples.filter(
                  (q) => !(q.subject.value === resourceUri && q.predicate.value === RDF_TYPE),
              )
            : fmTriples;

        return [...filteredFmTriples, ...derived, ...wikiTriples, ...provTriples, ...invariants];
    },
};
