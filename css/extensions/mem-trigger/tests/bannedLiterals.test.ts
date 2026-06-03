// R-T4 banned-literal guard for mem-trigger (mirrors wiki-search/tests/bannedLiterals.test.ts).
//
// D107 parameterized the storage root (storagePath) — MemTriggerListener derives
// eventsContainer from baseUrl + storagePath and NOW threads it into every
// detector call-site (Fix 1 of the final-review batch). This test asserts:
//
//   1. No baked pod.vardeman.me container path (e.g. /vault/wiki/.events/) appears
//      in any src file EXCEPT types.ts's @deprecated DEFAULT_EVENTS_CONTAINER.
//   2. The derived eventsContainer reaches the emitted event body's as:target,
//      not the hardcoded DEFAULT_EVENTS_CONTAINER.
//
// Allowed occurrences (whitelist):
//   - types.ts: vocab namespace IRIs (MEM/WIKI — legitimate D84 IRIs) and the
//     @deprecated DEFAULT_EVENTS_CONTAINER fallback (kept for unit-test standalones).
//   - comments / block comments (stripped before check).

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import { BoundExceededDetector } from "../src/detectors/BoundExceededDetector";
import { ContradictionDetector } from "../src/detectors/ContradictionDetector";
import { ReflectionDueDetector } from "../src/detectors/ReflectionDueDetector";
import { UnprocessableWriteDetector } from "../src/detectors/UnprocessableWriteDetector";

const SRC = join(__dirname, "..", "src");
const BANNED = "pod.vardeman.me/vault/wiki/.events/";
const VOCAB_RE = /https:\/\/pod\.vardeman\.me\/vault\/ontology\/[^"'`\s]*/g;

function stripNoise(src: string): string {
  return src
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(VOCAB_RE, "");
}

function srcFiles(): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (extname(full) === ".ts" && !full.endsWith(".test.ts")) out.push(full);
    }
  }
  walk(SRC);
  return out;
}

describe("R-T4 banned-literal guard (mem-trigger storage root must come from config)", () => {
  it("no src file except types.ts bakes a /vault/wiki/.events/ container path", () => {
    const violations: string[] = [];
    for (const f of srcFiles()) {
      if (f.endsWith("types.ts")) continue; // deprecated DEFAULT_EVENTS_CONTAINER lives here
      const clean = stripNoise(readFileSync(f, "utf8"));
      if (clean.includes(BANNED)) violations.push(f.replace(SRC + "/", ""));
    }
    expect(violations).toEqual([]);
  });

  it("emitted BoundExceeded as:target equals the DERIVED eventsContainer, not the default", () => {
    const DERIVED = "https://custom.example.org/store/wiki/.events/";
    const detector = new BoundExceededDetector({ threshold: 1 });
    const turtle = detector.maybeEmit({
      containerUri: "https://custom.example.org/store/wiki/concepts/",
      childCount: 99,
      lastEmittedForContainer: null,
      now: new Date("2026-01-01T00:00:00Z"),
      eventsContainer: DERIVED,
    });
    expect(turtle).not.toBeNull();
    // as:target must point at the derived container (not the baked default).
    expect(turtle).toContain(DERIVED);
    // The baked /vault/wiki/.events/ path must NOT appear as a target IRI.
    // (Vocab namespace IRIs like mem: are allowed — they're D84 RDF terms, not
    // storage paths; the constraint is on storage-path literals only.)
    expect(turtle).not.toContain("pod.vardeman.me/vault/wiki/.events/");
  });

  it("emitted ContradictionDetected as:target equals the DERIVED eventsContainer", () => {
    const DERIVED = "https://custom.example.org/store/wiki/.events/";
    const detector = new ContradictionDetector({
      contradictoryPairs: [
        ["https://pod.vardeman.me/vault/ontology/wiki#supports",
         "https://pod.vardeman.me/vault/ontology/wiki#criticizes"],
      ],
    });
    const turtle = detector.maybeEmit({
      subject: "https://custom.example.org/store/wiki/pages/foo.md",
      edges: [
        { predicate: "https://pod.vardeman.me/vault/ontology/wiki#supports",
          object: "https://example.org/claim" },
        { predicate: "https://pod.vardeman.me/vault/ontology/wiki#criticizes",
          object: "https://example.org/claim" },
      ],
      now: new Date("2026-01-01T00:00:00Z"),
      eventsContainer: DERIVED,
    });
    expect(turtle).not.toBeNull();
    // as:target must be the derived container, not DEFAULT_EVENTS_CONTAINER.
    expect(turtle).toContain(DERIVED);
  });

  it("emitted ReflectionDue as:target equals the DERIVED eventsContainer", () => {
    const DERIVED = "https://custom.example.org/store/wiki/.events/";
    const detector = new ReflectionDueDetector({ intervalMs: 100 });
    const turtle = detector.maybeEmit({
      lastEmitted: null,
      lastActivity: new Date("2026-01-01T00:00:00Z"),
      now: new Date("2026-01-01T01:00:00Z"),
      eventsContainer: DERIVED,
    });
    expect(turtle).not.toBeNull();
    expect(turtle).toContain(DERIVED);
  });

  it("emitted UnprocessableWrite as:target equals the DERIVED eventsContainer", () => {
    const DERIVED = "https://custom.example.org/store/wiki/.events/";
    const detector = new UnprocessableWriteDetector();
    const turtle = detector.buildEvent({
      targetUri: "https://custom.example.org/store/wiki/pages/bad.md",
      validationReport: `<urn:x> a <http://www.w3.org/ns/shacl#ValidationReport> .`,
      timestamp: new Date("2026-01-01T00:00:00Z"),
      eventsContainer: DERIVED,
    });
    expect(turtle).not.toBeNull();
    expect(turtle).toContain(DERIVED);
  });
});
