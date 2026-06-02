import { describe, it, expect } from "vitest";
import { classifyAssertion } from "./krGuard";

const KR = new Set([
  "http://www.w3.org/2000/01/rdf-schema#subClassOf",
  "http://www.w3.org/2002/07/owl#Class",
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#Property",
]);

describe("classifyAssertion", () => {
  it("ABox: typing as a domain class is ordinary data", () => {
    expect(classifyAssertion("http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      "http://www.w3.org/2004/02/skos/core#Concept", KR)).toBe("abox");
  });
  it("TBox: a schema predicate is ontological", () => {
    expect(classifyAssertion("http://www.w3.org/2000/01/rdf-schema#subClassOf",
      "http://x/Other", KR)).toBe("tbox");
  });
  it("TBox: typing something AS a KR metaclass is ontological", () => {
    expect(classifyAssertion("http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      "http://www.w3.org/2002/07/owl#Class", KR)).toBe("tbox");
  });
});
