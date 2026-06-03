import { describe, it, expect } from "vitest";
import { Parser, Store } from "n3";
import { buildTurtleResponse, type ScoredResult } from "../src/ResponseBuilder";

// Parse-compare isomorphism (audit M2 / exemplar: projectionPipeline.test.ts's
// isographic helper). The N3 Writer rewrite must produce a graph IDENTICAL to
// the pre-rewrite hand-concatenated Turtle. We freeze the OLD function's exact
// output as a golden string (captured from the pre-R-T4 string-builder for the
// same inputs) and assert the new output parses to an isomorphic store —
// asserting graph equality, not byte-for-byte serialization.
function loadStore(ttl: string): Store {
  return new Store(new Parser().parse(ttl));
}
function isographic(a: Store, b: Store): boolean {
  if (a.size !== b.size) return false;
  return a
    .getQuads(null, null, null, null)
    .every((q) => b.countQuads(q.subject, q.predicate, q.object, null) > 0);
}

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

  it("is graph-isomorphic to the pre-rewrite string-builder output (audit M2)", () => {
    // GOLDEN: the EXACT output the pre-R-T4 hand-concatenated buildTurtleResponse
    // produced for these inputs (captured from git HEAD's implementation before
    // the N3 Writer rewrite). The snippet carries quotes + a backslash run — the
    // hardest case for the old hand escaper. We assert the new (Writer-produced)
    // output parses to an isomorphic store, not a byte-identical string.
    const GOLDEN = `@prefix oslc:  <http://open-services.net/ns/core#> .
@prefix ldp:   <http://www.w3.org/ns/ldp#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix vault: <https://pod.vardeman.me/vault/ontology/wiki#> .

<https://pod.vardeman.me/vault/wiki/?ext=search-grep&oslc.searchTerms=%22agent%22&oslc.pageSize=25>
    a ldp:BasicContainer, oslc:ResponseInfo ;
    dct:title "Search results for: agent, memory" ;
    oslc:totalCount 247 ;
    oslc:nextPage <https://pod.vardeman.me/vault/wiki/?ext=search-grep&oslc.searchTerms=%22agent%22&oslc.pageSize=25&oslc.startIndex=25> ;
    ldp:contains
        <https://pod.vardeman.me/vault/wiki/pages/hi.md> ,
        <https://pod.vardeman.me/vault/wiki/pages/lo.md> .

<https://pod.vardeman.me/vault/wiki/pages/hi.md>
    oslc:score 90 ;
    vault:matchedLine 3 ;
    vault:matchedContext "with \\"quotes\\" and \\\\\\\\back" .
<https://pod.vardeman.me/vault/wiki/pages/lo.md>
    oslc:score 30 ;
    vault:matchedLine 7 ;
    vault:matchedContext "plain" .
`;
    const reqUrl =
      "https://pod.vardeman.me/vault/wiki/?ext=search-grep&oslc.searchTerms=%22agent%22&oslc.pageSize=25";
    const results: ScoredResult[] = [
      { url: "https://pod.vardeman.me/vault/wiki/pages/hi.md", score: 90, line: 3, snippet: 'with "quotes" and \\\\back' },
      { url: "https://pod.vardeman.me/vault/wiki/pages/lo.md", score: 30, line: 7, snippet: "plain" },
    ];
    const neu = buildTurtleResponse(reqUrl, results, 247, 0, 25, "agent, memory");

    const expected = loadStore(GOLDEN);
    const actual = loadStore(neu);
    expect(isographic(actual, expected)).toBe(true);
    expect(isographic(expected, actual)).toBe(true);
    expect(actual.size).toBe(13);
  });
});
