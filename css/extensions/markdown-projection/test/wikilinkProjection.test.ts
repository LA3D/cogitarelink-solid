import { describe, it, expect } from "vitest";
import { DataFactory } from "n3";
import { projectWikilink, projectWikilinks, HINT_TO_PROJECTION } from "../src/wikilinkProjection.js";

const { namedNode } = DataFactory;

describe("HINT_TO_PROJECTION (D98 subject routing)", () => {
    it("routes 'related' to THING subject + skos:related predicate", () => {
        expect(HINT_TO_PROJECTION.related.subject).toBe("THING");
        expect(HINT_TO_PROJECTION.related.predicate.value).toBe(
            "http://www.w3.org/2004/02/skos/core#related",
        );
    });

    it("routes 'embed' to PAGE subject + wiki:embeds predicate", () => {
        expect(HINT_TO_PROJECTION.embed.subject).toBe("PAGE");
        expect(HINT_TO_PROJECTION.embed.predicate.value).toBe(
            "https://pod.vardeman.me/vault/ontology/wiki#embeds",
        );
    });

    it("routes 'attendee' to THING + schema:attendee", () => {
        expect(HINT_TO_PROJECTION.attendee.subject).toBe("THING");
        expect(HINT_TO_PROJECTION.attendee.predicate.value).toBe(
            "https://schema.org/attendee",
        );
    });
});

describe("projectWikilink (D98 #this resolution)", () => {
    const pageIRI = namedNode("https://pod.example/wiki/concepts/foo.md");
    const thingIRI = namedNode("https://pod.example/wiki/concepts/foo.md#this");

    it("THING-scoped hint produces <#this> subject + <target#this> object", () => {
        const quads = projectWikilink({
            pageIRI,
            thingIRI,
            hint: "related",
            targetPageURL: "https://pod.example/wiki/concepts/bar.md",
        });
        expect(quads).toHaveLength(1);
        expect(quads[0].subject.value).toBe(thingIRI.value);
        expect(quads[0].predicate.value).toBe(
            "http://www.w3.org/2004/02/skos/core#related",
        );
        expect(quads[0].object.value).toBe(
            "https://pod.example/wiki/concepts/bar.md#this",
        );
    });

    it("PAGE-scoped hint (embed) produces <> subject", () => {
        const quads = projectWikilink({
            pageIRI,
            thingIRI,
            hint: "embed",
            targetPageURL: "https://pod.example/wiki/concepts/img.png",
        });
        expect(quads).toHaveLength(1);
        expect(quads[0].subject.value).toBe(pageIRI.value);
        expect(quads[0].object.value).toBe(
            "https://pod.example/wiki/concepts/img.png",
        );
    });

    it("unknown hint returns empty array", () => {
        const quads = projectWikilink({
            pageIRI,
            thingIRI,
            hint: "unknownHint",
            targetPageURL: "https://pod.example/wiki/concepts/bar.md",
        });
        expect(quads).toHaveLength(0);
    });
});

describe("projectWikilinks (pipeline compat — D98 #this subjects/objects)", () => {
    const baseUri = "http://localhost:3000/wiki/concepts/wiki-memory-l3-profile.md";
    const thingUri = baseUri + "#this";

    it("projects [[Title]]{.broader} to skos:broader with #this subject and #this object", () => {
        const body = "Body with [[Agentic Memory Systems MOC]]{.broader} reference.";
        const triples = projectWikilinks(body, baseUri);
        const t = triples.find(t => t.predicate.value === "http://www.w3.org/2004/02/skos/core#broader");
        expect(t).toBeDefined();
        expect(t?.subject.value).toBe(thingUri);
        expect(t?.object.value).toBe("http://localhost:3000/wiki/concepts/agentic-memory-systems-moc.md#this");
    });

    it("projects [[@citekey]] to dct:references with #this subject and #this object", () => {
        const body = "Cites [[@karpathy-2026-llm-wiki]].";
        const triples = projectWikilinks(body, baseUri);
        const t = triples.find(t => t.predicate.value === "http://purl.org/dc/terms/references");
        expect(t).toBeDefined();
        expect(t?.subject.value).toBe(thingUri);
        // D106: citekey no longer special-routes to /sources/ (retired post-D98);
        // a citation source is a concept (wiki:Source ⊑ skos:Concept) → content container.
        expect(t?.object.value).toBe("http://localhost:3000/wiki/concepts/karpathy-2026-llm-wiki.md#this");
    });

    it("projects [[name]]{.author} to dct:contributor with #this subject and #this object", () => {
        const body = "Author: [[karpathy-andrej]]{.author}.";
        const triples = projectWikilinks(body, baseUri);
        const t = triples.find(t => t.predicate.value === "http://purl.org/dc/terms/contributor");
        expect(t).toBeDefined();
        expect(t?.subject.value).toBe(thingUri);
        expect(t?.object.value).toBe("http://localhost:3000/wiki/people/karpathy-andrej.md#this");
    });

    it("falls back to skos:related for bare [[Foo]] wikilinks with #this subject and #this object", () => {
        const body = "See [[Some Other Page]] for details.";
        const triples = projectWikilinks(body, baseUri);
        const t = triples.find(t => t.predicate.value === "http://www.w3.org/2004/02/skos/core#related");
        expect(t).toBeDefined();
        expect(t?.subject.value).toBe(thingUri);
        expect(t?.object.value).toContain("#this");
    });
});
