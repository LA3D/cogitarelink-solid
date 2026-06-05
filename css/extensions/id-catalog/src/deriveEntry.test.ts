/**
 * Unit tests for deriveEntry — the pure derivation + guard logic of the
 * server-managed identifier-scheme catalog (D111 §4.4).
 *
 * TDD-first: these tests pin the NORMATIVE thin-entry set from the spec and the
 * N3-Patch guard contract. No CSS imports — deriveEntry.ts is pure (n3 only).
 *
 * Fixtures use REAL idot terms (luiPattern / sampleId) under
 * http://identifiers.org/idot/ so the derivation runs against the vocabulary the
 * live scheme records actually carry.
 */
import { describe, it, expect } from "vitest";
import { DataFactory, Parser } from "n3";
import { deriveThinEntry, findDerivedSubjects, catalogFragmentRe } from "./deriveEntry.js";

const { namedNode } = DataFactory;

const CATALOG = "https://pod.vardeman.me/id/schemes/";
const RECORD = "https://pod.vardeman.me/id/schemes/doi";
const TOPIC = "https://pod.vardeman.me/id/schemes/#doi";

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SKOS = "http://www.w3.org/2004/02/skos/core#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const FOAF = "http://xmlns.com/foaf/0.1/";
const IDOT = "http://identifiers.org/idot/";

// A realistic DOI scheme record body (Turtle), parsed with baseIRI = record URL.
// The topic is a catalog fragment (<#doi> resolves against CATALOG, written here
// absolutely). Carries the 3 thin-entry types, prefLabel, and EXTRA triples
// (idot:luiPattern, idot:sampleId, skos:definition, skos:exactMatch) that must
// NOT be copied into the thin entry.
const DOI_RECORD = `
@prefix rdfs: <${RDFS}> .
@prefix skos: <${SKOS}> .
@prefix foaf: <${FOAF}> .
@prefix idot: <${IDOT}> .
@prefix datacite: <http://purl.org/spar/datacite/> .

<> foaf:primaryTopic <${TOPIC}> .

<${TOPIC}>
  a idot:Namespace, skos:Concept, rdfs:Datatype ;
  skos:prefLabel "DOI" ;
  skos:definition "Digital Object Identifier" ;
  skos:exactMatch datacite:doi ;
  idot:luiPattern "^10\\\\.\\\\d{4,9}/.+$" ;
  idot:sampleId "10.1038/nature12373" .
`;

function parse(ttl: string, baseIRI: string) {
  return new Parser({ baseIRI }).parse(ttl);
}

describe("deriveThinEntry", () => {
  it("derives EXACTLY the normative thin-entry set (3 types + prefLabel + inScheme + isDefinedBy + isPrimaryTopicOf)", () => {
    const quads = parse(DOI_RECORD, RECORD);
    const entry = deriveThinEntry(quads, RECORD, CATALOG);
    expect(entry).not.toBeNull();

    // 7 quads total.
    expect(entry!.length).toBe(7);

    // Every quad's subject is the topic fragment.
    for (const q of entry!) {
      expect(q.subject.value).toBe(TOPIC);
    }

    // Set-equality on (predicate, object) — the normative set, nothing else.
    const got = new Set(entry!.map((q) => `${q.predicate.value} ${q.object.value}`));
    const expected = new Set([
      `${RDF_TYPE} ${IDOT}Namespace`,
      `${RDF_TYPE} ${SKOS}Concept`,
      `${RDF_TYPE} ${RDFS}Datatype`,
      `${SKOS}prefLabel DOI`,
      `${SKOS}inScheme ${CATALOG}`,
      `${RDFS}isDefinedBy ${CATALOG}`,
      `${FOAF}isPrimaryTopicOf ${RECORD}`,
    ]);
    expect(got).toEqual(expected);
  });

  it("copies NONE of the record's extra triples (definition / exactMatch / luiPattern / sampleId)", () => {
    const quads = parse(DOI_RECORD, RECORD);
    const entry = deriveThinEntry(quads, RECORD, CATALOG)!;
    const preds = new Set(entry.map((q) => q.predicate.value));
    expect(preds.has(`${SKOS}definition`)).toBe(false);
    expect(preds.has(`${SKOS}exactMatch`)).toBe(false);
    expect(preds.has(`${IDOT}luiPattern`)).toBe(false);
    expect(preds.has(`${IDOT}sampleId`)).toBe(false);
  });

  it("preserves the prefLabel as a literal (value + language/datatype carried through)", () => {
    const quads = parse(DOI_RECORD, RECORD);
    const entry = deriveThinEntry(quads, RECORD, CATALOG)!;
    const label = entry.find((q) => q.predicate.value === `${SKOS}prefLabel`)!;
    expect(label.object.termType).toBe("Literal");
    expect(label.object.value).toBe("DOI");
  });

  it("returns null when the record has no catalog-fragment foaf:primaryTopic", () => {
    // primaryTopic points at the record itself (not a catalog fragment) → null.
    const body = `
@prefix foaf: <${FOAF}> .
@prefix skos: <${SKOS}> .
<> foaf:primaryTopic <${RECORD}#self> .
<${RECORD}#self> a skos:Concept ; skos:prefLabel "Nope" .
`;
    const quads = parse(body, RECORD);
    expect(deriveThinEntry(quads, RECORD, CATALOG)).toBeNull();
  });

  it("omits prefLabel from the entry when the topic has none (still derives the structural triples)", () => {
    const body = `
@prefix foaf: <${FOAF}> .
@prefix skos: <${SKOS}> .
<> foaf:primaryTopic <${TOPIC}> .
<${TOPIC}> a skos:Concept .
`;
    const quads = parse(body, RECORD);
    const entry = deriveThinEntry(quads, RECORD, CATALOG)!;
    // 1 type + inScheme + isDefinedBy + isPrimaryTopicOf = 4, no prefLabel.
    expect(entry.length).toBe(4);
    expect(entry.some((q) => q.predicate.value === `${SKOS}prefLabel`)).toBe(false);
  });
});

describe("findDerivedSubjects", () => {
  it("flags an N3 patch that INSERTS triples on a catalog fragment (<#fake>)", () => {
    const patch = `
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix skos: <${SKOS}> .
<> a solid:InsertDeletePatch ;
  solid:inserts {
    <${CATALOG}#fake> a skos:Concept ; skos:prefLabel "Sneaky" .
  } .
`;
    const subjects = findDerivedSubjects(patch, CATALOG);
    expect(subjects).toContain(`${CATALOG}#fake`);
  });

  it("returns [] for a patch touching only the container subject <> / catalog URL", () => {
    const patch = `
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix dct: <http://purl.org/dc/terms/> .
<> a solid:InsertDeletePatch ;
  solid:inserts {
    <${CATALOG}> dct:title "Identifier scheme catalog" .
  } .
`;
    const subjects = findDerivedSubjects(patch, CATALOG);
    expect(subjects).toEqual([]);
  });

  it("flags a fragment touched in a solid:deletes block too (delete is also a derived-triple write)", () => {
    const patch = `
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix skos: <${SKOS}> .
<> a solid:InsertDeletePatch ;
  solid:deletes {
    <${CATALOG}#doi> skos:prefLabel "DOI" .
  } .
`;
    const subjects = findDerivedSubjects(patch, CATALOG);
    expect(subjects).toContain(`${CATALOG}#doi`);
  });

  it("de-duplicates when a fragment subject appears in multiple triples", () => {
    const patch = `
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix skos: <${SKOS}> .
<> a solid:InsertDeletePatch ;
  solid:inserts {
    <${CATALOG}#fake> a skos:Concept ; skos:prefLabel "A" ; skos:inScheme <${CATALOG}> .
  } .
`;
    const subjects = findDerivedSubjects(patch, CATALOG);
    expect(subjects).toEqual([`${CATALOG}#fake`]);
  });
});

describe("catalogFragmentRe", () => {
  it("matches a fragment of the catalog URL but not the bare catalog or a sibling record", () => {
    const re = catalogFragmentRe(CATALOG);
    expect(re.test(`${CATALOG}#doi`)).toBe(true);
    expect(re.test(CATALOG)).toBe(false);
    expect(re.test(RECORD)).toBe(false);
  });
});
