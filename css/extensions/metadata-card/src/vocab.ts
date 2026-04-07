// Predicates and namespaces used by the metadata card renderer.
//
// These mirror what the cogitarelink-solid vault importer (`scripts/lib/rdf_gen.py`)
// emits into `.meta` sidecars: SKOS for labels, DCT for type/format/created/source,
// PROV for derivation, and the vault: namespace for typed relationships.

export const NS = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  skos: "http://www.w3.org/2004/02/skos/core#",
  dct: "http://purl.org/dc/terms/",
  prov: "http://www.w3.org/ns/prov#",
  ldp: "http://www.w3.org/ns/ldp#",
  maOnt: "http://www.w3.org/ns/ma-ont#",
  posixStat: "http://www.w3.org/ns/posix/stat#",
  vault: "https://pod.vardeman.me/vault/ontology#",
} as const;

export const PRED = {
  rdfType: NS.rdf + "type",
  rdfsLabel: NS.rdfs + "label",
  rdfsComment: NS.rdfs + "comment",
  skosPrefLabel: NS.skos + "prefLabel",
  skosRelated: NS.skos + "related",
  skosNote: NS.skos + "note",
  dctTitle: NS.dct + "title",
  dctDescription: NS.dct + "description",
  dctType: NS.dct + "type",
  dctFormat: NS.dct + "format",
  dctCreated: NS.dct + "created",
  dctModified: NS.dct + "modified",
  dctSource: NS.dct + "source",
  dctIsPartOf: NS.dct + "isPartOf",
  dctContributor: NS.dct + "contributor",
  maOntFormat: NS.maOnt + "format",
  posixSize: NS.posixStat + "size",
  posixMtime: NS.posixStat + "mtime",
  provWasDerivedFrom: NS.prov + "wasDerivedFrom",
  vaultExtends: NS.vault + "extends",
  vaultCriticizes: NS.vault + "criticizes",
  vaultSupports: NS.vault + "supports",
} as const;

// Predicates rendered in the "Relationships" section of the card.
// Order is the display order.
export const RELATIONSHIP_PREDICATES: { iri: string; label: string }[] = [
  { iri: PRED.skosRelated, label: "Related" },
  { iri: PRED.dctSource, label: "Source" },
  { iri: PRED.vaultExtends, label: "Extends" },
  { iri: PRED.vaultCriticizes, label: "Criticizes" },
  { iri: PRED.vaultSupports, label: "Supports" },
  { iri: PRED.dctIsPartOf, label: "Part of" },
  { iri: PRED.provWasDerivedFrom, label: "Derived from" },
];

// Predicates considered for the card's title — first hit wins.
export const TITLE_PREDICATES = [PRED.dctTitle, PRED.skosPrefLabel, PRED.rdfsLabel];

// Predicates considered for the description.
export const DESCRIPTION_PREDICATES = [
  PRED.dctDescription,
  PRED.rdfsComment,
  PRED.skosNote,
];

// Predicates considered for "format" — dct:format is standard but the
// cogitarelink-solid vault importer currently emits ma-ont:format for files,
// so accept either.
export const FORMAT_PREDICATES = [PRED.dctFormat, PRED.maOntFormat];

// Predicates considered for byte size (informational).
export const SIZE_PREDICATES = [PRED.posixSize];
