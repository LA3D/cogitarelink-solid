// An assertion is TBox (ontological) if its predicate is a KR/foundational schema term, OR it types
// the subject AS a KR metaclass. Otherwise ABox (ordinary data). krTerms = the IRI set loaded from
// the foundational-ontology cache (ontology/{rdf,rdfs,owl}.ttl…).
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

export function classifyAssertion(predIRI: string, objIRI: string, krTerms: Set<string>): "abox" | "tbox" {
  if (krTerms.has(predIRI) && predIRI !== RDF_TYPE) return "tbox";
  if (predIRI === RDF_TYPE && krTerms.has(objIRI)) return "tbox";
  return "abox";
}
