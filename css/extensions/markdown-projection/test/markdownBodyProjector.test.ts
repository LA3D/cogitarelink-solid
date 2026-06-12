import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { createHash } from "crypto";
import { DataFactory, Parser, Store } from "n3";
import { MarkdownBodyProjector } from "../src-cjs/markdownBodyProjector.js";
import { STAMP_PRED, VERSION_PRED } from "../src-cjs/stampPredicates.js";

const { namedNode, literal, quad } = DataFactory;

const FIRST_WRITE = { oldBody: null, oldMetaTtl: null };

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
      await p.materialize({ path: url } as any, quads, ["http://www.w3.org/2004/02/skos/core#prefLabel"], FIRST_WRITE);

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

      await p.materialize({ path: url } as any, quads, [SKOS_PREF], FIRST_WRITE);

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
        p.materialize({ path: url } as any, quads, [SKOS_PREF], FIRST_WRITE)
      ).resolves.toBeUndefined();

      // The .meta was still written despite the hook throwing
      const out = new Store(new Parser().parse(readFileSync(`${fsPath}.meta`, "utf8")));
      expect(out.getQuads(null, namedNode(SKOS_PREF), null, null)).toHaveLength(1);
    });
  });

  // --- PSP T3: pre-commit snapshot + exact subtraction + version stamp -------
  // These tests emulate the floor's sequence against the REAL pipeline + FS:
  // snapshot (pre-commit) → write body (the commit) → materialize(stamped, snapshot).
  describe("snapshot + exact subtraction (PSP T3)", () => {
    let dir: string;
    afterEach(() => { try { rmSync(dir, { recursive: true }); } catch {} });

    const SKOS_PREF = "http://www.w3.org/2004/02/skos/core#prefLabel";
    const SKOS_BROADER = "http://www.w3.org/2004/02/skos/core#broader";
    const BODY_V1 = "---\ntype: concept\n---\n# Photosynthesis\n\n[Photosynthesis]{.prefLabel}\n\n[[Biology]]{.broader}\n";
    // V2: definition (prefLabel) revised + the wikilink edge DROPPED
    const BODY_V2 = "---\ntype: concept\n---\n# Photosynthesis\n\n[Light-driven carbon fixation]{.prefLabel}\n";

    function setup(slug: string) {
      dir = mkdtempSync(join(tmpdir(), "mbp-snap-"));
      const p = new MarkdownBodyProjector("https://pod.vardeman.me", dir, "/vault");
      const url = `https://pod.vardeman.me/vault/wiki/concepts/${slug}.md`;
      const fsPath = join(dir, `vault/wiki/concepts/${slug}.md`);
      mkdirSync(dirname(fsPath), { recursive: true });
      return { p, url, fsPath };
    }

    const sha = (s: string) => createHash("sha256").update(s).digest("hex");
    const stampQuads = (url: string, body: string, version: string) => [
      quad(namedNode(url), namedNode(STAMP_PRED), literal(sha(body))),
      quad(namedNode(url), namedNode(VERSION_PRED), literal(version)),
    ];

    // Emulate one floor write: snapshot BEFORE commit, commit, project, stamp, materialize.
    async function floorWrite(p: MarkdownBodyProjector, url: string, fsPath: string, body: string) {
      const snap = await p.snapshot({ path: url } as any);
      writeFileSync(fsPath, body);
      const r = await p.project({ path: url } as any, body);
      const stamped = [...r!.quads, ...stampQuads(url, body, p.version)];
      await p.materialize({ path: url } as any, stamped, [...r!.governed, STAMP_PRED, VERSION_PRED], snap);
    }

    function readMeta(fsPath: string, url: string): Store {
      return new Store(new Parser({ baseIRI: `${url}.meta` }).parse(readFileSync(`${fsPath}.meta`, "utf8")));
    }

    it("snapshot reads body + .meta pre-commit; nulls when absent", async () => {
      const { p, url, fsPath } = setup("snap");
      expect(await p.snapshot({ path: url } as any)).toEqual({ oldBody: null, oldMetaTtl: null });
      writeFileSync(fsPath, "# v1");
      writeFileSync(`${fsPath}.meta`, `<${url}#this> <urn:x> "y" .`);
      const snap = await p.snapshot({ path: url } as any);
      expect(snap.oldBody).toBe("# v1");
      expect(snap.oldMetaTtl).toContain("urn:x");
    });

    it("exact path: agent triple survives, dropped edge removed, exactly one stamp each, no signal", async () => {
      const { p, url, fsPath } = setup("exact");
      const sig = vi.spyOn(p, "signalDegraded");

      await floorWrite(p, url, fsPath, BODY_V1);
      // agent PATCHes an ungoverned triple between the writes
      writeFileSync(`${fsPath}.meta`, readFileSync(`${fsPath}.meta`, "utf8") + `\n<${url}#this> <urn:agentOwned> "keep" .\n`);
      await floorWrite(p, url, fsPath, BODY_V2);

      const out = readMeta(fsPath, url);
      // agent triple survives (the D82 case)
      expect(out.getQuads(null, namedNode("urn:agentOwned"), null, null)).toHaveLength(1);
      // the dropped wikilink edge is REMOVED — the residue degraded mode can't clear
      expect(out.getQuads(null, namedNode(SKOS_BROADER), null, null)).toHaveLength(0);
      // revised definition present, old value gone
      const labels = out.getQuads(null, namedNode(SKOS_PREF), null, null);
      expect(labels).toHaveLength(1);
      expect(labels[0].object.value).toBe("Light-driven carbon fixation");
      // exactly ONE bodyHash + ONE projectorVersion (old stamps subtracted, not accumulated)
      const hashes = out.getQuads(null, namedNode(STAMP_PRED), null, null);
      expect(hashes).toHaveLength(1);
      expect(hashes[0].object.value).toBe(sha(BODY_V2));
      const versions = out.getQuads(null, namedNode(VERSION_PRED), null, null);
      expect(versions).toHaveLength(1);
      expect(versions[0].object.value).toBe(p.version);
      // exact path on write 2 (first write is silent by the first-write rule)
      expect(sig).not.toHaveBeenCalled();
    });

    it("version-mismatch snapshot → degraded path (signal fires) AND the agent triple still survives", async () => {
      const { p, url, fsPath } = setup("mismatch");
      const sig = vi.spyOn(p, "signalDegraded");

      // Seed a prior write as if stamped by an OLDER projector version
      writeFileSync(fsPath, BODY_V1);
      writeFileSync(`${fsPath}.meta`, [
        `<${url}#this> <${SKOS_PREF}> "Photosynthesis" .`,
        `<${url}#this> <${SKOS_BROADER}> <https://pod.vardeman.me/vault/wiki/concepts/biology.md#this> .`,
        `<${url}#this> <urn:agentOwned> "keep" .`,
        `<${url}> <${STAMP_PRED}> "${sha(BODY_V1)}" .`,
        `<${url}> <${VERSION_PRED}> "0.0.0-stale" .`,
      ].join("\n"));

      await floorWrite(p, url, fsPath, BODY_V2);

      expect(sig).toHaveBeenCalledTimes(1);
      const out = readMeta(fsPath, url);
      // pairShadow still preserves the agent triple
      expect(out.getQuads(null, namedNode("urn:agentOwned"), null, null)).toHaveLength(1);
      // stamps do NOT accumulate even degraded (pairShadow covers the stamp pairs)
      expect(out.getQuads(null, namedNode(STAMP_PRED), null, null)).toHaveLength(1);
      const versions = out.getQuads(null, namedNode(VERSION_PRED), null, null);
      expect(versions).toHaveLength(1);
      expect(versions[0].object.value).toBe(p.version);
      // documented degraded residue: V2 emits no broader pair, so the stale edge REMAINS
      expect(out.getQuads(null, namedNode(SKOS_BROADER), null, null)).toHaveLength(1);
    });

    it("first write (no prior body, no prior .meta) emits NO degraded signal", async () => {
      const { p, url, fsPath } = setup("first");
      const sig = vi.spyOn(p, "signalDegraded");
      await floorWrite(p, url, fsPath, BODY_V1);
      expect(sig).not.toHaveBeenCalled();
    });

    it("prior .meta WITHOUT a version stamp (pre-migration state) → degraded + signal", async () => {
      const { p, url, fsPath } = setup("premigration");
      const sig = vi.spyOn(p, "signalDegraded");
      writeFileSync(fsPath, BODY_V1);
      writeFileSync(`${fsPath}.meta`, `<${url}#this> <${SKOS_PREF}> "Photosynthesis" .`);
      await floorWrite(p, url, fsPath, BODY_V2);
      expect(sig).toHaveBeenCalledTimes(1);
    });

    it("idempotency: re-projecting the SAME body twice leaves .meta unchanged (modulo set order)", async () => {
      const { p, url, fsPath } = setup("idem");
      await floorWrite(p, url, fsPath, BODY_V1);
      const first = readMeta(fsPath, url).getQuads(null, null, null, null).length;
      await floorWrite(p, url, fsPath, BODY_V1);
      const out = readMeta(fsPath, url);
      expect(out.getQuads(null, null, null, null)).toHaveLength(first);
      expect(out.getQuads(null, namedNode(STAMP_PRED), null, null)).toHaveLength(1);
      expect(out.getQuads(null, namedNode(VERSION_PRED), null, null)).toHaveLength(1);
    });
  });
});
