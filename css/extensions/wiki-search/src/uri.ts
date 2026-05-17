const WIKI_PREFIX = "/vault/wiki/";

export function isUnderBaseUrl(url: string, baseUrl: string): boolean {
  const trimmedBase = baseUrl.replace(/\/$/, "");
  return url.startsWith(trimmedBase + "/") || url === trimmedBase;
}

/**
 * Path-prefix check used by both the handler (which containers can dispatch
 * search-grep?) and the MetadataWriter (which container GETs get the Link
 * header?). Matches /vault/wiki/ exactly OR any descendant path.
 */
export function isInWikiSubtree(url: string): boolean {
  try {
    const u = new URL(url);
    return u.pathname === WIKI_PREFIX || u.pathname.startsWith(WIKI_PREFIX);
  } catch {
    return false;
  }
}

/**
 * Build an oslc:nextPage URL by copying every query param of the current
 * request and overwriting oslc.startIndex. Preserves param order.
 */
export function buildPagingUrl(currentUrl: string, nextStartIndex: number): string {
  const u = new URL(currentUrl);
  u.searchParams.set("oslc.startIndex", String(nextStartIndex));
  return u.toString();
}
