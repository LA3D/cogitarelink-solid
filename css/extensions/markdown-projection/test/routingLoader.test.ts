import { describe, it, expect, vi } from "vitest";
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

    it("Fix3: emits console.error on non-OK response", async () => {
        const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const fakeFetch = (async () =>
            ({ ok: false, status: 404 } as Response)
        ) as unknown as typeof fetch;
        const bootstrap = { "p": "c" };
        const out = await loadRoutingMap("https://pod.example/vault", fakeFetch, bootstrap);
        expect(out).toBe(bootstrap);
        expect(errSpy).toHaveBeenCalled();
        errSpy.mockRestore();
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

    // Fix 5 (audit R6): object-form context terms ({"@id": "..."}) must expand
    // identically to plain-string terms. Previously they were silently dropped,
    // so predicates using object-form entries (e.g. routesToClass itself) fell
    // back to the bootstrap kernel without warning.
    it("expands object-form context terms (@id) identically to string terms", () => {
        const mixed = {
            "@context": {
                "wiki": "https://pod.vardeman.me/vault/ontology/wiki#",
                "schema": "https://schema.org/",
                // object-form: only @id matters for prefix collection
                "routesToClass": { "@id": "wiki:routesToClass", "@type": "@id" },
                // another object-form prefix (unusual but valid JSON-LD)
                "ex": { "@id": "https://example.org/", "@type": "@id" },
            },
            "@graph": [
                // @id expands using string prefix "schema" → string form
                { "@id": "schema:name", "routesToClass": "wiki:Concept" },
                // @id expands using object-form prefix "ex"
                { "@id": "ex:custom", "routesToClass": "wiki:Source" },
            ],
        };
        const map = parseRoutingDoc(mixed);
        expect(map["https://schema.org/name"]).toBe("https://pod.vardeman.me/vault/ontology/wiki#Concept");
        expect(map["https://example.org/custom"]).toBe("https://pod.vardeman.me/vault/ontology/wiki#Source");
    });
});
