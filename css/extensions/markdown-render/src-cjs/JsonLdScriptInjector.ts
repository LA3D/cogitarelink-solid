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

import { Quad, Term } from "n3";

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const XSD_STRING = "http://www.w3.org/2001/XMLSchema#string";
const RDF_LANG_STRING = "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString";

// A single JSON-LD object-value node. NamedNodes become {@id} references
// (a relationship IRI), typed literals become {@value,@type}, language
// literals become {@value,@language}, and plain/string literals become bare
// strings (the JSON-LD convention: xsd:string carries no @type).
type JsonLdValue = string | { "@id": string } | { "@value": string; "@type"?: string; "@language"?: string };

// termType-aware projection of an object term (audit M3 / R1.4). The prior
// code pushed q.object.value for EVERY object, collapsing NamedNode (an IRI
// relationship) and Literal (a string value) into indistinguishable bare
// strings — so the injected JSON-LD couldn't tell a link from a literal.
function termToJsonLdValue(term: Term): JsonLdValue {
  if (term.termType === "NamedNode") {
    return { "@id": term.value };
  }
  // Literal (and, defensively, anything else) → value-shaped node.
  // n3 exposes datatype + language on Literal terms.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lit = term as any;
  const datatype: string | undefined = lit.datatype?.value;
  const language: string | undefined = lit.language && lit.language.length > 0 ? lit.language : undefined;
  if (language !== undefined && datatype === RDF_LANG_STRING) {
    return { "@value": term.value, "@language": language };
  }
  if (datatype !== undefined && datatype !== XSD_STRING) {
    return { "@value": term.value, "@type": datatype };
  }
  // Plain / xsd:string literal → bare string (no @type, per JSON-LD).
  return term.value;
}

// Compact prefix set chosen to match the canonical context at
// /vault/meta/context.jsonld (D79). We emit them inline rather than
// referencing the external context so the JSON-LD is self-contained for
// agents that haven't fetched the context yet.
// Exported so the context-agreement test (audit L2) can assert every prefix
// here maps to the SAME IRI the canonical served context (assembled from
// overlays/wiki-memory/context-fragment.jsonld) declares — i.e. this inline
// copy can't silently drift from the D79 source of truth.
export const DEFAULT_CONTEXT: Record<string, string> = {
  wiki: "https://pod.vardeman.me/vault/ontology/wiki#",
  dct:  "http://purl.org/dc/terms/",
  prof: "http://www.w3.org/ns/dx/prof/",
  ldp:  "http://www.w3.org/ns/ldp#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  ids:  "https://pod.vardeman.me/id/schemes/#",
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
    // rdf:type is special: JSON-LD requires @type values to be bare IRI/CURIE
    // strings (NOT {@id} nodes), so type objects keep their bare .value.
    const byPredicate = new Map<string, JsonLdValue[]>();
    for (const q of subjectTriples) {
      const isType = q.predicate.value === RDF_TYPE;
      const value: JsonLdValue = isType ? q.object.value : termToJsonLdValue(q.object);
      const list = byPredicate.get(q.predicate.value) ?? [];
      list.push(value);
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
