/**
 * Single-resource search engine seam.
 *
 * Phase 1: RegexpSearchEngine. Phase 7b: BM25SearchEngine swaps in via
 * Components.js Override; the WikiSearchHttpHandler is unchanged.
 *
 * Engines are stateless and semantics-free: they return all per-term
 * matches on the body. AND-vs-OR combination is the handler's concern.
 */

export interface SearchPattern {
  /** OSLC §7.3 quoted phrases, post-parse. Each is one literal substring. */
  terms: string[];
  options?: SearchOptions;
}

export interface SearchOptions {
  /** Default false. Phase 1 always case-insensitive; reserved for smart-case future. */
  caseSensitive?: boolean;
  /** Default 50. Bound work per body so a pathological resource can't blow up the response. */
  maxMatchesPerResource?: number;
}

export interface Match {
  /** Byte offset into body where match starts. */
  offset: number;
  /** Length of matched substring (in characters). */
  length: number;
  /** 1-indexed line number, computed from offset for snippet rendering. */
  line: number;
  /** Which input term matched (so AND-filter and score can count distinct terms). */
  term: string;
}

export interface SearchEngine {
  /**
   * Search a single resource body. Returns matches in body order — caller
   * sorts/filters/scores. Empty array if no terms matched.
   */
  search(body: string, pattern: SearchPattern): Match[];
}
