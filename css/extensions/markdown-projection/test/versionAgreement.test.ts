// Drift guards for the PSP T3 version stamp (spec §6) — the repo's mirror-test idiom.
//
// 1. PROJECTOR_VERSION (hand-maintained ESM constant — JSON imports are awkward in the
//    dual NodeNext-ESM/CJS build) must equal package.json's "version". Bump both together.
// 2. MarkdownBodyProjector.version (read from package.json at construction; the value the
//    floor actually stamps) must equal PROJECTOR_VERSION.
// 3. The src-cjs stamp-predicate mirrors (the projector reads the PRIOR .meta's stamps to
//    decide exact-vs-degraded subtraction) must equal shape-validator's util constants
//    (which stampAgreement.test.ts in turn pins to both config files).
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { PROJECTOR_VERSION } from "../src/projectionPipeline.js";
import { MarkdownBodyProjector } from "../src-cjs/markdownBodyProjector.js";
import { STAMP_PRED, VERSION_PRED } from "../src-cjs/stampPredicates.js";
import {
  DEFAULT_STAMP_PRED as FLOOR_STAMP_PRED,
  VERSION_PRED as FLOOR_VERSION_PRED,
} from "../../shape-validator/src/util/StampPredicate.js";

describe("projector version + stamp predicate agreement (drift guards)", () => {
  it("PROJECTOR_VERSION == package.json version", () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));
    expect(PROJECTOR_VERSION).toBe(pkg.version);
  });

  it("MarkdownBodyProjector.version == PROJECTOR_VERSION", () => {
    const p = new MarkdownBodyProjector("https://pod.vardeman.me", "/data", "/vault");
    expect(p.version).toBe(PROJECTOR_VERSION);
  });

  it("src-cjs stamp predicates == shape-validator util constants", () => {
    expect(STAMP_PRED).toBe(FLOOR_STAMP_PRED);
    expect(VERSION_PRED).toBe(FLOOR_VERSION_PRED);
  });
});
