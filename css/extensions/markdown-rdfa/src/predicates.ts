// Mapping from typed-wikilink class attributes (D36) to RDFa property values
// (CURIEs that resolve via the prefix declarations on the rendered <html>).
//
// See SOLID-Pod-Decisions.md D36 and `Linked Data Affordances in Markdown` for
// the full design rationale.

export const PREDICATE_MAP: Record<string, string> = {
  related: "skos:related",
  source: "dct:source",
  extends: "vault:extends",
  criticizes: "vault:criticizes",
  supports: "vault:supports",
  partof: "dct:isPartOf",
};

// Default predicate when a wikilink has no {.class} attribute.
// D36: "An unattributed wikilink defaults to skos:related — the most common case."
export const DEFAULT_PREDICATE = "skos:related";

// CURIE prefix declarations attached to the <html> element so RDFa CURIEs resolve.
export const RDFA_PREFIX =
  "skos: http://www.w3.org/2004/02/skos/core# " +
  "dct: http://purl.org/dc/terms/ " +
  "vault: https://pod.vardeman.me/vault/ontology# " +
  "ldp: http://www.w3.org/ns/ldp#";
