import { describe, it, expect } from "vitest";
import { DataFactory } from "n3";
import { projectSpanLiterals } from "./spanLiteralProjection";
const { namedNode } = DataFactory;

const BIND = { prefLabel: "http://www.w3.org/2004/02/skos/core#prefLabel" };

describe("projectSpanLiterals", () => {
  it("emits <subject> <predicate> \"text\" with the bound predicate IRI", () => {
    const subject = namedNode("https://pod/wiki/concepts/x.md#this");
    const q = projectSpanLiterals("[Photosynthesis]{.prefLabel}", subject, BIND);
    expect(q).toHaveLength(1);
    expect(q[0].predicate.value).toBe(BIND.prefLabel);
    expect(q[0].object.termType).toBe("Literal");
    expect(q[0].object.value).toBe("Photosynthesis");
  });
  it("applies @lang and ^^datatype", () => {
    const s = namedNode("https://pod/x#this");
    const lang = projectSpanLiterals("[P]{.prefLabel@fr}", s, BIND)[0].object;
    expect((lang as any).language).toBe("fr");
  });
  it("rejects an unbound predicate (no silent pass)", () => {
    expect(() => projectSpanLiterals("[x]{.nope}", namedNode("https://pod/x#this"), BIND))
      .toThrow(/unbound predicate: nope/);
  });
});
