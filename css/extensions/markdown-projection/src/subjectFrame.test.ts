import { describe, it, expect } from "vitest";
import { resolveSubject } from "./subjectFrame";

describe("resolveSubject", () => {
  const page = "https://pod/wiki/concepts/x.md";
  it("content predicates default to <#this>", () => {
    expect(resolveSubject(page, "prefLabel", undefined)).toBe(page + "#this");
  });
  it("document-metadata predicates default to <>", () => {
    expect(resolveSubject(page, "title", undefined)).toBe(page);
  });
  it("an explicit switch overrides the default", () => {
    expect(resolveSubject(page, "prefLabel", "page")).toBe(page);
    expect(resolveSubject(page, "title", "thing")).toBe(page + "#this");
  });
});
