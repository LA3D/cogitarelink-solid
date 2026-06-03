// typeIndexLookup.ts
//
// Resolve the Thing class for a resource based on (a) explicit frontmatter
// type override, or (b) the container path matched against the Type Index.
//
// Used by MarkdownProjectionListener to determine <#this>'s rdf:type when
// emitting substrate-invariant triples (schema:mainEntity, type, etc.) per
// D98 Page+Thing pattern.

export type TypeIndex = Record<string, string>;
// Map of container path prefix (with trailing slash) → Thing class IRI

// The wiki-memory L3 profile's own container-layout segment. This is a profile
// constant (the L3 layout names its sub-containers /wiki/{concepts,…}/), NOT a
// deployment/storage-root literal. The STORAGE ROOT (e.g. /vault) is always
// supplied by the caller (D107 storagePath parameterization).
//
// Single-sourced in the shared minter (wikiUrl.ts) so the projection's Type
// Index keys and the render/projection URL minter share ONE segment constant
// (R-T2: the segment was duplicated in typeIndexLookup.ts, listener.ts, and the
// wikilinkProjection regexes). Re-exported here so existing
// `import { WIKI_SEGMENT } from "./typeIndexLookup.js"` callers keep working.
export { WIKI_SEGMENT } from "../../shared/markdown-parsing/src/wikiUrl.js";
import { WIKI_SEGMENT } from "../../shared/markdown-parsing/src/wikiUrl.js";

// The seven wiki-memory L3 container names → Thing class IRI. The container
// path (key in the TypeIndex) is built per-deployment from the storage base;
// only the segment name + class IRI are profile-intrinsic.
const WIKI_CONTAINER_CLASSES: ReadonlyArray<readonly [string, string]> = [
    ["concepts",      "http://www.w3.org/2004/02/skos/core#Concept"],
    ["people",        "https://schema.org/Person"],
    ["places",        "https://schema.org/Place"],
    ["events",        "https://schema.org/Event"],
    ["organizations", "https://schema.org/Organization"],
    ["procedures",    "https://schema.org/HowTo"],
    ["working",       "https://pod.vardeman.me/vault/ontology/wiki#WorkingNote"],
];

/**
 * Build the canonical wiki-memory L3 Type Index for a given storage base.
 *
 * The fallback map used by the projection pipeline when no live Type Index is
 * available (fresh Pod / unreachable index). Writes without explicit frontmatter
 * type still emit D98 substrate invariants by container path.
 *
 * @param storageBase  The storage-root URL or path, e.g. "https://pod.example/vault"
 *                     or "/vault". The container keys are returned as PATH prefixes
 *                     (pathname only) so resolveThingClass — which matches against a
 *                     resource pathname — works regardless of whether storageBase is
 *                     absolute or path-only.
 * @returns Container path prefix (with trailing slash) → Thing class IRI map
 */
export function defaultWikiTypeIndex(storageBase: string): TypeIndex {
    // Reduce storageBase to its pathname so keys are path prefixes that match
    // resolveThingClass's pathname input (e.g. "/vault"). Accepts both absolute
    // URLs and bare paths.
    let basePath: string;
    try {
        basePath = new URL(storageBase).pathname;
    } catch {
        basePath = storageBase;
    }
    basePath = basePath.replace(/\/$/, "");
    const out: TypeIndex = {};
    for (const [seg, cls] of WIKI_CONTAINER_CLASSES) {
        out[`${basePath}/${WIKI_SEGMENT}/${seg}/`] = cls;
    }
    return out;
}

/**
 * Historical default for the canonical /vault deployment, kept as a deprecated
 * alias so existing callers/tests that assumed the /vault storage root keep
 * working. New code should call defaultWikiTypeIndex(storageBase) with the
 * injected storage base instead of relying on this baked-in /vault literal.
 *
 * @deprecated Use defaultWikiTypeIndex(storageBase) with the injected storage root.
 */
export const DEFAULT_WIKI_TYPE_INDEX: TypeIndex = defaultWikiTypeIndex("/vault");

/**
 * Resolve the canonical Thing class IRI for a resource.
 *
 * @param resourcePath  Path of the resource, e.g. "/vault/wiki/concepts/foo.md"
 * @param typeIndex     Container path → class IRI map
 * @param frontmatterType  Optional explicit type from YAML frontmatter (wins over container)
 * @returns The Thing class IRI, or undefined if no match
 */
export function resolveThingClass(
  resourcePath: string,
  typeIndex: TypeIndex,
  frontmatterType: string | undefined,
): string | undefined {
  if (frontmatterType) return frontmatterType;

  // Longest matching container prefix wins
  const matches = Object.keys(typeIndex)
    .filter((prefix) => resourcePath.startsWith(prefix))
    .sort((a, b) => b.length - a.length);

  return matches.length > 0 ? typeIndex[matches[0]] : undefined;
}
