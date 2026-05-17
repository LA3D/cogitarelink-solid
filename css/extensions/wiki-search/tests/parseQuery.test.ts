import { describe, it, expect } from "vitest";
import { parseQuery, MalformedQueryError } from "../src/parseQuery";

describe("parseQuery", () => {
  it("parses minimum required searchTerms", () => {
    const result = parseQuery('?ext=search-grep&oslc.searchTerms=%22agent%22');
    expect(result.pattern.terms).toEqual(["agent"]);
    expect(result.pageSize).toBe(25);
    expect(result.startIndex).toBe(0);
  });

  it("parses multiple terms", () => {
    const result = parseQuery(
      '?ext=search-grep&oslc.searchTerms=%22progressive%20disclosure%22,%22ESPRESSO%22'
    );
    expect(result.pattern.terms).toEqual(["progressive disclosure", "ESPRESSO"]);
  });

  it("honors oslc.pageSize within range", () => {
    const result = parseQuery('?ext=search-grep&oslc.searchTerms=%22x%22&oslc.pageSize=50');
    expect(result.pageSize).toBe(50);
  });

  it("clamps oslc.pageSize to max 100", () => {
    const result = parseQuery('?ext=search-grep&oslc.searchTerms=%22x%22&oslc.pageSize=500');
    expect(result.pageSize).toBe(100);
  });

  it("rejects oslc.pageSize=0 with 400", () => {
    expect(() => parseQuery('?ext=search-grep&oslc.searchTerms=%22x%22&oslc.pageSize=0'))
      .toThrow(MalformedQueryError);
  });

  it("rejects negative oslc.pageSize", () => {
    expect(() => parseQuery('?ext=search-grep&oslc.searchTerms=%22x%22&oslc.pageSize=-1'))
      .toThrow(MalformedQueryError);
  });

  it("honors oslc.startIndex", () => {
    const result = parseQuery('?ext=search-grep&oslc.searchTerms=%22x%22&oslc.startIndex=25');
    expect(result.startIndex).toBe(25);
  });

  it("rejects negative oslc.startIndex", () => {
    expect(() => parseQuery('?ext=search-grep&oslc.searchTerms=%22x%22&oslc.startIndex=-1'))
      .toThrow(MalformedQueryError);
  });

  it("rejects missing oslc.searchTerms", () => {
    expect(() => parseQuery('?ext=search-grep')).toThrow(MalformedQueryError);
  });

  it("rejects empty oslc.searchTerms", () => {
    expect(() => parseQuery('?ext=search-grep&oslc.searchTerms=')).toThrow(MalformedQueryError);
  });

  it("rejects unquoted oslc.searchTerms (delegates to parseSearchTerms)", () => {
    expect(() => parseQuery('?ext=search-grep&oslc.searchTerms=agent'))
      .toThrow(MalformedQueryError);
  });

  it("flags 501-style params (where, select, orderBy, prefix) for handler to 501", () => {
    const result = parseQuery(
      '?ext=search-grep&oslc.searchTerms=%22x%22&oslc.where=foo'
    );
    expect(result.unsupported).toContain("oslc.where");
  });

  it("decodes URL-encoded searchTerms before parsing", () => {
    const result = parseQuery('?ext=search-grep&oslc.searchTerms=%22hello%20world%22');
    expect(result.pattern.terms).toEqual(["hello world"]);
  });

  it("error preserves underlying parseSearchTerms error", () => {
    try {
      parseQuery('?ext=search-grep&oslc.searchTerms=unquoted');
    } catch (e) {
      expect(e).toBeInstanceOf(MalformedQueryError);
      expect((e as MalformedQueryError).example).toContain("%22");
    }
  });
});
