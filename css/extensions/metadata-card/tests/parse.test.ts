import { describe, it, expect } from "vitest";
import { parseMeta } from "../src/parse.js";

const SAMPLE_TTL = `
@prefix dct: <http://purl.org/dc/terms/> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix vault: <https://pod.vardeman.me/vault/ontology#> .
@prefix prov: <http://www.w3.org/ns/prov#> .

<http://pod.vardeman.me:3000/vault/resources/concepts/context-graphs.md>
  a vault:ConceptNote ;
  dct:title "Context Graphs" ;
  dct:description "Semantic context layers for AI agents" ;
  dct:format "text/markdown" ;
  dct:created "2026-03-01"^^<http://www.w3.org/2001/XMLSchema#date> ;
  skos:related
    <http://pod.vardeman.me:3000/vault/resources/concepts/progressive-disclosure.md> ,
    <http://pod.vardeman.me:3000/vault/resources/concepts/knowledge-fabrics.md> ;
  vault:extends
    <http://pod.vardeman.me:3000/vault/resources/concepts/structure-first-memory-architecture.md> ;
  dct:source <http://pod.vardeman.me:3000/vault/resources/literature/zhang-2025-rlm.md> ;
  prov:wasDerivedFrom <file:///Users/cvardema/Obsidian/obsidian/.../Context%20Graphs.md> .
`;

describe("parseMeta", () => {
  it("extracts title and description", () => {
    const m = parseMeta(SAMPLE_TTL);
    expect(m.title).toBe("Context Graphs");
    expect(m.description).toBe("Semantic context layers for AI agents");
  });

  it("extracts rdf:type values", () => {
    const m = parseMeta(SAMPLE_TTL);
    expect(m.types).toContain("https://pod.vardeman.me/vault/ontology#ConceptNote");
  });

  it("extracts dct:format", () => {
    const m = parseMeta(SAMPLE_TTL);
    expect(m.format).toBe("text/markdown");
  });

  it("extracts dct:created literal value", () => {
    const m = parseMeta(SAMPLE_TTL);
    expect(m.created).toBe("2026-03-01");
  });

  it("extracts all relationships in display order", () => {
    const m = parseMeta(SAMPLE_TTL);
    const labels = m.relationships.map((r) => r.label);
    expect(labels).toContain("Related");
    expect(labels).toContain("Source");
    expect(labels).toContain("Extends");
    expect(labels).toContain("Derived from");
  });

  it("captures multiple skos:related targets", () => {
    const m = parseMeta(SAMPLE_TTL);
    const related = m.relationships.filter((r) => r.label === "Related");
    expect(related).toHaveLength(2);
    expect(related[0]!.isIri).toBe(true);
  });

  it("subject IRI is the resource URL", () => {
    const m = parseMeta(SAMPLE_TTL);
    expect(m.subject).toBe("http://pod.vardeman.me:3000/vault/resources/concepts/context-graphs.md");
  });

  it("throws on empty Turtle", () => {
    expect(() => parseMeta("")).toThrow(/empty/i);
  });
});
