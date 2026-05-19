import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { DataFactory, Parser, Store } from "n3";
import { MetaWriter, buildTwoSubjectPatch } from "../src/metaWriter.js";

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

describe("buildTwoSubjectPatch (D98)", () => {
    const PAGE  = namedNode("https://pod.example/wiki/concepts/foo.md");
    const THING = namedNode("https://pod.example/wiki/concepts/foo.md#this");
    const DCT_TITLE = namedNode("http://purl.org/dc/terms/title");
    const SCHEMA_MAIN_ENTITY = namedNode("https://schema.org/mainEntity");
    const SCHEMA_NAME = namedNode("https://schema.org/name");
    const SKOS_PREF_LABEL = namedNode("http://www.w3.org/2004/02/skos/core#prefLabel");

    it("delete clause contains per-subject scoped wildcard patterns", () => {
        const patch = buildTwoSubjectPatch({
            pageIRI: PAGE,
            thingIRI: THING,
            pageGovernedPredicates: [DCT_TITLE, SCHEMA_MAIN_ENTITY],
            thingGovernedPredicates: [SCHEMA_NAME, SKOS_PREF_LABEL],
            insertQuads: [],
        });

        // page-subject delete patterns
        expect(patch).toContain(
            "<https://pod.example/wiki/concepts/foo.md> <http://purl.org/dc/terms/title>",
        );
        expect(patch).toContain(
            "<https://pod.example/wiki/concepts/foo.md> <https://schema.org/mainEntity>",
        );
        // thing-subject delete patterns
        expect(patch).toContain(
            "<https://pod.example/wiki/concepts/foo.md#this> <https://schema.org/name>",
        );
        expect(patch).toContain(
            "<https://pod.example/wiki/concepts/foo.md#this> <http://www.w3.org/2004/02/skos/core#prefLabel>",
        );
    });

    it("only deletes governed predicates — does not reference agent-owned predicates", () => {
        const patch = buildTwoSubjectPatch({
            pageIRI: PAGE,
            thingIRI: THING,
            pageGovernedPredicates: [DCT_TITLE],
            thingGovernedPredicates: [SCHEMA_NAME],
            insertQuads: [],
        });

        // Agent-owned predicates must not appear in the delete block
        expect(patch).not.toContain("biz:serialNumber");
        expect(patch).not.toContain("http://www.w3.org/2004/02/skos/core#prefLabel");
    });

    it("each wildcard variable is distinct (no variable reuse across subjects)", () => {
        const patch = buildTwoSubjectPatch({
            pageIRI: PAGE,
            thingIRI: THING,
            pageGovernedPredicates: [DCT_TITLE],
            thingGovernedPredicates: [SCHEMA_NAME],
            insertQuads: [],
        });

        // Variables are ?old1, ?old2, ... — should have at least two distinct names
        const vars = [...patch.matchAll(/\?old(\d+)/g)].map(m => m[0]);
        const unique = new Set(vars);
        expect(unique.size).toBeGreaterThanOrEqual(2);
    });

    it("includes insert quads in solid:inserts block", () => {
        const insertQuad = quad(
            PAGE,
            DCT_TITLE,
            DataFactory.literal("Foo Title"),
        );
        const patch = buildTwoSubjectPatch({
            pageIRI: PAGE,
            thingIRI: THING,
            pageGovernedPredicates: [DCT_TITLE],
            thingGovernedPredicates: [],
            insertQuads: [insertQuad],
        });

        expect(patch).toContain('"Foo Title"');
        expect(patch).toContain("solid:inserts");
    });

    it("produces valid solid:InsertDeletePatch header", () => {
        const patch = buildTwoSubjectPatch({
            pageIRI: PAGE,
            thingIRI: THING,
            pageGovernedPredicates: [DCT_TITLE],
            thingGovernedPredicates: [SCHEMA_NAME],
            insertQuads: [],
        });

        expect(patch).toContain("solid:InsertDeletePatch");
        expect(patch).toContain("solid:deletes");
    });

    it("works with empty thing predicates (page-only patch)", () => {
        const patch = buildTwoSubjectPatch({
            pageIRI: PAGE,
            thingIRI: THING,
            pageGovernedPredicates: [DCT_TITLE],
            thingGovernedPredicates: [],
            insertQuads: [],
        });

        expect(patch).toContain(
            "<https://pod.example/wiki/concepts/foo.md> <http://purl.org/dc/terms/title>",
        );
        expect(patch).not.toContain(
            "<https://pod.example/wiki/concepts/foo.md#this>",
        );
    });

    it("works with empty page predicates (thing-only patch)", () => {
        const patch = buildTwoSubjectPatch({
            pageIRI: PAGE,
            thingIRI: THING,
            pageGovernedPredicates: [],
            thingGovernedPredicates: [SCHEMA_NAME],
            insertQuads: [],
        });

        expect(patch).toContain(
            "<https://pod.example/wiki/concepts/foo.md#this> <https://schema.org/name>",
        );
        expect(patch).not.toContain(
            "<https://pod.example/wiki/concepts/foo.md> <",
        );
    });
});
