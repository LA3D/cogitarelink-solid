import { describe, it, expect } from "vitest";
import { projectWikilinks } from "../src/wikilinkProjection.js";

describe("projectWikilinks", () => {
    const baseUri = "http://localhost:3000/wiki/pages/wiki-memory-l3-profile.md";

    it("projects [[Title]]{.broader} to skos:broader", () => {
        const body = "Body with [[Agentic Memory Systems MOC]]{.broader} reference.";
        const triples = projectWikilinks(body, baseUri);
        const t = triples.find(t => t.predicate.value === "http://www.w3.org/2004/02/skos/core#broader");
        expect(t).toBeDefined();
        expect(t?.object.value).toBe("http://localhost:3000/wiki/pages/agentic-memory-systems-moc.md");
    });

    it("projects [[@citekey]] to dct:references with /wiki/sources/ container", () => {
        const body = "Cites [[@karpathy-2026-llm-wiki]].";
        const triples = projectWikilinks(body, baseUri);
        const t = triples.find(t => t.predicate.value === "http://purl.org/dc/terms/references");
        expect(t).toBeDefined();
        expect(t?.object.value).toBe("http://localhost:3000/wiki/sources/karpathy-2026-llm-wiki.md");
    });

    it("projects [[name]]{.author} to dct:contributor with /wiki/people/ container", () => {
        const body = "Author: [[karpathy-andrej]]{.author}.";
        const triples = projectWikilinks(body, baseUri);
        const t = triples.find(t => t.predicate.value === "http://purl.org/dc/terms/contributor");
        expect(t).toBeDefined();
        expect(t?.object.value).toBe("http://localhost:3000/wiki/people/karpathy-andrej.md");
    });

    it("falls back to skos:related for bare [[Foo]] wikilinks", () => {
        const body = "See [[Some Other Page]] for details.";
        const triples = projectWikilinks(body, baseUri);
        const t = triples.find(t => t.predicate.value === "http://www.w3.org/2004/02/skos/core#related");
        expect(t).toBeDefined();
    });
});
