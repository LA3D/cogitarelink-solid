import { DataFactory, Writer } from "n3";
import { buildPagingUrl } from "./uri";

const { namedNode, literal, quad } = DataFactory;

// Namespaces (mirrors memento/timemap.ts — the in-repo N3 Writer exemplar).
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const XSD = "http://www.w3.org/2001/XMLSchema#";
const OSLC = "http://open-services.net/ns/core#";
const LDP = "http://www.w3.org/ns/ldp#";
const DCT = "http://purl.org/dc/terms/";
const VAULT = "https://pod.vardeman.me/vault/ontology/wiki#";

const aType = namedNode(`${RDF}type`);
const aBasicContainer = namedNode(`${LDP}BasicContainer`);
const aResponseInfo = namedNode(`${OSLC}ResponseInfo`);
const pContains = namedNode(`${LDP}contains`);
const pTitle = namedNode(`${DCT}title`);
const pTotalCount = namedNode(`${OSLC}totalCount`);
const pNextPage = namedNode(`${OSLC}nextPage`);
const pScore = namedNode(`${OSLC}score`);
const pMatchedLine = namedNode(`${VAULT}matchedLine`);
const pMatchedContext = namedNode(`${VAULT}matchedContext`);
const xsdInteger = namedNode(`${XSD}integer`);

function intLit(n: number) {
  return literal(String(n), xsdInteger);
}

export interface ScoredResult {
  url: string;
  score: number;
  line: number;
  snippet: string;
}

/**
 * Build the Turtle response body via the n3 Writer (DataFactory quads), the
 * in-repo exemplar being memento/src/timemap.ts. Replaces the prior
 * string-concatenation + hand escaper + ";"-sentinel punctuation (audit M2):
 * literal escaping and statement punctuation are now the serializer's job, so
 * snippets with quotes/newlines/backslashes can't break the Turtle.
 *
 * Per OSLC Query 3.0 §6, the response is an LDP BasicContainer carrying a
 * typed oslc:ResponseInfo with paging metadata. ldp:contains members are
 * ordered by score descending in the serialization (RDF is unordered, but the
 * linear text order carries rank for clients that don't parse).
 */
export function buildTurtleResponse(
  requestUrl: string,
  results: ScoredResult[],
  totalCount: number,
  startIndex: number,
  pageSize: number,
  termsDescription: string,
): string {
  const writer = new Writer({
    prefixes: { oslc: OSLC, ldp: LDP, dct: DCT, vault: VAULT, xsd: XSD },
  });

  const subject = namedNode(requestUrl);
  const sorted = [...results].sort((a, b) => b.score - a.score);

  writer.addQuad(quad(subject, aType, aBasicContainer));
  writer.addQuad(quad(subject, aType, aResponseInfo));
  writer.addQuad(
    quad(subject, pTitle, literal(`Search results for: ${termsDescription}`)),
  );
  writer.addQuad(quad(subject, pTotalCount, intLit(totalCount)));

  if (startIndex + pageSize < totalCount) {
    writer.addQuad(
      quad(subject, pNextPage, namedNode(buildPagingUrl(requestUrl, startIndex + pageSize))),
    );
  }

  // ldp:contains members, in score-descending order.
  for (const r of sorted) {
    writer.addQuad(quad(subject, pContains, namedNode(r.url)));
  }

  // Per-result score/line/context.
  for (const r of sorted) {
    const m = namedNode(r.url);
    writer.addQuad(quad(m, pScore, intLit(r.score)));
    writer.addQuad(quad(m, pMatchedLine, intLit(r.line)));
    writer.addQuad(quad(m, pMatchedContext, literal(r.snippet)));
  }

  let out = "";
  writer.end((err, result) => {
    if (err) throw err;
    out = result;
  });
  return out;
}
