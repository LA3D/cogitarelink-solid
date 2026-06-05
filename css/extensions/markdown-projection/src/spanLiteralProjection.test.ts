import { describe, it, expect } from "vitest";
import { DataFactory } from "n3";
import { projectSpanLiterals, DATATYPE_PREFIXES } from "./spanLiteralProjection";
const { namedNode } = DataFactory;

const BIND = {
  prefLabel: "http://www.w3.org/2004/02/skos/core#prefLabel",
  identifier: "http://purl.org/dc/terms/identifier",
};

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

  // D111 §6.2 — ids: datatype binding
  it("ids:doi datatype — emits a typed literal with the scheme namespace IRI", () => {
    const s = namedNode("https://pod/wiki/sources/paper.md#this");
    const q = projectSpanLiterals("[10.1234/x]{.identifier^^ids:doi}", s, BIND);
    expect(q).toHaveLength(1);
    expect(q[0].predicate.value).toBe("http://purl.org/dc/terms/identifier");
    expect(q[0].object.termType).toBe("Literal");
    expect(q[0].object.value).toBe("10.1234/x");
    expect((q[0].object as any).datatype.value).toBe(
      "https://pod.vardeman.me/id/schemes/#doi"
    );
  });

  // D111 §6.2 — unknown prefix → plain literal (suggestive typing, no throw)
  it("unknown datatype prefix — emits plain literal, never throws", () => {
    const s = namedNode("https://pod/wiki/sources/paper.md#this");
    const q = projectSpanLiterals("[X9]{.identifier^^zzz:mystery}", s, BIND);
    expect(q).toHaveLength(1);
    expect(q[0].object.termType).toBe("Literal");
    expect(q[0].object.value).toBe("X9");
    // plain literal → xsd:string datatype (N3 default)
    expect((q[0].object as any).datatype.value).toBe(
      "http://www.w3.org/2001/XMLSchema#string"
    );
  });

  // Agreement test: DATATYPE_PREFIXES export is stable and includes required bindings
  it("DATATYPE_PREFIXES exports xsd: and ids: namespace bindings", () => {
    expect(DATATYPE_PREFIXES["xsd"]).toBe("http://www.w3.org/2001/XMLSchema#");
    expect(DATATYPE_PREFIXES["ids"]).toBe("https://pod.vardeman.me/id/schemes/#");
  });
});
