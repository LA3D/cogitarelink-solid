import { buildPagingUrl } from "./uri";

export interface ScoredResult {
  url: string;
  score: number;
  line: number;
  snippet: string;
}

/** Escape a string for a Turtle "..."-delimited literal (RFC 6906 / SPARQL 1.1 §19.7). */
function escapeTurtleLiteral(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

/**
 * Build the Turtle response body. Per OSLC Query 3.0 §6, the response is
 * an LDP BasicContainer carrying a typed oslc:ResponseInfo with paging
 * metadata. Members are ordered by score descending in the serialization
 * (RDF unordered, but the linear text order carries rank for clients
 * that don't parse).
 */
export function buildTurtleResponse(
  requestUrl: string,
  results: ScoredResult[],
  totalCount: number,
  startIndex: number,
  pageSize: number,
  termsDescription: string,
): string {
  const prefixes = [
    "@prefix oslc:  <http://open-services.net/ns/core#> .",
    "@prefix ldp:   <http://www.w3.org/ns/ldp#> .",
    "@prefix dct:   <http://purl.org/dc/terms/> .",
    "@prefix vault: <https://pod.vardeman.me/vault/ontology/wiki#> .",
    "",
  ].join("\n");

  const sortedResults = [...results].sort((a, b) => b.score - a.score);
  const memberList = sortedResults.length > 0
    ? sortedResults.map((r) => `        <${r.url}>`).join(" ,\n")
    : null;

  const hasNextPage = startIndex + pageSize < totalCount;
  const nextPageTriple = hasNextPage
    ? `    oslc:nextPage <${buildPagingUrl(requestUrl, startIndex + pageSize)}> ;\n`
    : "";

  const containsTriple = memberList
    ? `    ldp:contains\n${memberList} ;\n`
    : "";

  const head = [
    `<${requestUrl}>`,
    "    a ldp:BasicContainer, oslc:ResponseInfo ;",
    `    dct:title "Search results for: ${escapeTurtleLiteral(termsDescription)}" ;`,
    `    oslc:totalCount ${totalCount} ;`,
    nextPageTriple.trimEnd(),
    containsTriple ? containsTriple.trimEnd() : "    .",
  ]
    .filter((line) => line.length > 0)
    .join("\n");

  // If we have contains/nextPage, the head doesn't end with " ." — add it now.
  // The simplest sentinel is whether the last printed line ends with " ;".
  const headFinal = head.endsWith(";")
    ? head.slice(0, -1) + "."
    : head;

  const perResultBlocks = sortedResults.map((r) => {
    return [
      `<${r.url}>`,
      `    oslc:score ${r.score} ;`,
      `    vault:matchedLine ${r.line} ;`,
      `    vault:matchedContext "${escapeTurtleLiteral(r.snippet)}" .`,
    ].join("\n");
  });

  return [prefixes, headFinal, "", ...perResultBlocks].join("\n") + "\n";
}
