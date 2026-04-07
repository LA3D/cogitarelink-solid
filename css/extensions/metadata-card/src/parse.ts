// Parse a Turtle .meta sidecar with N3.js and extract the fields the card
// renderer cares about. Returns a structured ResourceMeta value rather than
// raw triples — the renderer is purely a view layer over this.

import { DataFactory, Parser, Store, type Quad, type Term } from "n3";

const { namedNode } = DataFactory;
import {
  PRED,
  TITLE_PREDICATES,
  DESCRIPTION_PREDICATES,
  RELATIONSHIP_PREDICATES,
  FORMAT_PREDICATES,
  SIZE_PREDICATES,
} from "./vocab.js";

export interface Relationship {
  predicate: string;       // full IRI
  label: string;           // display label, e.g. "Related"
  target: string;          // IRI or literal value of the related resource
  isIri: boolean;
}

export interface ResourceMeta {
  subject: string;             // resource IRI (whichever subject the .meta describes)
  title: string | null;
  description: string | null;
  types: string[];             // rdf:type values (full IRIs)
  format: string | null;       // dct:format / ma-ont:format
  created: string | null;
  modified: string | null;
  contributor: string | null;
  source: string | null;
  size: string | null;         // posix:size in bytes
  relationships: Relationship[];
  // Everything else, for the "All triples" detail section.
  otherTriples: { predicate: string; object: string; isIri: boolean }[];
}

function termValue(term: Term): { value: string; isIri: boolean } {
  return { value: term.value, isIri: term.termType === "NamedNode" };
}

function firstObject(
  store: Store,
  subjectIri: string,
  predicates: readonly string[],
): string | null {
  const subj = namedNode(subjectIri);
  for (const p of predicates) {
    const matches = store.getQuads(subj, namedNode(p), null, null);
    if (matches.length > 0) {
      return matches[0]!.object.value;
    }
  }
  return null;
}

// Pick the resource subject (as an IRI string). The .meta sidecar may have
// multiple subjects (e.g. a description of the file plus PROV activity
// nodes). Prefer the subject with the most triples — that's almost always
// the "main" resource the sidecar is describing.
function pickSubject(store: Store, hint: string | null): string {
  if (hint) {
    const matches = store.getQuads(namedNode(hint), null, null, null);
    if (matches.length > 0) return hint;
  }
  const subjectCounts = new Map<string, number>();
  for (const quad of store) {
    const key = quad.subject.value;
    subjectCounts.set(key, (subjectCounts.get(key) ?? 0) + 1);
  }
  if (subjectCounts.size === 0) {
    throw new Error("Empty .meta — no subjects to render");
  }
  let bestIri: string | null = null;
  let bestCount = -1;
  for (const [iri, count] of subjectCounts) {
    if (count > bestCount) { bestIri = iri; bestCount = count; }
  }
  return bestIri!;
}

export function parseMeta(turtle: string, opts: { subjectHint?: string } = {}): ResourceMeta {
  const parser = new Parser({ format: "text/turtle" });
  const store = new Store();
  const quads: Quad[] = parser.parse(turtle);
  store.addQuads(quads);

  const subjectIri = pickSubject(store, opts.subjectHint ?? null);
  const subject = namedNode(subjectIri);

  const types = store
    .getQuads(subject, namedNode(PRED.rdfType), null, null)
    .map((q) => q.object.value);

  const title = firstObject(store, subjectIri, TITLE_PREDICATES);
  const description = firstObject(store, subjectIri, DESCRIPTION_PREDICATES);
  const format = firstObject(store, subjectIri, FORMAT_PREDICATES);
  const created = firstObject(store, subjectIri, [PRED.dctCreated]);
  const modified = firstObject(store, subjectIri, [PRED.dctModified]);
  const contributor = firstObject(store, subjectIri, [PRED.dctContributor]);
  const source = firstObject(store, subjectIri, [PRED.dctSource]);
  const size = firstObject(store, subjectIri, SIZE_PREDICATES);

  // Build the relationships list in display order, capturing every object
  // for each known relationship predicate.
  const relationships: Relationship[] = [];
  for (const { iri, label } of RELATIONSHIP_PREDICATES) {
    const matches = store.getQuads(subject, namedNode(iri), null, null);
    for (const q of matches) {
      const { value, isIri } = termValue(q.object);
      relationships.push({ predicate: iri, label, target: value, isIri });
    }
  }

  // Everything else (predicates we haven't surfaced explicitly) goes into
  // a generic table for transparency.
  const handledPreds = new Set<string>([
    PRED.rdfType,
    ...TITLE_PREDICATES,
    ...DESCRIPTION_PREDICATES,
    ...FORMAT_PREDICATES,
    ...SIZE_PREDICATES,
    PRED.dctCreated,
    PRED.dctModified,
    PRED.dctContributor,
    PRED.dctSource,
    ...RELATIONSHIP_PREDICATES.map((r) => r.iri),
  ]);
  const otherTriples = store
    .getQuads(subject, null, null, null)
    .filter((q) => !handledPreds.has(q.predicate.value))
    .map((q) => {
      const { value, isIri } = termValue(q.object);
      return { predicate: q.predicate.value, object: value, isIri };
    });

  return {
    subject: subjectIri,
    title,
    description,
    types,
    format,
    created,
    modified,
    contributor,
    source,
    size,
    relationships,
    otherTriples,
  };
}
