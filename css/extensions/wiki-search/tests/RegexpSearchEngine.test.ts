import { describe, it, expect } from "vitest";
import { RegexpSearchEngine } from "../src/RegexpSearchEngine";
import type { SearchPattern } from "../src/SearchEngine";

describe("RegexpSearchEngine", () => {
  const engine = new RegexpSearchEngine();

  it("returns empty array when no terms match", () => {
    const body = "the quick brown fox";
    const pattern: SearchPattern = { terms: ["nonsense"] };
    expect(engine.search(body, pattern)).toEqual([]);
  });

  it("matches a single literal term case-insensitively by default", () => {
    const body = "Quick Brown Fox";
    const matches = engine.search(body, { terms: ["quick"] });
    expect(matches).toHaveLength(1);
    expect(matches[0].term).toBe("quick");
    expect(matches[0].offset).toBe(0);
    expect(matches[0].length).toBe(5);
    expect(matches[0].line).toBe(1);
  });

  it("matches the literal phrase including spaces", () => {
    const body = "explore progressive disclosure as a way";
    const matches = engine.search(body, { terms: ["progressive disclosure"] });
    expect(matches).toHaveLength(1);
    expect(matches[0].offset).toBe(8);
    expect(matches[0].length).toBe(22);
  });

  it("treats terms as literal substrings, not regex (special chars escaped)", () => {
    const body = "version v1.0 with parens (x.y.z)";
    const matches = engine.search(body, { terms: ["v1.0"] });
    expect(matches).toHaveLength(1);
    expect(matches[0].length).toBe(4);
    // Confirm "." was not treated as regex metachar matching any char
    const matches2 = engine.search("vX0", { terms: ["v1.0"] });
    expect(matches2).toHaveLength(0);
  });

  it("collects matches from all terms (OR-collect; handler does AND filtering)", () => {
    const body = "foo and bar and foo again";
    const matches = engine.search(body, { terms: ["foo", "bar"] });
    expect(matches).toHaveLength(3);
    const terms = matches.map(m => m.term).sort();
    expect(terms).toEqual(["bar", "foo", "foo"]);
  });

  it("computes 1-indexed line numbers from offset", () => {
    const body = "line one\nline two\nline three\nline four with target";
    const matches = engine.search(body, { terms: ["target"] });
    expect(matches).toHaveLength(1);
    expect(matches[0].line).toBe(4);
  });

  it("respects maxMatchesPerResource cap", () => {
    const body = "x ".repeat(100);
    const matches = engine.search(body, { terms: ["x"], options: { maxMatchesPerResource: 10 } });
    expect(matches).toHaveLength(10);
  });

  it("defaults maxMatchesPerResource to 50", () => {
    const body = "x ".repeat(100);
    const matches = engine.search(body, { terms: ["x"] });
    expect(matches).toHaveLength(50);
  });

  it("caseSensitive option respected when set true", () => {
    const body = "Quick Brown Fox";
    const matches = engine.search(body, { terms: ["quick"], options: { caseSensitive: true } });
    expect(matches).toEqual([]);
  });
});
