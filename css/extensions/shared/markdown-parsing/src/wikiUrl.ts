// wikiUrl.ts — the single wiki-memory L3 URL minter.
//
// Both the render path (HardcodedResolver → the <a href> in the document view)
// and the projection path (wikilinkProjection → the .meta edge object in the
// graph view) mint the target URL for a [[wikilink]] HERE. Before R-T2 the two
// paths minted DIFFERENT URLs for the same wikilink — render produced a stale
// pre-D98 PARA path (/vault/resources/concepts/) while projection produced the
// D98 /wiki/{container}/ path — so the document view and the graph view
// identified different resources. P5 dual-view identity split (audit R1.1).
//
// Layering: this module lives in shared/markdown-parsing and must NOT import
// from markdown-projection (the dependency direction is markdown-projection →
// shared, one-way). It therefore owns only the MINIMAL default routing —
// slug + the @-citekey strip + the small hint→container default table. The
// projection's richer routing (live Type Index + the predicate→class entailment
// map loaded from /meta/routing.jsonld) wraps this: it overrides the container
// per-link when the live index resolves one, and falls through to THIS default
// table otherwise — so render (defaults only) and projection (defaults where the
// live index is silent) agree by construction. The agreement is locked by
// markdown-projection/test/renderProjectionAgreement.test.ts.

// Slugify the same way the vault importer does (scripts/lib/rdf_gen.py:slug).
//
// CRITICAL: the operation order must match the Python importer exactly.
// Python's slug does (strip non-[\w\s-]) → (collapse whitespace) → (lowercase),
// in that order. Doing it in a different order gives different results for
// titles containing special characters adjacent to spaces:
//
//   Title:     "Research & Scholarship"
//   Python:    strip → "Research  Scholarship" → collapse → "Research-Scholarship" → lower → "research-scholarship"
//   Wrong:     lower → "research & scholarship" → collapse → "research-&-scholarship" → strip → "research--scholarship"
//
// The Python order merges the adjacent spaces after removing the `&`. The
// wrong order removes the `&` between the space-hyphens, leaving a double
// hyphen. Matching Python exactly is the only way the resolver and importer
// agree on URLs.
//
// Also handles two wikilink-target quirks before slugifying:
// 1. Heading anchors: `Note Title#Some Section` → `Note Title` (drops #...)
// 2. Folder prefixes: `External Resources/Note Title` → `Note Title`
//
// The importer writes everything into one flat container (see the --container
// flag in vault_import.py), so the folder prefix is informational — it tells
// the author where the note *used to live* in the vault, but the pod URL
// doesn't mirror the folder hierarchy.
export function slug(title: string): string {
  // Drop any heading-anchor suffix first: [[Note#Heading]] → "Note"
  const hashIdx = title.indexOf("#");
  let bare = hashIdx >= 0 ? title.substring(0, hashIdx) : title;
  // Then drop any folder prefix: "Folder/Sub/Note" → "Note"
  const slashIdx = bare.lastIndexOf("/");
  if (slashIdx >= 0) bare = bare.substring(slashIdx + 1);
  return bare
    .trim()
    // \w in JavaScript regex = [A-Za-z0-9_], same as Python. Strip anything
    // that isn't word, whitespace, or hyphen. Must run BEFORE whitespace
    // collapse so special chars disappear before adjacent spaces merge.
    .replace(/[^\w\s-]/g, "")
    // Collapse whitespace runs into a single hyphen.
    .replace(/\s+/g, "-")
    // Lowercase last to match Python's .lower() at the end.
    .toLowerCase();
}

// The wiki-memory L3 profile's own container-layout segment. A profile constant
// (the L3 layout names its sub-containers <root>/wiki/{concepts,…}/), NOT a
// deployment/storage-root literal. Mirrors markdown-projection's WIKI_SEGMENT
// (typeIndexLookup.ts) and the listener's local copy — single-sourced here so
// the projection re-exports this one definition.
export const WIKI_SEGMENT = "wiki";

// Default content container — the destination when no hint (or a hint with no
// class entailment) routes the link elsewhere. Mirrors wikilinkProjection's
// DEFAULT_CONTENT_CONTAINER.
export const DEFAULT_CONTENT_CONTAINER = "concepts";

// Minimal default hint→container routing (no live Type Index). This is the
// flattened form of the projection's bootstrap entailment
// (BOOTSTRAP_PREDICATE_TO_CLASS + DEFAULT_WIKI_TYPE_INDEX): the only hints whose
// bootstrap predicate entails a class registered in the default Type Index are
// author→Person→people, affiliation→Organization→organizations, and
// location→Place→places. Every other hint (and the no-hint / @-citekey cases)
// entails no class under the bootstrap defaults and falls through to concepts.
// The projection derives the SAME three via its predicate→class chain, so the
// two default routings agree (renderProjectionAgreement.test.ts asserts it).
export const DEFAULT_HINT_CONTAINERS: Record<string, string> = {
    author:      "people",
    affiliation: "organizations",
    location:    "places",
};

// S3a rule (D76): strip a leading `@` from citekey-style titles before slugifying
// (prevents JSON-LD keyword collisions + RFC 3986 encoding inconsistencies). The
// projection applied this; the render slug did not — the lone other slug
// divergence between the two paths beyond the container path. Centralised here.
export function stripCitekeyMarker(title: string): string {
    return title.startsWith("@") ? title.slice(1) : title;
}

/**
 * Resolve the wiki container segment for a [[wikilink]] under default routing.
 *
 * @param classHint  The wikilink class hint (without leading dot), or undefined.
 * @returns The container segment, e.g. "concepts" | "people" | "organizations".
 */
export function defaultContainerFor(classHint: string | undefined): string {
    return (classHint && DEFAULT_HINT_CONTAINERS[classHint]) ?? DEFAULT_CONTENT_CONTAINER;
}

export interface TargetUrlArgs {
    /** Raw wikilink target text, e.g. "Context Graphs" | "@zhang-2025-rlm" | "Folder/Note#Heading". */
    title: string;
    /** Class hint without leading dot, e.g. "author" | "source" | undefined. */
    classHint?: string;
    /**
     * Storage root the target IRIs are minted under, e.g.
     * "https://pod.example/vault". The <WIKI_SEGMENT>/<container>/ layout is
     * appended to this. Any trailing slash is trimmed.
     */
    wikiRoot: string;
    /**
     * Optional explicit container override. The projection passes the container
     * its richer live-Type-Index routing resolved; when omitted, the default
     * hint table (defaultContainerFor) decides. Render always omits it.
     */
    container?: string;
}

/**
 * Mint the canonical wiki-memory L3 target URL for a [[wikilink]].
 *
 * The single source of truth for both views: the rendered <a href> and the
 * projected .meta edge object IRI are produced by this one function (the
 * projection appends "#this" to the object IRI for THING-scoped edges — that
 * fragment is a graph-view concern layered ON TOP of this base resource URL,
 * not part of the resource identity).
 */
export function targetUrlFor(args: TargetUrlArgs): string {
    const root = args.wikiRoot.replace(/\/$/, "");
    const container = args.container ?? defaultContainerFor(args.classHint);
    const slugged = slug(stripCitekeyMarker(args.title));
    return `${root}/${WIKI_SEGMENT}/${container}/${slugged}.md`;
}
