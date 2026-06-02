import { describe, it, expect } from "vitest";
import { projectionPipeline } from "./projectionPipeline";
import { regenerateGrammar } from "./roundTrip";

// The forward binding the projection used (literal token + edge token).
const FWD = {
  prefLabel: "http://www.w3.org/2004/02/skos/core#prefLabel",
  broader: "http://www.w3.org/2004/02/skos/core#broader",
};

describe("G9: round-trip oracle", () => {
  it("round-trips literals losslessly and recovers edge predicates (label is slug-lossy)", async () => {
    const body = `---\ntype: concept\n---\n# X\n[Photosynthesis]{.prefLabel} relates to [[Biology]]{.broader}.`;
    const quads = await projectionPipeline.run("https://pod/wiki/concepts/x.md", body);
    const regen = regenerateGrammar(quads, "https://pod/wiki/concepts/x.md", FWD);

    // literal: lossless (value carried verbatim)
    expect(regen).toContain("[Photosynthesis]{.prefLabel}");
    // resource edge: predicate token recovered; label is the URI slug, not the original "Biology"
    expect(regen).toMatch(/\[\[[^\]]+\]\]\{\.broader\}/);
  });
});
