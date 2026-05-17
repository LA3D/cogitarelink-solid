import { describe, it, expect } from "vitest";
import { computeScore } from "../src/score";

describe("computeScore (density-based)", () => {
  it("returns 0 when no matches", () => {
    expect(computeScore(0, 1000)).toBe(0);
  });

  it("returns higher score for higher density", () => {
    const lowDensity = computeScore(1, 10000);
    const highDensity = computeScore(10, 1000);
    expect(highDensity).toBeGreaterThan(lowDensity);
  });

  it("capped at 100", () => {
    expect(computeScore(1000, 100)).toBeLessThanOrEqual(100);
  });

  it("integer output", () => {
    expect(Number.isInteger(computeScore(3, 500))).toBe(true);
  });

  it("does not divide by zero on empty body", () => {
    expect(() => computeScore(0, 0)).not.toThrow();
    expect(computeScore(0, 0)).toBe(0);
  });
});
