import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("AdmissionFloorStore layering (anti-contamination)", () => {
  it("contains no profile symbols — stays L1/L2-general", () => {
    const src = readFileSync(join(__dirname, "../src/storage/AdmissionFloorStore.ts"), "utf8");
    for (const banned of ["markdown-projection", "skos", "wiki:", "ConceptShape", "projectionPipeline", "prefLabel"]) {
      expect(src.toLowerCase()).not.toContain(banned.toLowerCase());
    }
  });
});
