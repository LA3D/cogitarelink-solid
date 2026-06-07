import { describe, it, expect } from "vitest";
import { Store, DataFactory } from "n3";
import { ViewAssembler } from "../src/ViewAssembler";
const { namedNode, quad, literal } = DataFactory;

const META = new Store([
  quad(namedNode("https://p.me/r"), namedNode("http://purl.org/dc/terms/title"), literal("T")),
  quad(namedNode("https://p.me/r#this"),
       namedNode("http://www.w3.org/2004/02/skos/core#prefLabel"), literal("T")),
]);

describe("ViewAssembler", () => {
  it("executes a CONSTRUCT over an explicit store source", async () => {
    const a = new ViewAssembler();
    const quads = await a.construct("CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }", [META]);
    expect(quads.length).toBe(2);
  });

  it("serializes a fused document: body + fenced turtle", async () => {
    const a = new ViewAssembler();
    const doc = await a.fuse("# Title\n\nbody text\n",
      "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }", [META]);
    expect(doc.startsWith("# Title")).toBe(true);
    expect(doc).toContain("```turtle");
    expect(doc).toContain("prefLabel");
    expect(doc.trim().endsWith("```")).toBe(true);
  });
});
