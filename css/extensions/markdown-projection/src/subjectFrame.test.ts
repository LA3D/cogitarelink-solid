import { describe, it, expect } from "vitest";
import { resolveSubject, PAGE_FRAME_TOKENS, PAGE_FRAME_TOKEN_BINDING } from "./subjectFrame";
import { DEFAULT_LITERAL_BINDING } from "./spanLiteralProjection";
import { PAGE_GOVERNED_PREDICATES } from "./governedPredicates";

describe("resolveSubject", () => {
  const page = "https://pod/wiki/concepts/x.md";
  it("content predicates default to <#this>", () => {
    expect(resolveSubject(page, "prefLabel", undefined)).toBe(page + "#this");
  });
  it("document-metadata predicates default to <>", () => {
    expect(resolveSubject(page, "title", undefined)).toBe(page);
  });
  it("an explicit switch overrides the default", () => {
    expect(resolveSubject(page, "prefLabel", "page")).toBe(page);
    expect(resolveSubject(page, "title", "thing")).toBe(page + "#this");
  });

  // R-T2 (audit R1.3): the `identifier` literal token was page-frame in the old
  // hand-mirrored set, but dct:identifier is governed on the Thing <#this> (the
  // Source shape's <#this>-scoped property). It must resolve to <#this> so the
  // projected subject matches the governed-delete subject (no stale/dup triples).
  it("the identifier token resolves to the Thing frame <#this> (matches governance)", () => {
    expect(resolveSubject(page, "identifier", undefined)).toBe(page + "#this");
  });
});

// Agreement test (REQUIRED): the page/thing partition in subjectFrame is derived
// from governedPredicates (the single source). Every literal-axis token must map
// to a frame consistent with where its bound IRI sits in the governed partition:
//   - a token whose IRI is in PAGE_GOVERNED_PREDICATES → page frame (<>)
//   - a token whose IRI is NOT page-governed → thing frame (<#this>)
describe("subjectFrame ↔ governedPredicates partition agreement (R1.3)", () => {
  const PAGE_GOVERNED = new Set(PAGE_GOVERNED_PREDICATES.map((n) => n.value));

  it("every page-frame token's IRI is page-governed", () => {
    for (const tok of PAGE_FRAME_TOKENS) {
      const iri = PAGE_FRAME_TOKEN_BINDING[tok];
      expect(iri, `page-frame token ${tok} must have a bound IRI`).toBeDefined();
      expect(
        PAGE_GOVERNED.has(iri),
        `page-frame token ${tok} → ${iri} must be in PAGE_GOVERNED_PREDICATES`,
      ).toBe(true);
    }
  });

  it("every page-binding token NOT page-governed resolves to the Thing frame", () => {
    const page = "https://pod/wiki/concepts/x.md";
    for (const [tok, iri] of Object.entries(PAGE_FRAME_TOKEN_BINDING)) {
      if (!PAGE_GOVERNED.has(iri)) {
        expect(
          resolveSubject(page, tok, undefined),
          `token ${tok} → ${iri} (not page-governed) must frame to <#this>`,
        ).toBe(page + "#this");
      }
    }
  });

  it("identifier specifically: not page-governed, so Thing-framed", () => {
    const idIri = PAGE_FRAME_TOKEN_BINDING["identifier"];
    expect(PAGE_GOVERNED.has(idIri)).toBe(false);
    expect(PAGE_FRAME_TOKENS.has("identifier")).toBe(false);
  });

  it("every Thing-literal binding token (prefLabel/altLabel/definition) frames to <#this>", () => {
    const page = "https://pod/wiki/concepts/x.md";
    for (const tok of Object.keys(DEFAULT_LITERAL_BINDING)) {
      expect(
        resolveSubject(page, tok, undefined),
        `Thing-literal token ${tok} must frame to <#this>`,
      ).toBe(page + "#this");
    }
  });
});
