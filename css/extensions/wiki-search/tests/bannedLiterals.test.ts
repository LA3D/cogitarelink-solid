import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// R-T4 / R4 banned-literal guard (audit H1 countermeasure, exemplar:
// markdown-projection/test/bannedLiterals.test.ts). D107 parameterized the
// storage root (storagePath) — but the sweep stopped at the projection
// listener. wiki-search baked the WHOLE affordance gate behind
// `const WIKI_PREFIX = "/vault/wiki/"` (uri.ts). After R-T4 the subtree prefix
// is DERIVED from the injected storagePath (default "/vault"), so the baked
// "/vault/wiki/" container path must not creep back into the search src.
//
// Allowed occurrences (per the established listener pattern):
//   - the wiki-memory L3 layout SEGMENT ("wiki") — the profile's own constant.
//   - `storagePath = "/vault"` constructor DEFAULTS — config overrides them; the
//     default keeps the unit suite green (matches MarkdownProjectionListener).
//   - vocabulary IRIs (https://pod.vardeman.me/vault/ontology/…) — RDF IRIs, a
//     separate hardcode concern (the pod.vardeman.me namespace, audit P1), out
//     of R-T4's storagePath scope — stripped before the check.

function stripCommentsAndVocab(src: string): string {
  return src
    // line comments
    .replace(/\/\/[^\n]*/g, "")
    // block comments
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // JSDoc-style ` * ` continuation lines (block comments above already cover
    // /* … */, but the source uses leading " * " inside them — covered by the
    // block-comment strip; this is belt-and-suspenders for any stray line).
    .replace(/^\s*\*[^\n]*$/gm, "")
    // vocabulary IRI namespace (an RDF IRI, not a storage path)
    .replace(/https:\/\/pod\.vardeman\.me\/vault\/ontology\/[^"'`\s]*/g, "");
}

const dir = (f: string) => join(__dirname, "..", "src", f);

describe("R-T4 banned-literal guard (storage root must come from config)", () => {
  it("uri.ts has no baked /vault/wiki/ container path", () => {
    const src = stripCommentsAndVocab(readFileSync(dir("uri.ts"), "utf8"));
    expect(src).not.toContain("/vault/wiki/");
  });

  it("WikiSearchHttpHandler.ts has no baked /vault/wiki/ container path", () => {
    const src = stripCommentsAndVocab(readFileSync(dir("WikiSearchHttpHandler.ts"), "utf8"));
    expect(src).not.toContain("/vault/wiki/");
  });

  it("WikiSearchLinkMetadataWriter.ts has no baked /vault/wiki/ container path", () => {
    const src = stripCommentsAndVocab(readFileSync(dir("WikiSearchLinkMetadataWriter.ts"), "utf8"));
    expect(src).not.toContain("/vault/wiki/");
  });

  it("uri.ts has no bare /vault storage-path literal at all (segment-only)", () => {
    // uri.ts derives the prefix purely from the injected storagePath, so it
    // must carry no /vault root literal — only the WIKI_SEGMENT constant.
    const src = stripCommentsAndVocab(readFileSync(dir("uri.ts"), "utf8"));
    expect(src).not.toContain("/vault");
  });

  it("the only bare /vault literals in the wired classes are storagePath defaults", () => {
    for (const f of ["WikiSearchHttpHandler.ts", "WikiSearchLinkMetadataWriter.ts"]) {
      const src = stripCommentsAndVocab(readFileSync(dir(f), "utf8"));
      const occurrences = src.match(/\/vault/g) ?? [];
      // Exactly one allowed: the `storagePath = "/vault"` constructor default.
      expect(occurrences).toHaveLength(1);
      expect(src).toContain('storagePath = "/vault"');
    }
  });
});
