import { describe, it, expect } from "vitest";
import { parseSearchTerms, MalformedSearchTermsError } from "../src/parseSearchTerms";

describe("parseSearchTerms (strict OSLC §7.3)", () => {
  it("parses one quoted term", () => {
    expect(parseSearchTerms('"progressive disclosure"')).toEqual(["progressive disclosure"]);
  });

  it("parses two comma-separated quoted terms", () => {
    expect(parseSearchTerms('"progressive disclosure","ESPRESSO"'))
      .toEqual(["progressive disclosure", "ESPRESSO"]);
  });

  it("allows optional whitespace around commas", () => {
    expect(parseSearchTerms('"a" , "b"')).toEqual(["a", "b"]);
  });

  it("handles escaped double-quote inside a term", () => {
    expect(parseSearchTerms('"say \\"hi\\""')).toEqual(['say "hi"']);
  });

  it("handles escaped backslash inside a term", () => {
    expect(parseSearchTerms('"path\\\\file"')).toEqual(["path\\file"]);
  });

  it("rejects unquoted input", () => {
    expect(() => parseSearchTerms("progressive disclosure"))
      .toThrow(MalformedSearchTermsError);
  });

  it("rejects mixed quoted/unquoted", () => {
    expect(() => parseSearchTerms('"a",b')).toThrow(MalformedSearchTermsError);
  });

  it("rejects empty input", () => {
    expect(() => parseSearchTerms("")).toThrow(MalformedSearchTermsError);
  });

  it("rejects empty term (empty quoted string)", () => {
    expect(() => parseSearchTerms('""')).toThrow(MalformedSearchTermsError);
  });

  it("rejects trailing comma", () => {
    expect(() => parseSearchTerms('"a",')).toThrow(MalformedSearchTermsError);
  });

  it("rejects unterminated quote", () => {
    expect(() => parseSearchTerms('"unterminated')).toThrow(MalformedSearchTermsError);
  });

  it("error carries the offending input for problem+json", () => {
    try {
      parseSearchTerms("unquoted");
    } catch (e) {
      expect(e).toBeInstanceOf(MalformedSearchTermsError);
      expect((e as MalformedSearchTermsError).input).toBe("unquoted");
    }
  });
});
