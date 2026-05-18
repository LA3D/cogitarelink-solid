import { describe, it, expect } from "vitest";
import { Parser } from "n3";
import { BoundExceededDetector } from "../src/detectors/BoundExceededDetector";
import { MEM } from "../src/types";

const DAY = 24 * 3600 * 1000;
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const NOW = new Date("2026-05-18T12:00:00Z");

describe("BoundExceededDetector", () => {
  it("emits when childCount > 12 and no prior emit", () => {
    const det = new BoundExceededDetector({});
    const out = det.maybeEmit({
      containerUri: "https://pod.example/vault/wiki/pages/",
      childCount: 13,
      lastEmittedForContainer: null,
      now: NOW,
    });
    expect(out).not.toBeNull();
    expect(out!).toContain("mem:BoundExceeded");
    expect(out!).toContain("https://pod.example/vault/wiki/pages/");
  });

  it("returns null when childCount <= 12", () => {
    const det = new BoundExceededDetector({});
    expect(
      det.maybeEmit({
        containerUri: "https://pod.example/vault/wiki/pages/",
        childCount: 12,
        lastEmittedForContainer: null,
        now: NOW,
      }),
    ).toBeNull();
    expect(
      det.maybeEmit({
        containerUri: "https://pod.example/vault/wiki/pages/",
        childCount: 5,
        lastEmittedForContainer: null,
        now: NOW,
      }),
    ).toBeNull();
  });

  it("respects flapping protection: returns null when prior emit < 24h ago", () => {
    const det = new BoundExceededDetector({});
    const recent = new Date(NOW.getTime() - 1000);
    expect(
      det.maybeEmit({
        containerUri: "https://pod.example/vault/wiki/pages/",
        childCount: 15,
        lastEmittedForContainer: recent,
        now: NOW,
      }),
    ).toBeNull();
  });

  it("emits again when prior emit > 24h ago", () => {
    const det = new BoundExceededDetector({});
    const old = new Date(NOW.getTime() - DAY - 1000);
    const out = det.maybeEmit({
      containerUri: "https://pod.example/vault/wiki/pages/",
      childCount: 15,
      lastEmittedForContainer: old,
      now: NOW,
    });
    expect(out).not.toBeNull();
  });

  it("honors custom threshold and flapping protection", () => {
    const det = new BoundExceededDetector({ threshold: 50, flappingProtectionMs: 60_000 });
    // 30 children < custom threshold 50 → null
    expect(
      det.maybeEmit({
        containerUri: "https://pod.example/c/",
        childCount: 30,
        lastEmittedForContainer: null,
        now: NOW,
      }),
    ).toBeNull();
    // 51 children > 50 → emit
    expect(
      det.maybeEmit({
        containerUri: "https://pod.example/c/",
        childCount: 51,
        lastEmittedForContainer: null,
        now: NOW,
      }),
    ).not.toBeNull();
  });

  it("Turtle records mem:childCount and mem:threshold", () => {
    const det = new BoundExceededDetector({});
    const out = det.maybeEmit({
      containerUri: "https://pod.example/c/",
      childCount: 15,
      lastEmittedForContainer: null,
      now: NOW,
    })!;
    const quads = new Parser().parse(out);
    const childCountQuad = quads.find(
      (q) => q.predicate.value === `${MEM}childCount`,
    );
    const thresholdQuad = quads.find(
      (q) => q.predicate.value === `${MEM}threshold`,
    );
    expect(childCountQuad).toBeDefined();
    expect(childCountQuad!.object.value).toBe("15");
    expect(thresholdQuad).toBeDefined();
    expect(thresholdQuad!.object.value).toBe("12");
    // Named-subject invariant
    const typeQuad = quads.find(
      (q) => q.predicate.value === RDF_TYPE && q.object.value === `${MEM}BoundExceeded`,
    );
    expect(typeQuad!.subject.termType).toBe("NamedNode");
  });
});
