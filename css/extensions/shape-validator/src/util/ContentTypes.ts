// RDF serializations the validation layer recognizes. Single source — the
// ShaclValidator body gate and the AdmissionFloorStore .meta gate must agree.
export const RDF_CONTENT_TYPES: ReadonlySet<string> = new Set([
  'text/turtle', 'application/ld+json', 'application/n-triples',
  'application/n-quads', 'application/trig', 'text/n3', 'application/rdf+xml',
]);
