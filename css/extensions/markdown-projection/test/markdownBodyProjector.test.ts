import { describe, it, expect } from "vitest";
import { MarkdownBodyProjector } from "../src-cjs/markdownBodyProjector.js";

describe("MarkdownBodyProjector", () => {
  const proj = new MarkdownBodyProjector("https://pod.vardeman.me", "/data", "/vault");

  it("canProject true for text/markdown, false otherwise", () => {
    expect(proj.canProject({ metadata: { contentType: "text/markdown" } } as any)).toBe(true);
    expect(proj.canProject({ metadata: { contentType: "text/turtle" } } as any)).toBe(false);
  });

  it("projects a concept body to quads + governed set including skos:prefLabel", async () => {
    // type: concept maps to wiki:Concept via TYPE_MAP in frontmatterProjection.ts
    const body = "---\ntype: concept\n---\n# Photosynthesis\n\n[Photosynthesis]{.prefLabel}\n\n[[Biology]]{.broader}\n";
    const r = await proj.project({ path: "https://pod.vardeman.me/vault/wiki/concepts/photosynthesis.md" } as any, body);
    expect(r).not.toBeNull();
    const preds = r!.quads.map(q => q.predicate.value);
    expect(preds).toContain("http://www.w3.org/2004/02/skos/core#prefLabel");
    expect(r!.governed).toContain("http://www.w3.org/2004/02/skos/core#prefLabel");
  });
});
