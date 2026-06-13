import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { DataFactory, Parser, Store } from "n3";
import { MetaWriter } from "../src/metaWriter.js";

const { namedNode, literal, quad } = DataFactory;

const PREF_LABEL = "http://www.w3.org/2004/02/skos/core#prefLabel";
const PROV_GEN_BY = "http://www.w3.org/ns/prov#wasGeneratedBy";

function readMeta(target: string): Store {
    return new Store(new Parser().parse(readFileSync(`${target}.meta`, "utf8")));
}

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
        await writer.replaceProjected(target, t, []);
        const out = readFileSync(`${target}.meta`, "utf8");
        expect(out).toContain("urn:p");
    });

    // Exact path (oldProjected provided): subtraction removes ONLY the prior
    // projection's quads. Agent triples survive by construction — even ones
    // using a projection predicate (skos:prefLabel) on a FOREIGN subject,
    // which the old predicate-keyed strip clobbered.
    it("preserves agent triples while replacing the old projection (exact subtraction)", async () => {
        const target = join(dir, "bar.md");
        const url = "https://pod.example/vault/wiki/concepts/bar.md";
        const thisIri = `${url}#this`;
        const existing = [
            `<${thisIri}> <${PREF_LABEL}> "Old" .`,
            `<urn:foreign> <${PREF_LABEL}> "agent label on foreign subject" .`,
            `<${thisIri}> <urn:agentOwned> "keep me" .`,
        ].join("\n");
        writeFileSync(`${target}.meta`, existing);

        const oldProjected = [quad(namedNode(thisIri), namedNode(PREF_LABEL), literal("Old"))];
        const newProjected = [quad(namedNode(thisIri), namedNode(PREF_LABEL), literal("New"))];
        await writer.replaceProjected(target, newProjected, oldProjected, { resourceUrl: url });

        const out = readMeta(target);
        const labels = out.getQuads(namedNode(thisIri), namedNode(PREF_LABEL), null, null);
        expect(labels).toHaveLength(1);
        expect(labels[0].object.value).toBe("New");
        expect(out.getQuads(namedNode("urn:foreign"), namedNode(PREF_LABEL), null, null)).toHaveLength(1);
        expect(out.getQuads(namedNode(thisIri), namedNode("urn:agentOwned"), null, null)).toHaveLength(1);
    });

    // Clobber simulation (the D82 root cause): CSS's writeMetadataFile has
    // already overwritten the on-disk .meta by the time the floor materializes.
    // When the caller passes the pre-commit snapshot, the DISK state is ignored —
    // the snapshot's agent quads win.
    it("snapshotTtl wins over the on-disk .meta (clobber simulation)", async () => {
        const target = join(dir, "clob.md");
        const url = "https://pod.example/vault/wiki/concepts/clob.md";
        const thisIri = `${url}#this`;
        // Disk: CSS clobbered it — bare server bookkeeping, agent quads gone.
        writeFileSync(`${target}.meta`, `<${url}> <urn:cssBookkeeping> "clobbered" .`);
        // Snapshot: read BEFORE the clobber — agent quads + old projection.
        const snapshotTtl = [
            `<${thisIri}> <${PREF_LABEL}> "Old" .`,
            `<${thisIri}> <urn:agentOwned> "agent enrichment" .`,
        ].join("\n");

        const oldProjected = [quad(namedNode(thisIri), namedNode(PREF_LABEL), literal("Old"))];
        const newProjected = [quad(namedNode(thisIri), namedNode(PREF_LABEL), literal("New"))];
        await writer.replaceProjected(target, newProjected, oldProjected, { resourceUrl: url, snapshotTtl });

        const out = readMeta(target);
        expect(out.getQuads(namedNode(thisIri), namedNode("urn:agentOwned"), null, null)).toHaveLength(1);
        const labels = out.getQuads(namedNode(thisIri), namedNode(PREF_LABEL), null, null);
        expect(labels).toHaveLength(1);
        expect(labels[0].object.value).toBe("New");
        // Disk state was ignored, not merged.
        expect(out.getQuads(null, namedNode("urn:cssBookkeeping"), null, null)).toHaveLength(0);
    });

    // Listener path: no snapshot → the on-disk .meta IS the current state.
    it("falls back to the on-disk .meta when no snapshot is given", async () => {
        const target = join(dir, "disk.md");
        const existing = [
            `<urn:disk> <urn:title> "Old" .`,
            `<urn:disk> <urn:agentOwned> "keep me" .`,
        ].join("\n");
        writeFileSync(`${target}.meta`, existing);

        const oldProjected = [quad(namedNode("urn:disk"), namedNode("urn:title"), literal("Old"))];
        const newProjected = [quad(namedNode("urn:disk"), namedNode("urn:title"), literal("New"))];
        await writer.replaceProjected(target, newProjected, oldProjected);

        const out = readMeta(target);
        expect(out.getQuads(null, namedNode("urn:agentOwned"), null, null)).toHaveLength(1);
        const titles = out.getQuads(null, namedNode("urn:title"), null, null);
        expect(titles).toHaveLength(1);
        expect(titles[0].object.value).toBe("New");
    });

    // Degraded mode (oldProjected null): pair-shadow. Quads sharing a
    // (subject, predicate) pair with the NEW projection are replaced; quads on
    // a different pair survive — even with a projection predicate on another
    // subject (strictly narrower than the legacy predicate strip).
    it("oldProjected null → pairShadow: same-pair stale value replaced, different-pair kept", async () => {
        const target = join(dir, "shadow.md");
        const existing = [
            `<urn:s> <urn:title> "stale" .`,
            `<urn:other> <urn:title> "different subject, same predicate" .`,
        ].join("\n");
        writeFileSync(`${target}.meta`, existing);

        const newProjected = [quad(namedNode("urn:s"), namedNode("urn:title"), literal("fresh"))];
        await writer.replaceProjected(target, newProjected, null);

        const out = readMeta(target);
        const onS = out.getQuads(namedNode("urn:s"), namedNode("urn:title"), null, null);
        expect(onS).toHaveLength(1);
        expect(onS[0].object.value).toBe("fresh");
        expect(out.getQuads(namedNode("urn:other"), namedNode("urn:title"), null, null)).toHaveLength(1);
    });

    // F7 regression, now via plain subtraction — NO subject-scope special case.
    // The index view's derivation pointer (<resource> prov:wasGeneratedBy
    // <view-descriptor>) is not in oldProjected, so it survives; the prior
    // pipeline stamp on the .meta doc subject IS in oldProjected, so it goes.
    it("preserves prov:wasGeneratedBy on the resource subject with no special case", async () => {
        const target = join(dir, "idx.md");
        const url = "https://pod.example/vault/wiki/concepts/index.md";
        const existing = [
            `<${url}> <${PROV_GEN_BY}> <https://pod.example/vault/meta/views/container-index> .`,
            `<${url}.meta> <${PROV_GEN_BY}> <urn:stale-affordance> .`,
        ].join("\n");
        writeFileSync(`${target}.meta`, existing);

        const oldProjected = [quad(
            namedNode(`${url}.meta`),
            namedNode(PROV_GEN_BY),
            namedNode("urn:stale-affordance"),
        )];
        const newProjected = [quad(
            namedNode(`${url}.meta`),
            namedNode(PROV_GEN_BY),
            namedNode("https://pod.example/meta/affordances/markdown-projection"),
        )];
        await writer.replaceProjected(target, newProjected, oldProjected, { resourceUrl: url });

        const out = readMeta(target);
        const onResource = out.getQuads(namedNode(url), namedNode(PROV_GEN_BY), null, null);
        expect(onResource).toHaveLength(1);
        expect(onResource[0].object.value)
            .toBe("https://pod.example/vault/meta/views/container-index");
        const onMetaDoc = out.getQuads(namedNode(`${url}.meta`), namedNode(PROV_GEN_BY), null, null);
        expect(onMetaDoc).toHaveLength(1);
        expect(onMetaDoc[0].object.value)
            .toBe("https://pod.example/meta/affordances/markdown-projection");
    });

    // Relative IRIs in the snapshot — CSS-style relative subjects (<idx.md>) and
    // PATCH-inserted self-references (<>) — must resolve against the .meta URL
    // exactly as readExisting does (same parse helper), survive subtraction, and
    // re-serialize as the correct absolute IRIs.
    it("relative-IRI snapshot round-trips through subtraction without corruption", async () => {
        const target = join(dir, "rel.md");
        const url = "https://pod.example/vault/wiki/concepts/rel.md";
        const snapshotTtl = [
            `<> <urn:selfRef> "on the meta doc" .`,
            `<rel.md> <urn:agentOwned> "on the resource" .`,
            `<rel.md> <urn:title> "Old" .`,
        ].join("\n");

        // oldProjected uses the ABSOLUTE resource IRI — subtraction only works
        // if the snapshot's <rel.md> resolved to the same absolute IRI.
        const oldProjected = [quad(namedNode(url), namedNode("urn:title"), literal("Old"))];
        const newProjected = [quad(namedNode(url), namedNode("urn:title"), literal("New"))];
        await writer.replaceProjected(target, newProjected, oldProjected, { resourceUrl: url, snapshotTtl });

        const out = readMeta(target);
        // <> resolved to the .meta URL.
        expect(out.getQuads(namedNode(`${url}.meta`), namedNode("urn:selfRef"), null, null)).toHaveLength(1);
        // <rel.md> resolved to the resource URL.
        expect(out.getQuads(namedNode(url), namedNode("urn:agentOwned"), null, null)).toHaveLength(1);
        // Subtraction matched across the resolution boundary.
        const titles = out.getQuads(namedNode(url), namedNode("urn:title"), null, null);
        expect(titles).toHaveLength(1);
        expect(titles[0].object.value).toBe("New");
    });
});
