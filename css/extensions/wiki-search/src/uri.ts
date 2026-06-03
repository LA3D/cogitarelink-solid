// The wiki-memory L3 layout segment (mirrors markdown-projection's WIKI_SEGMENT).
// The segment is the profile's own container-layout constant; the storage ROOT
// (storagePath, default "/vault") is the deployment root and comes from config —
// threaded in via WikiSearchHttpHandler / WikiSearchLinkMetadataWriter, exactly
// as MarkdownProjectionListener threads storagePath (R-T4 / audit H1 / D107).
export const WIKI_SEGMENT = "wiki";

// Normalise a storagePath into a leading-slash, no-trailing-slash form, then
// derive the wiki-subtree prefix "<storagePath>/wiki/". Mirrors the listener's
// constructor normalisation so the two extensions agree on the same base.
export function wikiPrefix(storagePath: string): string {
  const sp = storagePath.startsWith("/") ? storagePath : `/${storagePath}`;
  const trimmed = sp.replace(/\/$/, "");
  return `${trimmed}/${WIKI_SEGMENT}/`;
}

export function isUnderBaseUrl(url: string, baseUrl: string): boolean {
  const trimmedBase = baseUrl.replace(/\/$/, "");
  return url.startsWith(trimmedBase + "/") || url === trimmedBase;
}

/**
 * Path-prefix check used by both the handler (which containers can dispatch
 * search-grep?) and the MetadataWriter (which container GETs get the Link
 * header?). Matches "<storagePath>/wiki/" exactly OR any descendant path.
 * The wikiPrefix is derived from the injected storagePath — no baked literal.
 */
export function isInWikiSubtree(url: string, prefix: string): boolean {
  try {
    const u = new URL(url);
    return u.pathname === prefix || u.pathname.startsWith(prefix);
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
