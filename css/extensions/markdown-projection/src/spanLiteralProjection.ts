import { DataFactory, Quad, NamedNode } from "n3";
import { parseSpanLiterals } from "../../shared/markdown-parsing/src/spanLiterals.js";
import { resolveSubject } from "./subjectFrame.js";
const { namedNode, literal, quad } = DataFactory;

// Datatype CURIE prefixes (D111 §6.2). Code-constant + agreement-test idiom, the
// same governance as CURIE_PREFIXES in frontmatterProjection.ts: the served
// context (overlays/wiki-memory/context-fragment.jsonld) carries matching
// declarations and the agreement tests assert the mirror. Unknown prefix =>
// plain literal, never a throw (suggestive typing — Tier-2 curation flags it;
// the D50 silent-drop convention). Unbound PREDICATES still throw (governance).
const XSD = "http://www.w3.org/2001/XMLSchema#";
export const DATATYPE_PREFIXES: Readonly<Record<string, string>> = {
  xsd: XSD,
  ids: "https://pod.vardeman.me/id/schemes/#",
};
function datatypeIRI(curie?: string): NamedNode | undefined {
  if (!curie) return undefined;
  const [pfx, local] = curie.split(":");
  const ns = DATATYPE_PREFIXES[pfx];
  return ns ? namedNode(ns + local) : undefined;  // unknown → plain literal
}

// binding: token → predicate IRI (read from the served context.jsonld / governedPredicates later)
export function projectSpanLiterals(body: string, subject: NamedNode, binding: Record<string, string>): Quad[] {
  return parseSpanLiterals(body).map((s) => {
    const predIRI = binding[s.pred];
    if (!predIRI) throw new Error(`unbound predicate: ${s.pred}`);
    const obj = s.lang ? literal(s.text, s.lang)
      : s.datatype ? literal(s.text, datatypeIRI(s.datatype))
      : literal(s.text);
    return quad(subject, namedNode(predIRI), obj);
  });
}

// The literal-axis binding the substrate was missing (skos literals on <#this> per ConceptShape /
// governedPredicates). Token → predicate IRI. Edges (broader, cites, source…) are the wikilink axis.
export const DEFAULT_LITERAL_BINDING: Record<string, string> = {
  prefLabel:  "http://www.w3.org/2004/02/skos/core#prefLabel",
  altLabel:   "http://www.w3.org/2004/02/skos/core#altLabel",
  definition: "http://www.w3.org/2004/02/skos/core#definition",
};

// Parse spans once; resolve EACH span's subject by frame; build one literal quad per span.
// Different literal spans can resolve to different subjects (prefLabel → <#this>, title → <>),
// so we cannot project all spans to one subject — each span gets its own resolveSubject call.
export function projectSpanLiteralsFramed(body: string, pageUrl: string, binding: Record<string, string>): Quad[] {
  const out: Quad[] = [];
  for (const s of parseSpanLiterals(body)) {
    const predIRI = binding[s.pred];
    if (!predIRI) throw new Error(`unbound predicate: ${s.pred}`);
    const subject = namedNode(resolveSubject(pageUrl, s.pred));
    const obj = s.lang ? literal(s.text, s.lang)
      : s.datatype ? literal(s.text, datatypeIRI(s.datatype))
      : literal(s.text);
    out.push(quad(subject, namedNode(predIRI), obj));
  }
  return out;
}
