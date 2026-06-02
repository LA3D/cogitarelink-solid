import { describe, it, expect } from "vitest";
import { projectionPipeline } from "./projectionPipeline";

describe("projectionPipeline literal axis", () => {
  it("projects literal spans alongside wikilink edges, purely", async () => {
    const body = `---\ntype: concept\n---\n# Photosynthesis\nThe term is [Photosynthesis]{.prefLabel} and it is [[Biology]]{.broader}.`;
    const quads = await projectionPipeline.run("https://pod/wiki/concepts/photosynthesis.md", body);
    const preds = quads.map(q => q.predicate.value);
    expect(preds).toContain("http://www.w3.org/2004/02/skos/core#prefLabel");
    expect(preds).toContain("http://www.w3.org/2004/02/skos/core#broader");
    const pl = quads.find(q => q.predicate.value.endsWith("prefLabel"));
    expect(pl!.subject.value).toBe("https://pod/wiki/concepts/photosynthesis.md#this");
  });

  it("run() touches no store/network (pure)", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync(new URL("./projectionPipeline.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/getRepresentation|\.getResource\(|fetch\(/);
  });
});
