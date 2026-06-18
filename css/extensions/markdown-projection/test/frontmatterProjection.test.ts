import { describe, it, expect } from "vitest";
import { projectFrontmatter, resolveCURIE, resolveFrontmatterType } from "../src/frontmatterProjection.js";

describe("projectFrontmatter", () => {
    it("projects type to rdf:type with class IRI", () => {
        const triples = projectFrontmatter({
            type: "concept",
            created: "2026-05-15T00:00:00Z",
            modified: "2026-05-15T00:00:00Z",
        });
        const typeT = triples.find(t => t.predicate.value === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
        expect(typeT?.object.value).toBe("https://pod.vardeman.me/vault/ontology/wiki#Concept");
    });

    it("projects created and modified as xsd:dateTime literals", () => {
        const triples = projectFrontmatter({
            type: "concept",
            created: "2026-05-15T00:00:00Z",
            modified: "2026-05-15T00:00:00Z",
        });
        const createdT = triples.find(t => t.predicate.value === "http://purl.org/dc/terms/created");
        expect(createdT?.object.value).toBe("2026-05-15T00:00:00Z");
        expect((createdT?.object as any).datatype.value).toBe("http://www.w3.org/2001/XMLSchema#dateTime");
    });

    it("projects aliases to multiple foaf:nick triples", () => {
        const triples = projectFrontmatter({
            type: "person",
            created: "2026-04-01T00:00:00Z",
            modified: "2026-05-15T00:00:00Z",
            aliases: ["karpathy", "Andrej Karpathy", "@karpathy"],
        });
        const nicks = triples.filter(t => t.predicate.value === "http://xmlns.com/foaf/0.1/nick");
        expect(nicks).toHaveLength(3);
    });

    it("projects identifier or citekey to dct:identifier", () => {
        const t1 = projectFrontmatter({ type: "source", created: "...", modified: "...", identifier: "https://x.com" });
        const t2 = projectFrontmatter({ type: "source", created: "...", modified: "...", citekey: "smith-2026-foo" });
        const id1 = t1.find(t => t.predicate.value === "http://purl.org/dc/terms/identifier")?.object as any;
        const id2 = t2.find(t => t.predicate.value === "http://purl.org/dc/terms/identifier")?.object as any;
        // absolute IRI form → plain literal, unchanged (xsd:string default)
        expect(id1.value).toBe("https://x.com");
        expect(id1.datatype.value).toBe("http://www.w3.org/2001/XMLSchema#string");
        // citekey: field stays plain/untyped (typing local citekeys is curation-loop work)
        expect(id2.value).toBe("smith-2026-foo");
        expect(id2.datatype.value).toBe("http://www.w3.org/2001/XMLSchema#string");
    });

    // D111 §6.2 — compact-identifier convention (identifiers.org form)
    it("types a registered compact identifier, stripping the prefix (doi:)", () => {
        const triples = projectFrontmatter({ type: "source", identifier: "doi:10.1234/x" });
        const id = triples.find(t => t.predicate.value === "http://purl.org/dc/terms/identifier")?.object as any;
        expect(id.value).toBe("10.1234/x");
        expect(id.datatype.value).toBe("https://pod.vardeman.me/id/schemes/#doi");
    });

    it("keeps the FULL lexical form for did: (scheme regex anchors on did:)", () => {
        const triples = projectFrontmatter({ type: "person", identifier: "did:web:pod.vardeman.me" });
        const id = triples.find(t => t.predicate.value === "http://purl.org/dc/terms/identifier")?.object as any;
        expect(id.value).toBe("did:web:pod.vardeman.me");
        expect(id.datatype.value).toBe("https://pod.vardeman.me/id/schemes/#did");
    });

    it("leaves an unknown prefix as a plain literal of the whole string (suggestive typing, never reject)", () => {
        const triples = projectFrontmatter({ type: "source", identifier: "isbn:978-3" });
        const id = triples.find(t => t.predicate.value === "http://purl.org/dc/terms/identifier")?.object as any;
        expect(id.value).toBe("isbn:978-3");
        expect(id.datatype.value).toBe("http://www.w3.org/2001/XMLSchema#string");
    });

    it("projects maturity as the wiki: IRI, not a string literal (PageShape sh:in)", () => {
        const triples = projectFrontmatter({ type: "concept", maturity: "draft" });
        const m = triples.find(t => t.predicate.value === "https://pod.vardeman.me/vault/ontology/wiki#maturity");
        expect(m?.object.termType).toBe("NamedNode");
        expect(m?.object.value).toBe("https://pod.vardeman.me/vault/ontology/wiki#draft");
    });

    it("drops an unrecognized maturity value (no triple, never an invalid literal)", () => {
        const triples = projectFrontmatter({ type: "concept", maturity: "bogus" });
        const m = triples.find(t => t.predicate.value === "https://pod.vardeman.me/vault/ontology/wiki#maturity");
        expect(m).toBeUndefined();
    });

    it("projects rationale to a mem:rationale string literal", () => {
        const triples = projectFrontmatter({
            type: "concept",
            rationale: "Crystallized to document the two-hierarchy rule; concluded the axes are distinct.",
        });
        const r = triples.find(t => t.predicate.value === "https://pod.vardeman.me/vault/ontology/mem#rationale");
        expect(r).toBeDefined();
        expect(r?.object.termType).toBe("Literal");
        expect(r?.object.value).toBe("Crystallized to document the two-hierarchy rule; concluded the axes are distinct.");
        expect((r?.object as any).datatype.value).toBe("http://www.w3.org/2001/XMLSchema#string");
    });

    it("omits mem:rationale when rationale is absent", () => {
        const triples = projectFrontmatter({ type: "concept" });
        expect(triples.find(t => t.predicate.value.endsWith("mem#rationale"))).toBeUndefined();
    });

    it("ignores unknown frontmatter keys", () => {
        const triples = projectFrontmatter({
            type: "concept",
            created: "2026-05-15T00:00:00Z",
            modified: "2026-05-15T00:00:00Z",
            up: "[[Some MOC]]",
            customField: "anything",
        });
        const up = triples.find(t => t.predicate.value.endsWith("up"));
        expect(up).toBeUndefined();
    });
});

// A.1: CURIE resolution tests
describe("resolveCURIE", () => {
    it("resolves skos: CURIE to full IRI", () => {
        expect(resolveCURIE("skos:Concept"))
            .toBe("http://www.w3.org/2004/02/skos/core#Concept");
    });

    it("resolves schema: CURIE to full IRI", () => {
        expect(resolveCURIE("schema:Person")).toBe("https://schema.org/Person");
        expect(resolveCURIE("schema:Place")).toBe("https://schema.org/Place");
        expect(resolveCURIE("schema:Event")).toBe("https://schema.org/Event");
        expect(resolveCURIE("schema:Organization")).toBe("https://schema.org/Organization");
        expect(resolveCURIE("schema:HowTo")).toBe("https://schema.org/HowTo");
    });

    it("resolves foaf: CURIE to full IRI", () => {
        expect(resolveCURIE("foaf:Person")).toBe("http://xmlns.com/foaf/0.1/Person");
    });

    it("resolves wiki: CURIE to full IRI", () => {
        expect(resolveCURIE("wiki:Concept"))
            .toBe("https://pod.vardeman.me/vault/ontology/wiki#Concept");
    });

    it("passes absolute IRIs through unchanged", () => {
        expect(resolveCURIE("https://chuck.example/biz/Equipment"))
            .toBe("https://chuck.example/biz/Equipment");
        expect(resolveCURIE("http://www.w3.org/2004/02/skos/core#Concept"))
            .toBe("http://www.w3.org/2004/02/skos/core#Concept");
    });

    it("returns undefined for unknown short-form vault types", () => {
        expect(resolveCURIE("concept")).toBeUndefined();
        expect(resolveCURIE("person")).toBeUndefined();
        expect(resolveCURIE("source")).toBeUndefined();
    });
});

// C-T2c: the single resolver shared by the page-type projection and the
// pipeline's Thing-class resolution.
describe("resolveFrontmatterType", () => {
    it("resolves short-form vault tokens to the wiki: dispatch class", () => {
        expect(resolveFrontmatterType("source")).toBe("https://pod.vardeman.me/vault/ontology/wiki#Source");
        expect(resolveFrontmatterType("concept")).toBe("https://pod.vardeman.me/vault/ontology/wiki#Concept");
        expect(resolveFrontmatterType("person")).toBe("https://pod.vardeman.me/vault/ontology/wiki#Person");
    });

    it("resolves CURIE / absolute types directly (not via TYPE_MAP)", () => {
        expect(resolveFrontmatterType("skos:Concept")).toBe("http://www.w3.org/2004/02/skos/core#Concept");
        expect(resolveFrontmatterType("https://chuck.example/biz/Equipment")).toBe("https://chuck.example/biz/Equipment");
    });

    it("returns undefined for an unrecognized token or non-string", () => {
        expect(resolveFrontmatterType("not-a-type")).toBeUndefined();
        expect(resolveFrontmatterType(undefined)).toBeUndefined();
        expect(resolveFrontmatterType(42)).toBeUndefined();
    });
});

describe("projectFrontmatter — CURIE type support (A.1)", () => {
    it("projects CURIE type skos:Concept to full IRI rdf:type triple", () => {
        const triples = projectFrontmatter({ type: "skos:Concept" });
        const typeT = triples.find(t =>
            t.predicate.value === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
        );
        expect(typeT?.object.value)
            .toBe("http://www.w3.org/2004/02/skos/core#Concept");
    });

    it("projects CURIE type schema:Person to full IRI rdf:type triple", () => {
        const triples = projectFrontmatter({ type: "schema:Person" });
        const typeT = triples.find(t =>
            t.predicate.value === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
        );
        expect(typeT?.object.value).toBe("https://schema.org/Person");
    });

    it("still resolves legacy short-form 'concept' via TYPE_MAP", () => {
        const triples = projectFrontmatter({ type: "concept" });
        const typeT = triples.find(t =>
            t.predicate.value === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
        );
        expect(typeT?.object.value)
            .toBe("https://pod.vardeman.me/vault/ontology/wiki#Concept");
    });

    it("still resolves absolute IRI type as-is", () => {
        const triples = projectFrontmatter({ type: "https://chuck.example/biz/Equipment" });
        const typeT = triples.find(t =>
            t.predicate.value === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
        );
        expect(typeT?.object.value).toBe("https://chuck.example/biz/Equipment");
    });
});
