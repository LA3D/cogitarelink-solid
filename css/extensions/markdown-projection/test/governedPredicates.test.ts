import { describe, it, expect } from "vitest";
import {
    PAGE_GOVERNED_PREDICATES,
    THING_GOVERNED_PREDICATES,
    getThingGovernedPredicates,
    resolveGovernedForWikiClass,
} from "../src/governedPredicates.js";

describe("resolveGovernedForWikiClass (D81 Model A + D98 two-subject)", () => {
    it("returns page predicates including dct:title for wiki:Concept", () => {
        const { page } = resolveGovernedForWikiClass(
            "https://pod.vardeman.me/vault/ontology/wiki#Concept",
        );
        expect(page).toContain("http://purl.org/dc/terms/title");
        expect(page).toContain("http://www.w3.org/ns/prov#wasGeneratedBy");
    });

    it("returns thing predicates including SKOS terms for wiki:Concept", () => {
        const { thing } = resolveGovernedForWikiClass(
            "https://pod.vardeman.me/vault/ontology/wiki#Concept",
        );
        expect(thing).toContain("http://www.w3.org/2004/02/skos/core#broader");
        expect(thing).toContain("http://purl.org/spar/cito/extends");
    });

    it("returns person-specific thing predicates for wiki:Person", () => {
        const { thing } = resolveGovernedForWikiClass(
            "https://pod.vardeman.me/vault/ontology/wiki#Person",
        );
        expect(thing).toContain("http://xmlns.com/foaf/0.1/nick");
        expect(thing).not.toContain("http://www.w3.org/2004/02/skos/core#broader");
    });

    it("page predicates do NOT include Thing-level predicates", () => {
        const { page } = resolveGovernedForWikiClass(
            "https://pod.vardeman.me/vault/ontology/wiki#Concept",
        );
        expect(page).not.toContain("http://www.w3.org/2004/02/skos/core#prefLabel");
        expect(page).not.toContain("https://schema.org/name");
    });

    it("falls back to common thing predicates for unknown wiki: class", () => {
        const { thing } = resolveGovernedForWikiClass(
            "https://pod.vardeman.me/vault/ontology/wiki#Unknown",
        );
        expect(thing).toContain("https://schema.org/name");
        expect(thing).toContain("https://schema.org/mainEntityOfPage");
    });
});

describe("PAGE_GOVERNED_PREDICATES", () => {
    it("includes page-level predicates", () => {
        const iris = PAGE_GOVERNED_PREDICATES.map((p) => p.value);
        expect(iris).toContain("http://purl.org/dc/terms/title");
        expect(iris).toContain("https://schema.org/mainEntity");
        expect(iris).toContain("https://pod.vardeman.me/vault/ontology/wiki#maturity");
    });

    it("does NOT include Thing-level predicates", () => {
        const iris = PAGE_GOVERNED_PREDICATES.map((p) => p.value);
        expect(iris).not.toContain("http://www.w3.org/2004/02/skos/core#prefLabel");
        expect(iris).not.toContain("https://schema.org/name");
    });
});

describe("THING_GOVERNED_PREDICATES (per Thing class)", () => {
    it("Concept class includes SKOS + CITO predicates", () => {
        const skosConcept = "http://www.w3.org/2004/02/skos/core#Concept";
        const preds = THING_GOVERNED_PREDICATES[skosConcept] || [];
        const iris = preds.map((p) => p.value);
        expect(iris).toContain("http://www.w3.org/2004/02/skos/core#prefLabel");
        expect(iris).toContain("http://purl.org/spar/cito/extends");
    });

    it("Event class includes startDate + attendee", () => {
        const schemaEvent = "https://schema.org/Event";
        const preds = THING_GOVERNED_PREDICATES[schemaEvent] || [];
        const iris = preds.map((p) => p.value);
        expect(iris).toContain("https://schema.org/startDate");
        expect(iris).toContain("https://schema.org/attendee");
    });

    it("all Thing classes inherit common Thing predicates (name, mainEntityOfPage)", () => {
        for (const cls of Object.keys(THING_GOVERNED_PREDICATES)) {
            const iris = THING_GOVERNED_PREDICATES[cls].map((p) => p.value);
            expect(iris).toContain("https://schema.org/name");
            expect(iris).toContain("https://schema.org/mainEntityOfPage");
        }
    });

    it("getThingGovernedPredicates returns common set for unknown class (L4 fallback)", () => {
        const preds = getThingGovernedPredicates("https://chuck.example/biz/Equipment");
        const iris = preds.map((p) => p.value);
        expect(iris).toContain("https://schema.org/name");
        expect(iris).toContain("https://schema.org/mainEntityOfPage");
        // Should NOT contain class-specific predicates
        expect(iris).not.toContain("https://schema.org/startDate");
    });
});
