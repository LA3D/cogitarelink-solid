import { describe, it, expect, afterEach, vi } from "vitest";
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

    it("postProjectionHook receives <#this>-subject edges after materialize writes .meta", async () => {
      dir = mkdtempSync(join(tmpdir(), "mbp-hook-"));
      const url = "https://pod.vardeman.me/vault/wiki/concepts/y.md";
      const thisIri = `${url}#this`;
      const fsPath = join(dir, "vault/wiki/concepts/y.md");
      mkdirSync(dirname(fsPath), { recursive: true });
      writeFileSync(fsPath, "# y");

      // Recording fake hook — captures the onEdgesWritten call
      let recorded: { subject: string; edges: Array<{ predicate: string; object: string }>; timestamp: Date } | null = null;
      const fakeHook = {
        onEdgesWritten: vi.fn(async (input: typeof recorded) => { recorded = input; }),
      };

      const p = new MarkdownBodyProjector("https://pod.vardeman.me", dir, "/vault", fakeHook as any);
      const SKOS_PREF = "http://www.w3.org/2004/02/skos/core#prefLabel";
      const quads = [
        // <#this>-subject quad — must appear in hook payload
        quad(namedNode(thisIri), namedNode(SKOS_PREF), literal("Y")),
        // <> (page)-subject quad — must NOT appear in hook payload
        quad(namedNode(url), namedNode("http://purl.org/dc/terms/title"), literal("Y page")),
      ];

      await p.materialize({ path: url } as any, quads, [SKOS_PREF]);

      expect(fakeHook.onEdgesWritten).toHaveBeenCalledOnce();
      expect(recorded).not.toBeNull();
      expect(recorded!.subject).toBe(thisIri);
      // Only the <#this>-subject quad is passed
      expect(recorded!.edges).toHaveLength(1);
      expect(recorded!.edges[0].predicate).toBe(SKOS_PREF);
      expect(recorded!.edges[0].object).toBe("Y");
      expect(recorded!.timestamp).toBeInstanceOf(Date);
    });

    it("materialize still succeeds when postProjectionHook throws", async () => {
      dir = mkdtempSync(join(tmpdir(), "mbp-hook-err-"));
      const url = "https://pod.vardeman.me/vault/wiki/concepts/z.md";
      const thisIri = `${url}#this`;
      const fsPath = join(dir, "vault/wiki/concepts/z.md");
      mkdirSync(dirname(fsPath), { recursive: true });
      writeFileSync(fsPath, "# z");

      const throwingHook = {
        onEdgesWritten: vi.fn(async () => { throw new Error("hook exploded"); }),
      };

      const p = new MarkdownBodyProjector("https://pod.vardeman.me", dir, "/vault", throwingHook as any);
      const SKOS_PREF = "http://www.w3.org/2004/02/skos/core#prefLabel";
      const quads = [
        quad(namedNode(thisIri), namedNode(SKOS_PREF), literal("Z")),
      ];

      // Must NOT throw — hook errors are swallowed (substrate event archival must not block .meta writes)
      await expect(
        p.materialize({ path: url } as any, quads, [SKOS_PREF])
      ).resolves.toBeUndefined();

      // The .meta was still written despite the hook throwing
      const out = new Store(new Parser().parse(readFileSync(`${fsPath}.meta`, "utf8")));
      expect(out.getQuads(null, namedNode(SKOS_PREF), null, null)).toHaveLength(1);
    });
  });
});
