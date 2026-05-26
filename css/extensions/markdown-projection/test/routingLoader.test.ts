import { describe, it, expect } from "vitest";
import { parseRoutingDoc } from "../src/routingLoader.js";

describe("parseRoutingDoc (JSON-LD → predicate→class map, CURIE-expanded)", () => {
    const doc = {
        "@context": {
            "wiki": "https://pod.vardeman.me/vault/ontology/wiki#",
            "schema": "https://schema.org/",
            "dct": "http://purl.org/dc/terms/",
            "routesToClass": { "@id": "wiki:routesToClass", "@type": "@id" },
        },
        "@graph": [
            { "@id": "schema:affiliation", "routesToClass": "schema:Organization" },
            { "@id": "dct:contributor", "routesToClass": "schema:Person" },
        ],
    };
    it("expands CURIEs to full IRIs", () => {
        const map = parseRoutingDoc(doc);
        expect(map["https://schema.org/affiliation"]).toBe("https://schema.org/Organization");
        expect(map["http://purl.org/dc/terms/contributor"]).toBe("https://schema.org/Person");
    });
    it("returns empty map for a malformed doc", () => {
        expect(parseRoutingDoc({} as any)).toEqual({});
    });
});
