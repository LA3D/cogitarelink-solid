import { parseSearchTerms, MalformedSearchTermsError } from "./parseSearchTerms";
import type { SearchPattern } from "./SearchEngine";

export class MalformedQueryError extends Error {
  public readonly detail: string;
  public readonly example: string =
    'oslc.searchTerms=%22progressive%20disclosure%22,%22ESPRESSO%22';
  public constructor(detail: string) {
    super(detail);
    this.name = "MalformedQueryError";
    this.detail = detail;
  }
}

export interface ParsedQuery {
  pattern: SearchPattern;
  pageSize: number;
  startIndex: number;
  /** Deferred OSLC params present in the request (handler returns 501). */
  unsupported: string[];
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const DEFERRED_PARAMS = ["oslc.where", "oslc.select", "oslc.orderBy", "oslc.prefix"];

export function parseQuery(queryString: string): ParsedQuery {
  const qs = queryString.startsWith("?") ? queryString.slice(1) : queryString;
  const params = new URLSearchParams(qs);

  const rawTerms = params.get("oslc.searchTerms");
  if (rawTerms === null || rawTerms.length === 0) {
    throw new MalformedQueryError(
      "Missing required parameter: oslc.searchTerms",
    );
  }
  let terms: string[];
  try {
    terms = parseSearchTerms(rawTerms);
  } catch (e) {
    if (e instanceof MalformedSearchTermsError) {
      throw new MalformedQueryError(
        `Malformed oslc.searchTerms: ${e.message}. Got: ${e.input}`,
      );
    }
    throw e;
  }

  const pageSizeRaw = params.get("oslc.pageSize");
  let pageSize = DEFAULT_PAGE_SIZE;
  if (pageSizeRaw !== null) {
    const n = Number.parseInt(pageSizeRaw, 10);
    if (!Number.isInteger(n) || n < 1) {
      throw new MalformedQueryError(
        `Invalid oslc.pageSize: ${pageSizeRaw} (must be positive integer)`,
      );
    }
    pageSize = Math.min(n, MAX_PAGE_SIZE);
  }

  const startIndexRaw = params.get("oslc.startIndex");
  let startIndex = 0;
  if (startIndexRaw !== null) {
    const n = Number.parseInt(startIndexRaw, 10);
    if (!Number.isInteger(n) || n < 0) {
      throw new MalformedQueryError(
        `Invalid oslc.startIndex: ${startIndexRaw} (must be non-negative integer)`,
      );
    }
    startIndex = n;
  }

  const unsupported = DEFERRED_PARAMS.filter((p) => params.has(p));

  return {
    pattern: { terms },
    pageSize,
    startIndex,
    unsupported,
  };
}
