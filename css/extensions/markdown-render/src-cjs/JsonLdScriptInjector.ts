// Build a JSON-LD <script> block from a flat list of RDF triples.
//
// Why a <script> tag, not RDFa: D75 says rendered HTML carries semantic CSS
// classes only — no RDFa on body markup. JSON-LD inside <script> is cleanly
// separable from the HTML body (it sits in <head>), is the schema.org /
// NLWeb convention, and serves blind agents that fetched text/html but want
// structured data without a second round-trip to the .meta sidecar.
//
// Used by the markdown-render converter (src-cjs/converter.ts) after the
// rehype pipeline produces HTML — injected before </head>.

import { Quad } from "n3";

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

// Compact prefix set chosen to match the canonical context at
// /vault/meta/context.jsonld (D79). We emit them inline rather than
// referencing the external context so the JSON-LD is self-contained for
// agents that haven't fetched the context yet.
const DEFAULT_CONTEXT: Record<string, string> = {
  wiki: "https://pod.vardeman.me/vault/ontology/wiki#",
  dct:  "http://purl.org/dc/terms/",
  prof: "http://www.w3.org/ns/dx/prof/",
  ldp:  "http://www.w3.org/ns/ldp#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
};

export class JsonLdScriptInjector {
  public buildScriptTag(resourceIri: string, allTriples: Quad[]): string {
    const subjectTriples = allTriples.filter(
      (q) => q.subject.termType === "NamedNode" && q.subject.value === resourceIri,
    );
    if (subjectTriples.length === 0) {
      return "";
    }

    // Group object values by predicate IRI so multi-valued predicates round-trip
    // to JSON arrays. (e.g. dct:hasPart with N children → JSON list.)
    const byPredicate = new Map<string, string[]>();
    for (const q of subjectTriples) {
      const list = byPredicate.get(q.predicate.value) ?? [];
      list.push(q.object.value);
      byPredicate.set(q.predicate.value, list);
    }

    const jsonld: Record<string, unknown> = {
      "@context": DEFAULT_CONTEXT,
      "@id": resourceIri,
    };
    for (const [pred, values] of byPredicate.entries()) {
      const key = pred === RDF_TYPE ? "@type" : pred;
      jsonld[key] = values.length === 1 ? values[0] : values;
    }

    const payload = JSON.stringify(jsonld, null, 2);
    return `<script type="application/ld+json">\n${payload}\n</script>`;
  }
}
