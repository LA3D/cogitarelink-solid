import { describe, it, expect } from "vitest";
import { maskCodeSpans } from "./codeSpans.js";

describe("maskCodeSpans", () => {
  it("replaces inline code content with spaces, preserving length + offsets", () => {
    const src = "see `[x]{.prefLabel}` and [y]{.altLabel}";
    const out = maskCodeSpans(src);
    expect(out.length).toBe(src.length);
    expect(out).not.toContain("prefLabel");
    expect(out).toContain("[y]{.altLabel}");
    expect(out.indexOf("[y]")).toBe(src.indexOf("[y]"));
  });

  it("masks fenced code blocks", () => {
    const src = "a\n```\n[[Z]]{.broader}\n```\nb [[W]]{.broader}";
    const out = maskCodeSpans(src);
    expect(out).not.toContain("[[Z]]");
    expect(out).toContain("[[W]]{.broader}");
  });

  it("leaves text with no code spans unchanged", () => {
    const src = "plain [a]{.x} and [[B]]{.y}";
    expect(maskCodeSpans(src)).toBe(src);
  });

  it("masks a fenced block with CRLF line endings (preserving length)", () => {
    const src = "a\r\n```\r\n[[Z]]{.broader}\r\n```\r\nb [[W]]{.broader}";
    const out = maskCodeSpans(src);
    expect(out.length).toBe(src.length);     // invariant preserved
    expect(out).not.toContain("[[Z]]");      // fenced token masked
    expect(out).toContain("[[W]]{.broader}"); // live token survives
  });

  it("masks a fenced block that ends the file with no trailing newline", () => {
    const src = "intro\n```\n[[Z]]{.broader}\n```";
    const out = maskCodeSpans(src);
    expect(out).not.toContain("[[Z]]");
    expect(out.length).toBe(src.length);
  });
});
