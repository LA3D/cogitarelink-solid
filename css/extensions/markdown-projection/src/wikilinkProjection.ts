// Projects typed wikilinks from a raw markdown body to N3.js Quad objects.
//
// Implements the dual-layer linking commitment (D71): body wikilinks at the
// token layer are projected to RDF predicates at the data layer so SPARQL
// agents can query the same edges that LLM agents write naturally as [[links]].
//
// S3a rule (D76): strip leading `@` from citekey-style titles before slugifying
// to prevent JSON-LD keyword collisions and RFC 3986 encoding inconsistencies.
//
// Container routing (D76): class hint (or `@`-prefix heuristic) determines
// which /wiki/{pages,sources,people,procedures,working}/ container the target
// URI is minted in.

import { DataFactory, Quad } from "n3";
import { extractWikilinks } from "../../shared/markdown-parsing/src/wikilinks.js";
import { slug } from "../../shared/markdown-parsing/src/resolver.js";

const { namedNode, quad } = DataFactory;

// Class hint → RDF predicate URI
const HINT_TO_PREDICATE: Record<string, string> = {
    "broader":    "http://www.w3.org/2004/02/skos/core#broader",
    "subject":    "http://purl.org/dc/terms/subject",
    "source":     "http://purl.org/dc/terms/references",
    "author":     "http://purl.org/dc/terms/contributor",
    "extends":    "http://purl.org/spar/cito/extends",
    "supports":   "http://purl.org/spar/cito/agreesWith",
    "criticizes": "http://purl.org/spar/cito/disagreesWith",
    "embed":      "http://purl.org/dc/terms/hasPart",
    "related":    "http://www.w3.org/2004/02/skos/core#related",
};

// Class hint → target container segment
const HINT_TO_CONTAINER: Record<string, string> = {
    "source": "sources",
    "author": "people",
    "embed":  "pages",
};

// Default predicate when no class hint is present (D71 / predicates.ts DEFAULT_PREDICATE)
const DEFAULT_PREDICATE = "http://www.w3.org/2004/02/skos/core#related";

function isCitekey(title: string): boolean {
    return title.startsWith("@");
}

// S3a rule (D76): strip leading `@` before slugifying
function applyS3a(title: string): string {
    return title.startsWith("@") ? title.slice(1) : title;
}

function targetContainer(hint: string | undefined, title: string, sourceCtr: string): string {
    if (hint && HINT_TO_CONTAINER[hint]) return HINT_TO_CONTAINER[hint];
    if (isCitekey(title)) return "sources";
    return sourceCtr;
}

function predicateFor(hint: string | undefined, title: string): string {
    if (hint && HINT_TO_PREDICATE[hint]) return HINT_TO_PREDICATE[hint];
    if (isCitekey(title)) return "http://purl.org/dc/terms/references";
    return DEFAULT_PREDICATE;
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
 * @param body     Raw markdown text (may include YAML frontmatter — wikilinks in
 *                 frontmatter string values are not extracted)
 * @param baseUri  Absolute URI of the containing resource, used as quad subject
 *                 and to derive the pod root + source container
 */
export function projectWikilinks(body: string, baseUri: string): Quad[] {
    const subj = namedNode(baseUri);
    const out: Quad[] = [];
    const root = baseRoot(baseUri);
    const sourceCtr = sourceContainerOf(baseUri);

    for (const link of extractWikilinks(body)) {
        const stripped = applyS3a(link.title);
        const slugged = slug(stripped);
        const ctr = targetContainer(link.classHint, link.title, sourceCtr);
        const targetUri = `${root}/wiki/${ctr}/${slugged}.md`;
        const pred = predicateFor(link.classHint, link.title);
        out.push(quad(subj, namedNode(pred), namedNode(targetUri)));
    }

    return out;
}
