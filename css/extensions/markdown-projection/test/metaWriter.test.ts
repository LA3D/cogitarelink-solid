import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { DataFactory, Parser, Store } from "n3";
import { MetaWriter } from "../src/metaWriter.js";

const { namedNode, literal, quad } = DataFactory;

describe("MetaWriter", () => {
    let dir: string;
    let writer: MetaWriter;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), "metaw-"));
        writer = new MetaWriter();
    });

    afterEach(() => {
        try { rmSync(dir, { recursive: true }); } catch {}
    });

    it("creates .meta file when none exists", async () => {
        const target = join(dir, "foo.md");
        const t = [quad(namedNode("urn:x"), namedNode("urn:p"), literal("v"))];
        await writer.replaceGoverned(target, t, ["urn:p"]);
        const out = readFileSync(`${target}.meta`, "utf8");
        expect(out).toContain("urn:p");
    });

    it("preserves non-governed triples across replaceGoverned", async () => {
        const target = join(dir, "bar.md");
        const existing = `<urn:bar> <urn:agentOwned> "keep me" .`;
        writeFileSync(`${target}.meta`, existing);

        const newGoverned = [quad(namedNode("urn:bar"), namedNode("urn:title"), literal("hello"))];
        await writer.replaceGoverned(target, newGoverned, ["urn:title"]);

        const out = new Store(new Parser().parse(readFileSync(`${target}.meta`, "utf8")));
        const agentOwned = out.getQuads(null, namedNode("urn:agentOwned"), null, null);
        expect(agentOwned).toHaveLength(1);
        const titles = out.getQuads(null, namedNode("urn:title"), null, null);
        expect(titles[0]?.object.value).toBe("hello");
    });

    it("removes old governed triples on replace", async () => {
        const target = join(dir, "baz.md");
        const existing = `<urn:baz> <urn:title> "old title" .`;
        writeFileSync(`${target}.meta`, existing);

        const newGoverned = [quad(namedNode("urn:baz"), namedNode("urn:title"), literal("new title"))];
        await writer.replaceGoverned(target, newGoverned, ["urn:title"]);

        const out = new Store(new Parser().parse(readFileSync(`${target}.meta`, "utf8")));
        const titles = out.getQuads(null, namedNode("urn:title"), null, null);
        expect(titles).toHaveLength(1);
        expect(titles[0].object.value).toBe("new title");
    });
});
