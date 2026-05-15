// Wikilink → pod URI resolver.
//
// In production, this will hit the pod's Type Index
// (`/vault/settings/publicTypeIndex`) and cache the name → URI mapping. For
// this sample we use a hardcoded resolver so the pipeline can be exercised
// without a live pod. Swap in a live resolver by implementing the same
// interface.

export interface WikilinkResolver {
  resolve(target: string): string | null;
}

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

// Hardcoded resolver for the sample. Maps a small set of known concept-note
// titles to their pod URIs. Anything not in the table falls through to a
// generated URI under /vault/resources/concepts/.
export class HardcodedResolver implements WikilinkResolver {
  constructor(
    private readonly base: string = "http://pod.vardeman.me:3000",
    private readonly defaultContainer: string = "/vault/resources/concepts/",
  ) {}

  resolve(target: string): string {
    return `${this.base}${this.defaultContainer}${slug(target)}.md`;
  }
}
