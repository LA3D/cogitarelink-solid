import { describe, it, expect } from "vitest";
import { snippet } from "../src/snippet";

describe("snippet", () => {
  it("returns halo around match in middle of body", () => {
    const body = "lorem ipsum ".repeat(20) + "TARGET" + " end of body";
    const offset = body.indexOf("TARGET");
    const result = snippet(body, offset, 6, 30);
    expect(result).toContain("TARGET");
    expect(result.startsWith("…")).toBe(true);
  });

  it("no leading ellipsis when match is at body start", () => {
    const result = snippet("TARGET appears here", 0, 6, 30);
    expect(result.startsWith("TARGET")).toBe(true);
  });

  it("no trailing ellipsis when match reaches body end", () => {
    const body = "ending with TARGET";
    const result = snippet(body, body.indexOf("TARGET"), 6, 30);
    expect(result.endsWith("TARGET")).toBe(true);
  });

  it("collapses whitespace", () => {
    const body = "before\n\n\nTARGET\n\nafter";
    const result = snippet(body, body.indexOf("TARGET"), 6, 30);
    expect(result).not.toMatch(/\n/);
    expect(result).not.toMatch(/\s\s/);
  });

  it("default halo is 80 chars", () => {
    const body = "x".repeat(200) + "TARGET" + "y".repeat(200);
    const result = snippet(body, body.indexOf("TARGET"), 6);
    expect(result.length).toBeLessThan(200);
  });
});
