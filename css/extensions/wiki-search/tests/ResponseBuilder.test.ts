import { describe, it, expect } from "vitest";
import { buildTurtleResponse, type ScoredResult } from "../src/ResponseBuilder";

describe("ResponseBuilder", () => {
  const requestUrl =
    "https://pod.vardeman.me/vault/wiki/?ext=search-grep&oslc.searchTerms=%22agent%22&oslc.pageSize=25";

  it("emits oslc:totalCount and ldp:contains for each result", () => {
    const results: ScoredResult[] = [
      {
        url: "https://pod.vardeman.me/vault/wiki/pages/agent-architecture.md",
        score: 87,
        line: 12,
        snippet: "…the [[Agent Architecture]] question is whether…",
      },
    ];
    const ttl = buildTurtleResponse(requestUrl, results, 1, 0, 25, "agent");
    expect(ttl).toContain("oslc:totalCount 1");
    expect(ttl).toContain("<https://pod.vardeman.me/vault/wiki/pages/agent-architecture.md>");
    expect(ttl).toContain("oslc:score 87");
    expect(ttl).toContain('vault:matchedLine 12');
    expect(ttl).toContain('vault:matchedContext');
  });

  it("emits oslc:nextPage when more results exist", () => {
    const ttl = buildTurtleResponse(requestUrl, [], 247, 0, 25, "agent");
    expect(ttl).toContain("oslc:nextPage");
    expect(ttl).toContain("oslc.startIndex=25");
  });

  it("omits oslc:nextPage on the last page", () => {
    const ttl = buildTurtleResponse(requestUrl, [], 30, 25, 25, "agent");
    expect(ttl).not.toContain("oslc:nextPage");
  });

  it("omits oslc:nextPage when startIndex+pageSize == totalCount exactly", () => {
    const ttl = buildTurtleResponse(requestUrl, [], 25, 0, 25, "agent");
    expect(ttl).not.toContain("oslc:nextPage");
  });

  it("orders ldp:contains by score descending", () => {
    const results: ScoredResult[] = [
      { url: "https://pod.vardeman.me/vault/wiki/pages/lo.md", score: 30, line: 1, snippet: "lo" },
      { url: "https://pod.vardeman.me/vault/wiki/pages/hi.md", score: 90, line: 1, snippet: "hi" },
    ];
    const ttl = buildTurtleResponse(requestUrl, results, 2, 0, 25, "x");
    const hiIdx = ttl.indexOf("/hi.md");
    const loIdx = ttl.indexOf("/lo.md");
    expect(hiIdx).toBeLessThan(loIdx);
  });

  it("handles empty result set", () => {
    const ttl = buildTurtleResponse(requestUrl, [], 0, 0, 25, "agent");
    expect(ttl).toContain("oslc:totalCount 0");
    expect(ttl).not.toContain("oslc:nextPage");
    expect(ttl).not.toContain("ldp:contains");
  });

  it("escapes special chars in snippet for Turtle string literal", () => {
    const results: ScoredResult[] = [
      {
        url: "https://pod.vardeman.me/vault/wiki/pages/q.md",
        score: 50,
        line: 1,
        snippet: 'with "quotes" and \\backslash',
      },
    ];
    const ttl = buildTurtleResponse(requestUrl, results, 1, 0, 25, "x");
    expect(ttl).toContain('\\"quotes\\"');
    expect(ttl).toContain("\\\\backslash");
  });

  it("includes a:ldp:BasicContainer and oslc:ResponseInfo types on the request URI", () => {
    const ttl = buildTurtleResponse(requestUrl, [], 0, 0, 25, "x");
    expect(ttl).toContain("a ldp:BasicContainer, oslc:ResponseInfo");
  });
});
