import { describe, it, expect } from "vitest";
import { Parser } from "n3";
import { ReflectionDueDetector } from "../src/detectors/ReflectionDueDetector";
import { MEM } from "../src/types";

const DAY = 24 * 3600 * 1000;
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

describe("ReflectionDueDetector", () => {
  it("emits when interval elapsed AND there's recent activity", () => {
    const det = new ReflectionDueDetector({ intervalMs: DAY });
    const now = new Date("2026-05-18T12:00:00Z");
    const lastEmitted = new Date(now.getTime() - DAY - 1000);
    const lastActivity = new Date(now.getTime() - 1000);
    const out = det.maybeEmit({ lastEmitted, lastActivity, now });
    expect(out).not.toBeNull();
    expect(out!).toContain("mem:ReflectionDue");
  });

  it("returns null when interval has not elapsed", () => {
    const det = new ReflectionDueDetector({ intervalMs: DAY });
    const now = new Date("2026-05-18T12:00:00Z");
    const lastEmitted = new Date(now.getTime() - 1000);
    const lastActivity = new Date(now.getTime() - 500);
    expect(det.maybeEmit({ lastEmitted, lastActivity, now })).toBeNull();
  });

  it("returns null when interval elapsed but no recent activity (lastActivity <= lastEmitted)", () => {
    const det = new ReflectionDueDetector({ intervalMs: DAY });
    const now = new Date("2026-05-18T12:00:00Z");
    const lastEmitted = new Date(now.getTime() - DAY - 1000);
    const lastActivity = new Date(now.getTime() - DAY - 5000); // older than lastEmitted
    expect(det.maybeEmit({ lastEmitted, lastActivity, now })).toBeNull();
  });

  it("emits on first-time (lastEmitted=null) when activity exists", () => {
    const det = new ReflectionDueDetector({ intervalMs: DAY });
    const now = new Date("2026-05-18T12:00:00Z");
    const lastActivity = new Date(now.getTime() - 1000);
    const out = det.maybeEmit({ lastEmitted: null, lastActivity, now });
    expect(out).not.toBeNull();
    expect(out!).toContain("mem:ReflectionDue");
  });

  it("returns null on first-time when no activity at all", () => {
    const det = new ReflectionDueDetector({ intervalMs: DAY });
    const now = new Date("2026-05-18T12:00:00Z");
    expect(det.maybeEmit({ lastEmitted: null, lastActivity: null, now })).toBeNull();
  });

  it("returned Turtle uses a named subject (no blank nodes)", () => {
    const det = new ReflectionDueDetector({ intervalMs: DAY });
    const now = new Date("2026-05-18T12:00:00Z");
    const lastActivity = new Date(now.getTime() - 1000);
    const out = det.maybeEmit({ lastEmitted: null, lastActivity, now })!;
    const quads = new Parser().parse(out);
    const typeQuad = quads.find(
      (q) => q.predicate.value === RDF_TYPE && q.object.value === `${MEM}ReflectionDue`,
    );
    expect(typeQuad).toBeDefined();
    expect(typeQuad!.subject.termType).toBe("NamedNode");
  });
});
