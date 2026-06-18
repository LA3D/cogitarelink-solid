import { describe, it, expect } from "vitest";
import { DataFactory } from "n3";
import { emitSubstrateInvariants } from "../src/projectionPipeline.js";

const { namedNode } = DataFactory;

describe("emitSubstrateInvariants (D98)", () => {
  it("emits schema:mainEntity, schema:mainEntityOfPage, and rdf:type for both subjects", () => {
    const quads = emitSubstrateInvariants({
      pageIRI: namedNode("https://pod.example/wiki/concepts/foo.md"),
      thingIRI: namedNode("https://pod.example/wiki/concepts/foo.md#this"),
      thingClass: "http://www.w3.org/2004/02/skos/core#Concept",
    });

    const triples = quads.map((q) => [
      q.subject.value,
      q.predicate.value,
      q.object.value,
    ]);

    expect(triples).toContainEqual([
      "https://pod.example/wiki/concepts/foo.md",
      "https://schema.org/mainEntity",
      "https://pod.example/wiki/concepts/foo.md#this",
    ]);
    expect(triples).toContainEqual([
      "https://pod.example/wiki/concepts/foo.md#this",
      "https://schema.org/mainEntityOfPage",
      "https://pod.example/wiki/concepts/foo.md",
    ]);
    expect(triples).toContainEqual([
      "https://pod.example/wiki/concepts/foo.md#this",
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      "http://www.w3.org/2004/02/skos/core#Concept",
    ]);
  });

  it("emits page <> a wiki:Page", () => {
    const quads = emitSubstrateInvariants({
      pageIRI: namedNode("https://pod.example/wiki/concepts/foo.md"),
      thingIRI: namedNode("https://pod.example/wiki/concepts/foo.md#this"),
      thingClass: "http://www.w3.org/2004/02/skos/core#Concept",
    });

    const triples = quads.map((q) => [
      q.subject.value,
      q.predicate.value,
      q.object.value,
    ]);

    expect(triples).toContainEqual([
      "https://pod.example/wiki/concepts/foo.md",
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      "https://pod.vardeman.me/vault/ontology/wiki#Page",
    ]);
  });

  it("emits page <> a foaf:Document (universal write-contract hook)", () => {
    const quads = emitSubstrateInvariants({
      pageIRI: namedNode("https://pod.example/wiki/concepts/foo.md"),
      thingIRI: namedNode("https://pod.example/wiki/concepts/foo.md#this"),
      thingClass: "http://www.w3.org/2004/02/skos/core#Concept",
    });
    const isFoafDoc = quads.some((q) =>
      q.subject.value === "https://pod.example/wiki/concepts/foo.md" &&
      q.predicate.value === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type" &&
      q.object.value === "http://xmlns.com/foaf/0.1/Document");
    expect(isFoafDoc).toBe(true);
  });

  it("emits exactly 5 triples per call", () => {
    const quads = emitSubstrateInvariants({
      pageIRI: namedNode("https://pod.example/wiki/concepts/foo.md"),
      thingIRI: namedNode("https://pod.example/wiki/concepts/foo.md#this"),
      thingClass: "http://www.w3.org/2004/02/skos/core#Concept",
    });
    expect(quads).toHaveLength(5);
  });
});
