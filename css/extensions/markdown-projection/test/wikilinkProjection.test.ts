import { describe, it, expect } from "vitest";
import { DataFactory } from "n3";
import {
    projectWikilink, projectWikilinks, HINT_TO_PROJECTION,
    BOOTSTRAP_PREDICATE_TO_CLASS, classToContainerSegment,
} from "../src/wikilinkProjection.js";

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

describe("BOOTSTRAP_PREDICATE_TO_CLASS (D106 minimal kernel)", () => {
    it("affiliation→Organization, location→Place, contributor→Person", () => {
        expect(BOOTSTRAP_PREDICATE_TO_CLASS["https://schema.org/affiliation"]).toBe("https://schema.org/Organization");
        expect(BOOTSTRAP_PREDICATE_TO_CLASS["https://schema.org/location"]).toBe("https://schema.org/Place");
        expect(BOOTSTRAP_PREDICATE_TO_CLASS["http://purl.org/dc/terms/contributor"]).toBe("https://schema.org/Person");
    });
    it("does not entail a class for skos:related", () => {
        expect(BOOTSTRAP_PREDICATE_TO_CLASS["http://www.w3.org/2004/02/skos/core#related"]).toBeUndefined();
    });
});

describe("classToContainerSegment (inverts container→class Type Index)", () => {
    const typeIndex = {
        "/vault/wiki/concepts/":      "http://www.w3.org/2004/02/skos/core#Concept",
        "/vault/wiki/organizations/": "https://schema.org/Organization",
    };
    it("maps schema:Organization → 'organizations'", () => {
        expect(classToContainerSegment("https://schema.org/Organization", typeIndex)).toBe("organizations");
    });
    it("returns undefined for an unregistered class", () => {
        expect(classToContainerSegment("https://schema.org/Event", typeIndex)).toBeUndefined();
    });
});

describe("projectWikilinks container routing (D106)", () => {
    const typeIndex = {
        "/vault/wiki/concepts/":      "http://www.w3.org/2004/02/skos/core#Concept",
        "/vault/wiki/people/":        "https://schema.org/Person",
        "/vault/wiki/organizations/": "https://schema.org/Organization",
        "/vault/wiki/places/":        "https://schema.org/Place",
    };
    const base = "https://pod.example/wiki/concepts/foo.md";
    const routing = BOOTSTRAP_PREDICATE_TO_CLASS;

    it("routes {.affiliation} into organizations/", () => {
        const q = projectWikilinks("[[Notre Dame]]{.affiliation}", base, typeIndex, routing);
        expect(q[0].object.value).toBe("https://pod.example/wiki/organizations/notre-dame.md#this");
    });
    it("routes {.location} into places/", () => {
        const q = projectWikilinks("[[South Bend]]{.location}", base, typeIndex, routing);
        expect(q[0].object.value).toBe("https://pod.example/wiki/places/south-bend.md#this");
    });
    it("defaults unentailed {.related} to concepts/", () => {
        const q = projectWikilinks("[[Context Graphs]]{.related}", base, typeIndex, routing);
        expect(q[0].object.value).toBe("https://pod.example/wiki/concepts/context-graphs.md#this");
    });
    it("falls back to concepts/ when entailed class is not Type-Index-registered", () => {
        const q = projectWikilinks("[[Some Org]]{.affiliation}", base, {}, routing);
        expect(q[0].object.value).toBe("https://pod.example/wiki/concepts/some-org.md#this");
    });
    it("honors a runtime-extended routing map (Pod doc adds an entailment)", () => {
        const extended = { ...routing, "https://schema.org/about": "https://schema.org/Place" };
        const q = projectWikilinks("[[Somewhere]]{.about}", base, typeIndex, extended);
        expect(q[0].object.value).toBe("https://pod.example/wiki/places/somewhere.md#this");
    });
});

// R4: target IRIs are minted under the threaded wikiRoot (config-derived storage
// base), NOT recovered by splitting baseUri on a literal /wiki/.
describe("projectWikilinks wikiRoot threading (R4 / D107)", () => {
    const routing = BOOTSTRAP_PREDICATE_TO_CLASS;
    const typeIndex = {
        "/store/wiki/concepts/": "http://www.w3.org/2004/02/skos/core#Concept",
        "/store/wiki/organizations/": "https://schema.org/Organization",
    };

    it("mints targets under the injected wikiRoot regardless of baseUri layout", () => {
        // baseUri deliberately has NO /wiki/ split point; wikiRoot supplies the root.
        const base = "https://pod.example/store/wiki/concepts/foo.md";
        const q = projectWikilinks("[[Notre Dame]]{.affiliation}", base, typeIndex, routing, "https://pod.example/store");
        expect(q[0].object.value).toBe("https://pod.example/store/wiki/organizations/notre-dame.md#this");
    });

    it("tolerates a trailing slash on wikiRoot", () => {
        const base = "https://pod.example/store/wiki/concepts/foo.md";
        const q = projectWikilinks("[[Context Graphs]]{.related}", base, typeIndex, routing, "https://pod.example/store/");
        expect(q[0].object.value).toBe("https://pod.example/store/wiki/concepts/context-graphs.md#this");
    });

    it("falls back to baseUri-split when wikiRoot is omitted (back-compat)", () => {
        const base = "https://pod.example/store/wiki/concepts/foo.md";
        const q = projectWikilinks("[[Context Graphs]]{.related}", base, typeIndex, routing);
        expect(q[0].object.value).toBe("https://pod.example/store/wiki/concepts/context-graphs.md#this");
    });
});
