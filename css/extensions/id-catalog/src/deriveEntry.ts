// Pure derivation + guard logic for the server-managed catalog (D111 §4.4).
// The thin entry is the NORMATIVE set from the spec — nothing else is copied.
// No CSS imports: this module is pure (n3 only) so it is unit-testable without
// the CSS class graph.
import { DataFactory, Parser } from "n3";
import type { Quad, NamedNode, Literal } from "@rdfjs/types";
const { namedNode, quad } = DataFactory;

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SKOS = "http://www.w3.org/2004/02/skos/core#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const FOAF = "http://xmlns.com/foaf/0.1/";

export const catalogFragmentRe = (catalogUrl: string): RegExp =>
  new RegExp(`^${catalogUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}#`);

// Derive the thin catalog entry for one record. quads = the record's parsed body
// (baseIRI = record URL). Returns null when the record lacks a catalog-fragment
// foaf:primaryTopic (the floor should have rejected it; belt-and-suspenders).
export function deriveThinEntry(quads: Quad[], recordUrl: string, catalogUrl: string): Quad[] | null {
  const frag = catalogFragmentRe(catalogUrl);
  const topic = quads.find(q =>
    q.subject.value === recordUrl &&
    q.predicate.value === `${FOAF}primaryTopic` &&
    frag.test(q.object.value))?.object;
  if (!topic) return null;
  const label = quads.find(q =>
    q.subject.value === topic.value && q.predicate.value === `${SKOS}prefLabel`)?.object;
  const types = quads.filter(q =>
    q.subject.value === topic.value && q.predicate.value === RDF_TYPE);
  const t = namedNode(topic.value);
  const out: Quad[] = types.map(q => quad(t, namedNode(RDF_TYPE), q.object as NamedNode | Literal));
  if (label) out.push(quad(t, namedNode(`${SKOS}prefLabel`), label as NamedNode | Literal));
  out.push(quad(t, namedNode(`${SKOS}inScheme`), namedNode(catalogUrl)));
  out.push(quad(t, namedNode(`${RDFS}isDefinedBy`), namedNode(catalogUrl)));
  out.push(quad(t, namedNode(`${FOAF}isPrimaryTopicOf`), namedNode(recordUrl)));
  return out;
}

// Parse an N3 Patch body and return the catalog-fragment subjects it touches.
// Quoted graphs (solid:inserts/solid:deletes) parse as N3 formulas — walk ALL
// quads regardless of graph term. Used by IdCatalogStore to reject client
// patches that touch server-derived triples (ldp:contains precedent).
export function findDerivedSubjects(patchBody: string, catalogUrl: string): string[] {
  const frag = catalogFragmentRe(catalogUrl);
  const quads = new Parser({ format: "text/n3", baseIRI: catalogUrl }).parse(patchBody);
  return [...new Set(quads.map(q => q.subject.value).filter(v => frag.test(v)))];
}
