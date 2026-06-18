// projectionPipeline.ts
//
// Combines frontmatterProjection + wikilinkProjection into the full .meta
// projection pass described by D58/D71/D72.
//
// Additional derivations beyond the individual projection modules:
//   - dct:title — extracted from the first H1 heading when not in frontmatter
//   - dct:identifier — NOT derived (the page's identifier IS its URI); when present
//     in frontmatter (identifier:/citekey:) it is the entity's external id and
//     rebinds to <#this> (C-T2 / option C)
//   - prov:wasGeneratedBy — on the <>.meta document subject only (the projector
//     audit stamp). NOT on the resource: memory-operation provenance is canonical
//     in /vault/wiki/.operations/, not denormalized here (RQ-Listener-1 collapse).
//   - substrate invariants — Page+Thing bridge per D98 (emitSubstrateInvariants)

import { DataFactory, NamedNode, Quad } from "n3";
import * as YAML from "yaml";
import { projectFrontmatter, Frontmatter, resolveFrontmatterType } from "./frontmatterProjection.js";
import { projectWikilinks, BOOTSTRAP_PREDICATE_TO_CLASS } from "./wikilinkProjection.js";
import { resolveThingClass, TypeIndex, DEFAULT_WIKI_TYPE_INDEX } from "./typeIndexLookup.js";
import { projectSpanLiteralsFramed, DEFAULT_LITERAL_BINDING } from "./spanLiteralProjection.js";
import { PAGE_GOVERNED_PREDICATES, WIKI_CLASS_TO_THING_CLASS,
         WIKI_CLASS_TO_PROFILE, DEFAULT_PROFILE } from "./governedPredicates.js";

const { namedNode, literal, quad } = DataFactory;

// ---------------------------------------------------------------------------
// Projector version (provenance-scoped projection spec §6)
// ---------------------------------------------------------------------------
// Stamped into .meta as sub:projectorVersion (beside sub:bodyHash) by the admission
// floor, so the NEXT write can decide exact recompute-subtraction (stamp matches the
// running projector) vs degraded pairShadow + curation signal (it doesn't).
// Hand-maintained mirror of package.json "version": a JSON import is awkward in the
// dual NodeNext-ESM/CJS build, so test/versionAgreement.test.ts pins this equal to
// package.json (the repo's mirror-test idiom). Bump BOTH together.
export const PROJECTOR_VERSION = "0.1.0";

const DCT_TITLE                = "http://purl.org/dc/terms/title";
const DCT_CONFORMS_TO          = "http://purl.org/dc/terms/conformsTo";
const PROV_GEN_BY              = "http://www.w3.org/ns/prov#wasGeneratedBy";
const AFFORDANCE_PATH          = "/meta/affordances/markdown-projection";
const RDF_TYPE                 = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SCHEMA_MAIN_ENTITY       = "https://schema.org/mainEntity";
const SCHEMA_MAIN_ENTITY_OF_PAGE = "https://schema.org/mainEntityOfPage";
const SCHEMA_NAME              = "https://schema.org/name";
const WIKI_PAGE                = "https://pod.vardeman.me/vault/ontology/wiki#Page";
const FOAF_DOCUMENT            = "http://xmlns.com/foaf/0.1/Document";

// ---------------------------------------------------------------------------
// Substrate invariants (D98 Page+Thing bridge)
// ---------------------------------------------------------------------------

export interface SubstrateInvariantsArgs {
    pageIRI: NamedNode;   // <>
    thingIRI: NamedNode;  // <#this>
    thingClass: string;    // rdf:type IRI for the Thing
}

/**
 * Emit the substrate-invariant triples present on every L3 page (D98):
 *   <>      a wiki:Page
 *   <>      a foaf:Document         (universal write-contract hook — sub:WriteContractShape
 *                                    targets foaf:Document on <>; wiki:Page rdfs:subClassOf it)
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
        quad(args.pageIRI, namedNode(RDF_TYPE), namedNode(FOAF_DOCUMENT)),
        quad(args.pageIRI, namedNode(SCHEMA_MAIN_ENTITY), args.thingIRI),
        quad(args.thingIRI, namedNode(RDF_TYPE), namedNode(args.thingClass)),
        quad(args.thingIRI, namedNode(SCHEMA_MAIN_ENTITY_OF_PAGE), args.pageIRI),
    ];
}

// ---------------------------------------------------------------------------
// Frontmatter splitting
// ---------------------------------------------------------------------------

// Exported so the CJS listener's dispatch can extract the frontmatter type via
// the SAME YAML parse the pipeline uses (R-T2 / audit P3) instead of a private
// `^type:` regex that disagrees with YAML on nested/quoted/multi-key frontmatter.
export function splitFrontmatter(body: string): { fm: Frontmatter; rest: string } {
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

// Frontmatter quads project against a placeholder subject; the pipeline rebinds
// them to the real subject. Most land on the Page <> (document metadata: title,
// created, modified, maturity, type). dct:identifier is the exception: it is the
// agent-authored external identifier of the *entity* (DOI / arXiv / citekey /
// ORCID), governed on the Thing <#this> by SourceShape — so it rebinds to <#this>,
// matching where governance deletes/replaces it (C-T2 / option C; same partition
// the subjectFrame literal axis enforces — dct:identifier is NOT page-governed).
const DCT_IDENTIFIER_IRI = "http://purl.org/dc/terms/identifier";

// Sanity: keep the rebind in lockstep with the governance partition. If
// dct:identifier ever became page-governed, the <#this> rebind would be wrong.
const _PAGE_GOVERNED_IDENTIFIER =
    PAGE_GOVERNED_PREDICATES.some((n) => n.value === DCT_IDENTIFIER_IRI);

function rebindSubject(triples: Quad[], pageSubject: string): Quad[] {
    const page  = namedNode(pageSubject);
    const thing = namedNode(`${pageSubject}#this`);
    return triples.map(t =>
        quad(
            t.predicate.value === DCT_IDENTIFIER_IRI && !_PAGE_GOVERNED_IDENTIFIER
                ? thing
                : page,
            t.predicate as any,
            t.object as any,
        ),
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
     * @param predicateToClass  Predicate IRI → entailed class IRI map.
     * @param literalBinding    Span-literal frame binding.
     * @param storageBase  Storage-root URL the wikilink target IRIs are minted
     *                     under, e.g. "https://pod.example/vault". Threaded from
     *                     the injected storagePath (listener / MarkdownBodyProjector).
     *                     Omit to recover the root from resourceUri by splitting on
     *                     the wiki segment (backward-compat fallback for tests).
     */
    async run(
        resourceUri: string,
        body: string,
        typeIndex: TypeIndex = DEFAULT_WIKI_TYPE_INDEX,
        predicateToClass: Record<string, string> = BOOTSTRAP_PREDICATE_TO_CLASS,
        literalBinding: Record<string, string> = DEFAULT_LITERAL_BINDING,
        storageBase?: string,
    ): Promise<Quad[]> {
        const { fm, rest } = splitFrontmatter(body);

        // Frontmatter → quads (subject still urn:placeholder:subject)
        const fmTriples = rebindSubject(projectFrontmatter(fm), resourceUri);

        // Body wikilinks → quads (subject = resourceUri). storageBase (config-derived)
        // is the root the target IRIs are minted under; when omitted, projectWikilinks
        // recovers it from resourceUri.
        const wikiTriples = projectWikilinks(rest, resourceUri, typeIndex, predicateToClass, storageBase);

        // Body literal spans → quads (subject resolved per-span by frame: prefLabel→<#this>, title→<>)
        const spanTriples = projectSpanLiteralsFramed(rest, resourceUri, literalBinding);

        // Derived: dct:title from H1 when frontmatter carries no title
        const derived: Quad[] = [];
        if (!fm.title) {
            const h1 = extractH1(body);
            if (h1) {
                derived.push(quad(namedNode(resourceUri), namedNode(DCT_TITLE), literal(h1)));
            }
        }

        // dct:identifier is NOT derived: the page's identifier IS its URI; a slug
        // literal is RDF noise (C-T2 / option C). dct:identifier means ONE thing —
        // the agent-authored external identifier (DOI / arXiv / citekey / ORCID) on
        // <#this>, projected from frontmatter identifier:/citekey:. SourceShape
        // requires it (minCount 1, judgment metadata D108 §1.4); a derived fallback
        // would mask that 422.

        // Metadata-provenance audit stamp: the projector generated the *metadata
        // document*, not the resource. Attach it to the .meta-document subject —
        // NOT the resource (the old <resource> prov:wasGeneratedBy <affordance>
        // stamp was a PROV category error). Memory-operation provenance lives
        // canonically in /vault/wiki/.operations/ (the announcement log), queryable
        // via the memory-history affordance — the resource does not carry it.
        const affordanceUri = `${podRoot(resourceUri)}${AFFORDANCE_PATH}`;
        const provTriples: Quad[] = [quad(
            namedNode(`${resourceUri}.meta`),
            namedNode(PROV_GEN_BY),
            namedNode(affordanceUri),
        )];

        // Substrate invariants (D98 Page+Thing bridge) — emitted when a Thing
        // class can be resolved. frontmatter type:: WINS over the container
        // fallback (C-T2c): a `type: source` page in /wiki/concepts/ must type
        // <#this> a wiki:Source so SourceShape fires, not fall back to the
        // container's skos:Concept. Resolution order (single-sourced via
        // resolveFrontmatterType so it can never diverge from the page-type
        // projection): CURIE/absolute → TYPE_MAP short-form token → (miss)
        // container fallback in resolveThingClass.
        //
        // resolveFrontmatterType yields the wiki: DISPATCH class for a short-form
        // (e.g. "source" → wiki:Source); map it through WIKI_CLASS_TO_THING_CLASS
        // to the canonical Thing class the catalog governs (sh:targetClass) —
        // wiki:Concept → skos:Concept, wiki:Source → wiki:Source (identity, since
        // SourceShape targets wiki:Source directly). A CURIE/absolute type already
        // names a Thing class (skos:Concept, schema:Person) and is not in the map,
        // so it passes through unchanged.
        const invariants: Quad[] = [];
        const fmDispatch = resolveFrontmatterType(fm.type);
        const fmTypeIRI = fmDispatch
            ? (WIKI_CLASS_TO_THING_CLASS[fmDispatch] ?? fmDispatch)
            : undefined;
        const thingClass = resolveThingClass(
            new URL(resourceUri).pathname,
            typeIndex,
            fmTypeIRI,
        );
        if (thingClass) {
            const pageIRI  = namedNode(resourceUri);
            const thingIRI = namedNode(`${resourceUri}#this`);
            invariants.push(...emitSubstrateInvariants({ pageIRI, thingIRI, thingClass }));
            // <> dct:conformsTo <profile> — resource-kind hint (D86). Keyed off the
            // frontmatter wiki dispatch class (fmDispatch); container-only pages
            // (no type:) get DEFAULT_PROFILE (page). Lights up ProfileLinkMetadataWriter.
            const profile = (fmDispatch && WIKI_CLASS_TO_PROFILE[fmDispatch]) ?? DEFAULT_PROFILE;
            invariants.push(quad(pageIRI, namedNode(DCT_CONFORMS_TO), namedNode(profile)));
            // schema:name on <#this> — required by ThingShape (minCount 1). Derived
            // from the page title (frontmatter title > H1 > slug) so every Thing has
            // a name; the substrate governs it. (Probe 2026-05-26: crystallized
            // concepts were failing ThingShape because no schema:name was projected.)
            const name = fm.title ?? extractH1(body) ?? uriSlug(resourceUri);
            if (name) {
                invariants.push(quad(thingIRI, namedNode(SCHEMA_NAME), literal(name)));
            }
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

        return [...filteredFmTriples, ...derived, ...wikiTriples, ...spanTriples, ...provTriples, ...invariants];
    },
};
