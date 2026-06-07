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

  it("derives <> dct:conformsTo <profiles/concept> for a Concept body (D86)", async () => {
    const body = `---\ntype: concept\n---\n# Photosynthesis\nThe term is [Photosynthesis]{.prefLabel}.`;
    const uri = "https://pod.vardeman.me/vault/wiki/concepts/photosynthesis.md";
    const quads = await projectionPipeline.run(uri, body);
    const ct = quads.find(q =>
      q.predicate.value === "http://purl.org/dc/terms/conformsTo");
    expect(ct).toBeDefined();
    expect(ct!.subject.value).toBe(uri);  // page-level hint, on <>
    expect(ct!.object.value).toBe(
      "https://pod.vardeman.me/vault/meta/profiles/concept");
  });

  it("falls back to the page profile when no frontmatter type is given", async () => {
    // /wiki/concepts/ container fallback resolves a Thing class (skos:Concept) so
    // invariants fire, but with no type: the conformsTo defaults to the page profile.
    const body = `# Untyped\nbody`;
    const uri = "https://pod.vardeman.me/vault/wiki/concepts/untyped.md";
    const quads = await projectionPipeline.run(uri, body);
    const ct = quads.find(q =>
      q.predicate.value === "http://purl.org/dc/terms/conformsTo");
    expect(ct).toBeDefined();
    expect(ct!.object.value).toBe(
      "https://pod.vardeman.me/vault/meta/profiles/page");
  });

  it("run() touches no store/network (pure)", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync(new URL("./projectionPipeline.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/getRepresentation|\.getResource\(|fetch\(/);
  });
});
