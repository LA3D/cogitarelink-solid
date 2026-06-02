import { describe, it, expect } from "vitest";
import { projectionPipeline } from "./projectionPipeline";

// G10 (structural, offline): the RQ-View-2 forward target — a concept authored PURELY inline
// (frontmatter + body grammar, no .meta PATCH) projects every ConceptShape-governed predicate on
// <#this>: the literal axis (prefLabel/definition via [text]{.pred}), the edge axis (broader via
// [[X]]{.broader}), and the derived invariant (schema:name). The live round-trip (deployed) is in
// tests/test_grammar_roundtrip_live.py.
describe("G10: conformant concept authorable inline (RQ-View-2 forward target)", () => {
  it("projects prefLabel + definition + broader + schema:name on <#this>, no PATCH", async () => {
    const body =
      `---\ntype: concept\n---\n# Photosynthesis\n` +
      `[Photosynthesis]{.prefLabel}; ` +
      `[The conversion of light energy to chemical energy]{.definition}; ` +
      `broader [[Biology]]{.broader}.`;
    const q = await projectionPipeline.run(
      "https://pod.vardeman.me/vault/wiki/concepts/photosynthesis.md", body);
    const onThis = q
      .filter((x) => x.subject.value.endsWith("#this"))
      .map((x) => x.predicate.value);
    expect(onThis).toContain("http://www.w3.org/2004/02/skos/core#prefLabel");
    expect(onThis).toContain("http://www.w3.org/2004/02/skos/core#definition");
    expect(onThis).toContain("http://www.w3.org/2004/02/skos/core#broader");
    expect(onThis).toContain("https://schema.org/name");
  });
});
