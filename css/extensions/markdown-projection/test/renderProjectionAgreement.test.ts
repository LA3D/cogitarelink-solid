// Dual-view identity agreement (audit R1.1 / P5).
//
// The core claim of this substrate is "document view and graph view agree"
// (Verborgh, D109). For a [[wikilink]] that means: the <a href> the RENDER path
// mints (HardcodedResolver → targetUrlFor) must identify the SAME resource as
// the .meta edge the PROJECTION path mints (projectionPipeline → wikilinkProjection
// → targetUrlFor). Before R-T2 they diverged (render: stale /vault/resources/
// concepts/<slug>.md; projection: /vault/wiki/<container>/<slug>.md).
//
// This test runs the REAL projection pipeline (NOT a mock) on a body containing
// each golden-vector wikilink, extracts the projected edge's object IRI, strips
// the THING-scoped "#this" fragment (a graph-view concern layered on the base
// resource URL), and asserts it equals HardcodedResolver.resolve(title, hint).
import { describe, it, expect } from "vitest";
import { projectionPipeline } from "../src/projectionPipeline.js";
import { HardcodedResolver } from "../../shared/markdown-parsing/src/resolver.js";

// Both views are pinned to the same storage root: render gets base+storagePath
// explicitly; projection gets storageBase as the wikiRoot arg.
const POD_BASE = "https://pod.vardeman.me";
const STORAGE_PATH = "/vault";
const STORAGE_BASE = `${POD_BASE}${STORAGE_PATH}`;
// The page that contains the wikilinks. Its container is irrelevant to the
// minted TARGET URL (the target is routed by the link's own hint), but it must
// be a governed path so the pipeline runs the wikilink projection.
const PAGE_URI = `${STORAGE_BASE}/wiki/concepts/host-page.md`;

// (title, classHint) golden vectors. Covers: default container (source/related/
// no-hint/citekey), the three hints whose bootstrap entailment deviates from
// concepts (author→people, affiliation→organizations, location→places), and the
// slug edge cases (citekey @-strip, folder prefix, heading anchor, ampersand).
const VECTORS: Array<{ title: string; hint?: string }> = [
    { title: "Context Graphs" },                          // no hint → concepts
    { title: "Context Graphs", hint: "related" },          // skos:related → concepts
    { title: "Progressive Disclosure", hint: "extends" },  // cito:extends → concepts
    { title: "Zhang 2025 RLM", hint: "source" },           // dct:source → concepts
    { title: "Jane Researcher", hint: "author" },          // → people
    { title: "Notre Dame", hint: "affiliation" },          // → organizations
    { title: "South Bend", hint: "location" },             // → places
    { title: "@zhang-2025-rlm" },                          // citekey @-strip → concepts
    { title: "@hu-2026-beyond-rag", hint: "cites" },       // cito:cites + @-strip
    { title: "External Resources/Husain Evals", hint: "source" }, // folder prefix
    { title: "Judge Memory#Multi-Hop", hint: "related" },  // heading anchor
    { title: "Research & Scholarship" },                   // ampersand slug
];

// THING-scoped edges append "#this" to the object IRI; PAGE-scoped (embed) do
// not. Strip the fragment to recover the bare resource URL the render href uses.
function stripThis(iri: string): string {
    return iri.endsWith("#this") ? iri.slice(0, -"#this".length) : iri;
}

describe("render ≡ projection URL minting (dual-view identity, R1.1)", () => {
    const resolver = new HardcodedResolver(POD_BASE, STORAGE_PATH);

    for (const { title, hint } of VECTORS) {
        const label = hint ? `[[${title}]]{.${hint}}` : `[[${title}]]`;
        it(`render href ≡ projected edge IRI for ${label}`, async () => {
            // Render path: the <a href> the document view mints.
            const renderHref = resolver.resolve(title, hint);

            // Projection path: run the REAL pipeline on a body containing the
            // wikilink, pinned to the same storage root.
            const body = `# Host Page\n\nSee ${label} here.\n`;
            const quads = await projectionPipeline.run(
                PAGE_URI,
                body,
                undefined,   // typeIndex → DEFAULT (no live index, same as render)
                undefined,   // predicateToClass → BOOTSTRAP (same entailment render's defaults flatten)
                undefined,   // literalBinding default
                STORAGE_BASE,
            );

            // Find the wikilink edge: its object IRI ends with the slug.md (the
            // host page's own substrate-invariant/derived triples don't).
            const slugMd = renderHref.slice(renderHref.lastIndexOf("/") + 1); // "<slug>.md"
            const edge = quads.find(
                (q) => q.object.termType === "NamedNode" &&
                    stripThis(q.object.value).endsWith(`/${slugMd}`) &&
                    q.object.value !== PAGE_URI,
            );
            expect(edge, `no projected wikilink edge for ${label}`).toBeDefined();

            const projectedTarget = stripThis(edge!.object.value);
            expect(projectedTarget).toBe(renderHref);
        });
    }

    it("the stale pre-D98 /vault/resources/concepts/ path is gone", () => {
        const href = resolver.resolve("Context Graphs");
        expect(href).not.toContain("/resources/concepts/");
        expect(href).toBe(`${STORAGE_BASE}/wiki/concepts/context-graphs.md`);
    });
});
