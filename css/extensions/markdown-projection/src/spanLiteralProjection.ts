import { DataFactory, Quad, NamedNode } from "n3";
import { parseSpanLiterals } from "../../shared/markdown-parsing/src/spanLiterals.js";
const { namedNode, literal, quad } = DataFactory;

// CURIE→IRI for datatypes (xsd: only for MVP; extend from context.jsonld if needed)
const XSD = "http://www.w3.org/2001/XMLSchema#";
function datatypeIRI(curie?: string): NamedNode | undefined {
  if (!curie) return undefined;
  const [pfx, local] = curie.split(":");
  if (pfx === "xsd") return namedNode(XSD + local);
  throw new Error(`unbound datatype prefix: ${pfx}`);
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
