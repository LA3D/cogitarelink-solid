// subjectFrame.ts
//
// Decides whether a literal-span token attaches to the Page <> or the Thing
// <#this> (D95/D96/D108 Page+Thing split). Document-metadata predicates attach
// to <> (the Page); everything else (content) attaches to <#this> (the Thing).
// An explicit switch ("page"|"thing") overrides the default.
//
// R-T2 (audit R1.3): the page/thing partition is now DERIVED from
// governedPredicates.ts (the single source of the partition) instead of a
// hand-mirrored token set that had drifted. The old PAGE_PREDICATES set listed
// `identifier` as a page token, but dct:identifier is governed on the Thing
// <#this> — it is the Source shape's <#this>-scoped property (source.shacl.ttl,
// inheriting ConceptShape's `sub:governsSubject "<#this>"`), and it is NOT in
// PAGE_GOVERNED_PREDICATES. So a `[…]{.identifier}` literal span was being
// projected onto <> while governance deletes/replaces it on <#this> — the
// projected subject and the governed-delete subject disagreed, leaving stale or
// duplicate identifier triples on regovern. The fix routes the `identifier`
// token to the Thing frame, matching where its IRI sits in the governed
// partition. renderProjectionAgreement-style agreement is locked by
// subjectFrame.test.ts: every page-frame token's IRI must be in
// PAGE_GOVERNED_PREDICATES, and every thing-frame token's IRI must not be.

import { PAGE_GOVERNED_PREDICATES } from "./governedPredicates.js";

const DCT  = "http://purl.org/dc/terms/";
const WIKI = "https://pod.vardeman.me/vault/ontology/wiki#";

// Literal-axis token → IRI binding for the page-metadata tokens (the document
// description frame: <> dct:title, <> dct:created, …). The Thing-literal tokens
// (prefLabel/altLabel/definition) live in spanLiteralProjection's
// DEFAULT_LITERAL_BINDING; this binding is the page side. `identifier` →
// dct:identifier is included so the derivation below can PROVE it lands in the
// Thing frame (its IRI is not page-governed) rather than asserting it by hand.
export const PAGE_FRAME_TOKEN_BINDING: Record<string, string> = {
  title:      DCT  + "title",
  identifier: DCT  + "identifier",
  created:    DCT  + "created",
  modified:   DCT  + "modified",
  maturity:   WIKI + "maturity",
};

const PAGE_GOVERNED_IRIS = new Set(PAGE_GOVERNED_PREDICATES.map((n) => n.value));

// Page-frame tokens = those whose bound IRI is actually governed on <> (i.e. is
// in PAGE_GOVERNED_PREDICATES). Derived, not hand-listed, so the partition can
// never drift from governance. `identifier` falls out automatically: its IRI
// (dct:identifier) is NOT in PAGE_GOVERNED_PREDICATES, so it is a Thing token.
export const PAGE_FRAME_TOKENS: ReadonlySet<string> = new Set(
  Object.entries(PAGE_FRAME_TOKEN_BINDING)
    .filter(([, iri]) => PAGE_GOVERNED_IRIS.has(iri))
    .map(([tok]) => tok),
);

export function resolveSubject(pageUrl: string, predToken: string, sw?: "page" | "thing"): string {
  if (sw === "page") return pageUrl;
  if (sw === "thing") return `${pageUrl}#this`;
  return PAGE_FRAME_TOKENS.has(predToken) ? pageUrl : `${pageUrl}#this`;
}
