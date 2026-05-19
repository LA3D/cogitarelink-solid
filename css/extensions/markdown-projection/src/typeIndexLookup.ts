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

/**
 * Hardcoded Type Index for the wiki-memory L3 canonical container layout.
 * Used as the projection pipeline's fallback when no external typeIndex is
 * provided (A.2 fix). Writes without explicit frontmatter type still emit
 * D98 substrate invariants by container path.
 */
export const DEFAULT_WIKI_TYPE_INDEX: TypeIndex = {
    "/vault/wiki/concepts/":      "http://www.w3.org/2004/02/skos/core#Concept",
    "/vault/wiki/people/":        "https://schema.org/Person",
    "/vault/wiki/places/":        "https://schema.org/Place",
    "/vault/wiki/events/":        "https://schema.org/Event",
    "/vault/wiki/organizations/": "https://schema.org/Organization",
    "/vault/wiki/procedures/":    "https://schema.org/HowTo",
    "/vault/wiki/working/":       "https://pod.vardeman.me/vault/ontology/wiki#WorkingNote",
};

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
