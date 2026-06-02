// Frame defaults (D95/D96/D108): document-metadata predicates attach to <> (the Page);
// everything else (content) attaches to <#this> (the Thing). Explicit switch ("page"|"thing") overrides.
const PAGE_PREDICATES = new Set(["title", "identifier", "created", "modified", "maturity"]);

export function resolveSubject(pageUrl: string, predToken: string, sw?: "page" | "thing"): string {
  if (sw === "page") return pageUrl;
  if (sw === "thing") return `${pageUrl}#this`;
  return PAGE_PREDICATES.has(predToken) ? pageUrl : `${pageUrl}#this`;
}
