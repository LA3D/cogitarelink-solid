import { describe, it, expect } from "vitest";
import { governedPredicates, GOVERNED_FOR } from "../src/governedPredicates.js";

describe("governedPredicates", () => {
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
