import { describe, it, expect } from "vitest";
import { Parser } from "n3";
import { UnprocessableWriteDetector } from "../src/detectors/UnprocessableWriteDetector";
import { MEM } from "../src/types";

const SAMPLE_REPORT = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
[] a sh:ValidationReport ;
   sh:conforms false ;
   sh:result [
     a sh:ValidationResult ;
     sh:resultMessage "Missing required property" ;
     sh:resultSeverity sh:Violation ;
   ] .
`;

function countTypeTriples(turtle: string, type: string): number {
  const parser = new Parser();
  const quads = parser.parse(turtle);
  return quads.filter(
    (q) =>
      q.predicate.value === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type" &&
      q.object.value === type,
  ).length;
}

describe("UnprocessableWriteDetector", () => {
  const det = new UnprocessableWriteDetector();

  it("returns Turtle containing mem:UnprocessableWrite and the target URI", () => {
    const out = det.buildEvent({
      targetUri: "https://pod.example/vault/wiki/pages/note.md",
      validationReport: SAMPLE_REPORT,
      timestamp: new Date("2026-05-18T12:00:00Z"),
    });
    expect(out).not.toBeNull();
    expect(out!).toContain("mem:UnprocessableWrite");
    expect(out!).toContain("https://pod.example/vault/wiki/pages/note.md");
  });

  it("returns null when validationReport is null or empty", () => {
    expect(
      det.buildEvent({
        targetUri: "https://pod.example/x",
        validationReport: null as unknown as string,
        timestamp: new Date(),
      }),
    ).toBeNull();
    expect(
      det.buildEvent({
        targetUri: "https://pod.example/x",
        validationReport: "",
        timestamp: new Date(),
      }),
    ).toBeNull();
  });

  it("returned Turtle parses cleanly with N3 parser and asserts mem:UnprocessableWrite type", () => {
    const out = det.buildEvent({
      targetUri: "https://pod.example/vault/wiki/pages/note.md",
      validationReport: SAMPLE_REPORT,
      timestamp: new Date("2026-05-18T12:00:00Z"),
    })!;
    // Must parse without throwing
    const parser = new Parser();
    const quads = parser.parse(out);
    expect(quads.length).toBeGreaterThan(0);
    // At least one rdf:type mem:UnprocessableWrite triple
    expect(countTypeTriples(out, `${MEM}UnprocessableWrite`)).toBeGreaterThanOrEqual(1);
  });

  it("uses a named-fragment activity URI (not a blank node)", () => {
    const out = det.buildEvent({
      targetUri: "https://pod.example/vault/wiki/pages/note.md",
      validationReport: SAMPLE_REPORT,
      timestamp: new Date("2026-05-18T12:00:00Z"),
    })!;
    const parser = new Parser();
    const quads = parser.parse(out);
    const typeQuad = quads.find(
      (q) =>
        q.predicate.value === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type" &&
        q.object.value === `${MEM}UnprocessableWrite`,
    );
    expect(typeQuad).toBeDefined();
    expect(typeQuad!.subject.termType).toBe("NamedNode");
  });

  it("includes as:to when writerWebId is provided", () => {
    const out = det.buildEvent({
      targetUri: "https://pod.example/vault/wiki/pages/note.md",
      validationReport: SAMPLE_REPORT,
      writerWebId: "https://pod.example/vault/profile/card#this",
      timestamp: new Date("2026-05-18T12:00:00Z"),
    })!;
    expect(out).toContain("https://pod.example/vault/profile/card#this");
  });
});
