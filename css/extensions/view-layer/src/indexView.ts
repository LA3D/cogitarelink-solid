import type { Quad } from "n3";

/**
 * The declared container-index projection (SP2; RQ-Discovery-1 fork a/d).
 * SAME TEXT as the role:mapping artifact in
 * overlays/wiki-memory/views/container-index.ttl — agreement-tested; edit both.
 */
export const INDEX_QUERY = `PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX schema: <https://schema.org/>
SELECT ?thing ?label ?def WHERE {
  { ?thing skos:prefLabel ?label } UNION { ?thing schema:name ?label }
  OPTIONAL { { ?thing skos:definition ?def } UNION { ?thing schema:description ?def } }
}`;

/**
 * Frontmatter `type:` token for the generated index document (SP2 amendment).
 * A CURIE the projection's CURIE_PREFIXES map already resolves
 * (sub: → https://pod.vardeman.me/vault/ontology/substrate#), so
 * `<#this> a sub:ContainerIndex` materializes through the EXISTING frontmatter
 * mechanism — frontmatter type wins over the container's D98 class fallback,
 * and no deployed shape targets sub:ContainerIndex, so the floor passes.
 */
export const INDEX_FRONTMATTER_TYPE = "sub:ContainerIndex";

const PREF = "http://www.w3.org/2004/02/skos/core#prefLabel";
const NAME = "https://schema.org/name";
const DEF = "http://www.w3.org/2004/02/skos/core#definition";
const DESC = "https://schema.org/description";

// Soft-wrapped span literals carry newlines through the projection (F3) —
// collapse all whitespace so every index entry stays a single line.
const ws = (s: string): string => s.replace(/\s+/g, " ").trim();

/** Definition-line index over a container's member `<...#this>` subjects. */
export function buildIndexMarkdown(containerUrl: string, quads: Quad[]): string {
  const bySubject = new Map<string, { label?: string; def?: string }>();
  for (const q of quads) {
    const s = q.subject.value;
    if (!s.startsWith(containerUrl)) continue;
    const entry = bySubject.get(s) ?? {};
    if ((q.predicate.value === PREF || q.predicate.value === NAME) && !entry.label) {
      entry.label = q.object.value;
    }
    if ((q.predicate.value === DEF || q.predicate.value === DESC) && !entry.def) {
      entry.def = q.object.value;
    }
    bySubject.set(s, entry);
  }
  const lines: string[] = [];
  for (const [subject, { label, def }] of bySubject) {
    if (!label) continue;
    const doc = subject.slice(containerUrl.length).replace(/#.*$/, "");
    if (!doc || doc === "index.md" || doc === "index") continue;
    const firstSentence = def ? ` — ${ws(def).split(/(?<=\.)\s+/)[0]}` : "";
    lines.push(`- [${ws(label)}](${doc})${firstSentence}`);
  }
  lines.sort((a, b) => a.localeCompare(b, "en"));
  return `---\ntype: ${INDEX_FRONTMATTER_TYPE}\n---\n# Index\n\nOne line per member; derived — see this document's .meta for derivation provenance.\n\n${lines.join("\n")}\n`;
}
