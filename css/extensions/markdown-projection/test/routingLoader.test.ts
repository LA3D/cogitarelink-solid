import { describe, it, expect } from "vitest";
import { parseRoutingDoc, loadRoutingMap } from "../src/routingLoader.js";

describe("loadRoutingMap URL construction", () => {
    it("fetches <podBase>/meta/routing.jsonld", async () => {
        let calledUrl = "";
        const fakeFetch = (async (url: string) => {
            calledUrl = url;
            return { ok: false } as Response; // force bootstrap fallback; we only assert the URL
        }) as unknown as typeof fetch;
        const bootstrap = { "p": "c" };
        const out = await loadRoutingMap("https://pod.example/vault", fakeFetch, bootstrap);
        expect(calledUrl).toBe("https://pod.example/vault/meta/routing.jsonld");
        expect(out).toBe(bootstrap); // non-OK → bootstrap fallback
    });
});

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
