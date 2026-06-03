import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { shouldReproject, DEFAULT_STAMP_PRED } from "../src-cjs/listener.js";

const body = "# A\n[A]{.prefLabel}\n";
const hash = createHash("sha256").update(body).digest("hex");

describe("backstop shouldReproject", () => {
  it("skips when stamp matches the body hash", () => {
    const meta = `<x> <${DEFAULT_STAMP_PRED}> "${hash}" .`;
    expect(shouldReproject(body, meta)).toBe(false);
  });
  it("reprojects when stamp missing", () => {
    expect(shouldReproject(body, `<x> <http://purl.org/dc/terms/title> "A" .`)).toBe(true);
  });
  it("reprojects when stamp stale", () => {
    const meta = `<x> <${DEFAULT_STAMP_PRED}> "deadbeef" .`;
    expect(shouldReproject(body, meta)).toBe(true);
  });
  it("reprojects when .meta is absent/empty", () => {
    expect(shouldReproject(body, "")).toBe(true);
  });
});
