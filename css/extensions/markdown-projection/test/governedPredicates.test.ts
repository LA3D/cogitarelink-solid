import { describe, it, expect } from "vitest";
import { governedPredicates, GOVERNED_FOR } from "../src/governedPredicates.js";
import {
    PAGE_GOVERNED_PREDICATES,
    THING_GOVERNED_PREDICATES,
    getThingGovernedPredicates,
} from "../src/governedPredicates.js";

describe("governedPredicates (legacy API — backward compat)", () => {
    it("returns ConceptShape governed set for wiki:Concept", () => {
        const set = governedPredicates("https://pod.vardeman.me/vault/ontology/wiki#Concept");
        expect(set).toContain("http://purl.org/dc/terms/title");
        expect(set).toContain("http://www.w3.org/2004/02/skos/core#broader");
        expect(set).toContain("http://purl.org/spar/cito/extends");
        expect(set).toContain("http://www.w3.org/ns/prov#wasGeneratedBy");
        expect(set).not.toContain("http://example.com/notgoverned");
    });

    it("returns PersonShape governed set for wiki:Person", () => {
        const set = governedPredicates("https://pod.vardeman.me/vault/ontology/wiki#Person");
        expect(set).toContain("http://xmlns.com/foaf/0.1/nick");
        expect(set).not.toContain("http://www.w3.org/2004/02/skos/core#broader");
    });

    it("returns SourceShape governed set for wiki:Source", () => {
        const set = governedPredicates("https://pod.vardeman.me/vault/ontology/wiki#Source");
        expect(set).toContain("http://purl.org/dc/terms/creator");
        expect(set).toContain("http://purl.org/dc/terms/identifier");
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
