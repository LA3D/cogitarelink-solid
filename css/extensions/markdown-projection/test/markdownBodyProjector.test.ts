import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { DataFactory, Parser, Store } from "n3";
import { MarkdownBodyProjector } from "../src-cjs/markdownBodyProjector.js";

const { namedNode, literal, quad } = DataFactory;

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

  describe("materialize — writes the admitted graph to the resource's .meta", () => {
    let dir: string;
    afterEach(() => { try { rmSync(dir, { recursive: true }); } catch {} });

    it("resolves the fs path from baseUrl/dataDir and replaces governed predicates (preserving agent-owned)", async () => {
      dir = mkdtempSync(join(tmpdir(), "mbp-"));
      // dataDir = pod-root temp dir. fsPathFromUrl strips only baseUrl, so the
      // /vault storage segment stays in the relative path: <dataDir>/vault/wiki/concepts/x.md
      const p = new MarkdownBodyProjector("https://pod.vardeman.me", dir, "/vault");
      const url = "https://pod.vardeman.me/vault/wiki/concepts/x.md";
      const fsPath = join(dir, "vault/wiki/concepts/x.md");
      mkdirSync(dirname(fsPath), { recursive: true });
      writeFileSync(fsPath, "# x"); // resource on disk
      // seed an agent-owned triple in .meta that must survive
      writeFileSync(`${fsPath}.meta`, `<${url}#this> <urn:agentOwned> "keep" .`);

      const quads = [
        quad(namedNode(`${url}#this`), namedNode("http://www.w3.org/2004/02/skos/core#prefLabel"), literal("X")),
      ];
      await p.materialize({ path: url } as any, quads, ["http://www.w3.org/2004/02/skos/core#prefLabel"]);

      const out = new Store(new Parser().parse(readFileSync(`${fsPath}.meta`, "utf8")));
      // governed predicate written
      expect(out.getQuads(null, namedNode("http://www.w3.org/2004/02/skos/core#prefLabel"), null, null)).toHaveLength(1);
      // agent-owned predicate preserved (D81 Model A)
      expect(out.getQuads(null, namedNode("urn:agentOwned"), null, null)).toHaveLength(1);
    });
  });
});
