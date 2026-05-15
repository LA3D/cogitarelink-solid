import { describe, it, expect } from "vitest";
import { projectFrontmatter } from "../src/frontmatterProjection.js";

describe("projectFrontmatter", () => {
    it("projects type to rdf:type with class IRI", () => {
        const triples = projectFrontmatter({
            type: "concept",
            created: "2026-05-15T00:00:00Z",
            modified: "2026-05-15T00:00:00Z",
        });
        const typeT = triples.find(t => t.predicate.value === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
        expect(typeT?.object.value).toBe("urn:example:wiki#Concept");
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
        expect(t1.find(t => t.predicate.value === "http://purl.org/dc/terms/identifier")?.object.value).toBe("https://x.com");
        expect(t2.find(t => t.predicate.value === "http://purl.org/dc/terms/identifier")?.object.value).toBe("smith-2026-foo");
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
