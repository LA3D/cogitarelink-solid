// detectClass.ts
//
// Extracts the rdf:type value from a projected quad array.
// Used by MarkdownProjectionListener to route to the correct
// governed-predicate set (D77 / governedPredicates.ts).

import type { Quad } from "n3";

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

export function detectClass(triples: Quad[]): string | undefined {
    const t = triples.find(q => q.predicate.value === RDF_TYPE);
    return t?.object.value;
}
