import { describe, it, expect } from "vitest";
import { Parser, Store } from "n3";
import { validateQuadsAgainstShape } from "../src/storage/validators/validateQuadsAgainstShape.js";

const SHAPE = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
<#S> a sh:NodeShape ; sh:targetClass skos:Concept ; sh:closed false ;
  sh:property [ sh:path skos:prefLabel ; sh:minCount 1 ; sh:datatype xsd:string ] .`;

function quads(ttl: string): Store {
  const s = new Store(); s.addQuads(new Parser({ baseIRI: "http://x/a.md" }).parse(ttl)); return s;
}

describe("validateQuadsAgainstShape", () => {
  const shapeStore = quads(SHAPE);

  it("returns conforms=true for a valid concept", async () => {
    const data = quads(`<http://x/a.md#this> a <http://www.w3.org/2004/02/skos/core#Concept> ;
      <http://www.w3.org/2004/02/skos/core#prefLabel> "Photosynthesis" .`);
    const r = await validateQuadsAgainstShape(data, shapeStore);
    expect(r.conforms).toBe(true);
  });

  it("returns conforms=false + a turtle report when prefLabel missing", async () => {
    const data = quads(`<http://x/a.md#this> a <http://www.w3.org/2004/02/skos/core#Concept> .`);
    const r = await validateQuadsAgainstShape(data, shapeStore);
    expect(r.conforms).toBe(false);
    expect(r.reportTurtle).toMatch(/ValidationReport|prefLabel/);
  });

  it("passes agent-owned non-governed predicates (sh:closed false)", async () => {
    const data = quads(`<http://x/a.md#this> a <http://www.w3.org/2004/02/skos/core#Concept> ;
      <http://www.w3.org/2004/02/skos/core#prefLabel> "X" ;
      <http://example.org/agentOwned> "anything" .`);
    const r = await validateQuadsAgainstShape(data, shapeStore);
    expect(r.conforms).toBe(true);
  });
});
