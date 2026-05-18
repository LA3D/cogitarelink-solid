import { describe, it, expect } from "vitest";
import { Parser } from "n3";
import { ContradictionDetector } from "../src/detectors/ContradictionDetector";
import { MEM, WIKI } from "../src/types";

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const NOW = new Date("2026-05-18T12:00:00Z");

const SUBJECT = "https://pod.example/vault/wiki/pages/note.md#this";
const B = "https://pod.example/vault/wiki/pages/claim-b.md#this";
const C = "https://pod.example/vault/wiki/pages/claim-c.md#this";

describe("ContradictionDetector", () => {
  const v1Pairs: Array<[string, string]> = [[`${WIKI}supports`, `${WIKI}criticizes`]];

  it("emits when subject both supports and criticizes the same object", () => {
    const det = new ContradictionDetector({ contradictoryPairs: v1Pairs });
    const out = det.maybeEmit({
      subject: SUBJECT,
      edges: [
        { predicate: `${WIKI}supports`, object: B },
        { predicate: `${WIKI}criticizes`, object: B },
      ],
      now: NOW,
    });
    expect(out).not.toBeNull();
    expect(out!).toContain("mem:ContradictionDetected");
    expect(out!).toContain(SUBJECT);
    expect(out!).toContain(B);
  });

  it("returns null when only one side of the pair is present", () => {
    const det = new ContradictionDetector({ contradictoryPairs: v1Pairs });
    expect(
      det.maybeEmit({
        subject: SUBJECT,
        edges: [{ predicate: `${WIKI}supports`, object: B }],
        now: NOW,
      }),
    ).toBeNull();
  });

  it("returns null when contradictory predicates point at different objects", () => {
    const det = new ContradictionDetector({ contradictoryPairs: v1Pairs });
    expect(
      det.maybeEmit({
        subject: SUBJECT,
        edges: [
          { predicate: `${WIKI}supports`, object: B },
          { predicate: `${WIKI}criticizes`, object: C },
        ],
        now: NOW,
      }),
    ).toBeNull();
  });

  it("finds contradiction on second of multiple configured pairs", () => {
    const det = new ContradictionDetector({
      contradictoryPairs: [
        [`${WIKI}endorses`, `${WIKI}refutes`],
        [`${WIKI}supports`, `${WIKI}criticizes`],
      ],
    });
    const out = det.maybeEmit({
      subject: SUBJECT,
      edges: [
        { predicate: `${WIKI}supports`, object: C },
        { predicate: `${WIKI}criticizes`, object: C },
      ],
      now: NOW,
    });
    expect(out).not.toBeNull();
    expect(out!).toContain(C);
  });

  it("Turtle records mem:contradictingPredicate and mem:contradictedObject", () => {
    const det = new ContradictionDetector({ contradictoryPairs: v1Pairs });
    const out = det.maybeEmit({
      subject: SUBJECT,
      edges: [
        { predicate: `${WIKI}supports`, object: B },
        { predicate: `${WIKI}criticizes`, object: B },
      ],
      now: NOW,
    })!;
    const quads = new Parser().parse(out);
    const contradictedObjQuad = quads.find(
      (q) => q.predicate.value === `${MEM}contradictedObject` && q.object.value === B,
    );
    expect(contradictedObjQuad).toBeDefined();
    // Named-subject invariant
    const typeQuad = quads.find(
      (q) => q.predicate.value === RDF_TYPE && q.object.value === `${MEM}ContradictionDetected`,
    );
    expect(typeQuad!.subject.termType).toBe("NamedNode");
  });
});
