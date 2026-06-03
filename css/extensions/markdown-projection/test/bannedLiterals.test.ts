import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// R-T1 / R4 banned-literal guard (audit countermeasure, exemplar:
// shape-validator/test/layering.test.ts). When a decision parameterizes the
// storage root (D107 storagePath), the old literal must not creep back into
// general projection code. The wiki-memory L3 layout SEGMENT ("/wiki/") is
// allowed — it is the profile's own container-layout constant. The storage
// ROOT ("/vault") is the deployment root and must come from config.
//
// Two distinct path strings are checked:
//   - "/vault/wiki/" — a baked storage CONTAINER path (the R4 defect: it lived
//     in DEFAULT_WIKI_TYPE_INDEX keys and couldBeL4Container). Must be gone.
//   - bare "/vault" used as a storage-root PATH literal. The only permitted
//     occurrence is the deprecated DEFAULT_WIKI_TYPE_INDEX alias seam, which
//     calls defaultWikiTypeIndex("/vault") for back-compat (typeIndexLookup.ts).
//
// NOTE: the wiki-ontology VOCABULARY namespace
// (https://pod.vardeman.me/vault/ontology/wiki#) is an RDF IRI, not a storage
// path — it is governed by a separate hardcode concern (the pod.vardeman.me
// namespace, P1), out of R-T1's storagePath scope — so we strip vocabulary IRIs
// and comments before checking container/storage-path literals.

function stripCommentsAndVocab(src: string): string {
  return src
    // line comments
    .replace(/\/\/[^\n]*/g, "")
    // block comments
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // wiki-ontology vocabulary IRI namespace (an RDF IRI, not a storage path)
    .replace(/https:\/\/pod\.vardeman\.me\/vault\/ontology\/[^"'`\s]*/g, "");
}

const dir = (f: string) => join(__dirname, "..", "src", f);

describe("R-T1 banned-literal guard (storage root must come from config)", () => {
  it("typeIndexLookup.ts has no baked /vault/wiki/ container path", () => {
    const src = stripCommentsAndVocab(readFileSync(dir("typeIndexLookup.ts"), "utf8"));
    expect(src).not.toContain("/vault/wiki/");
  });

  it("wikilinkProjection.ts has no /vault storage-path literal at all", () => {
    const src = stripCommentsAndVocab(readFileSync(dir("wikilinkProjection.ts"), "utf8"));
    expect(src).not.toContain("/vault");
  });

  it("typeIndexLookup.ts: the only bare /vault literal is the deprecated alias seam", () => {
    const src = stripCommentsAndVocab(readFileSync(dir("typeIndexLookup.ts"), "utf8"));
    // Exactly one /vault occurrence allowed: defaultWikiTypeIndex("/vault").
    const occurrences = src.match(/\/vault/g) ?? [];
    expect(occurrences).toHaveLength(1);
    expect(src).toContain('defaultWikiTypeIndex("/vault")');
  });
});
