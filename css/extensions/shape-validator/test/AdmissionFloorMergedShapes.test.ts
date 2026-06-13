/**
 * AdmissionFloorStore — plural ldp:constrainedBy + merged-shape class dispatch
 * (C-T2b; D108 §1.5: container = the shape SET, class = dispatch by sh:targetClass).
 *
 * concepts/ holds BOTH skos:Concept and wiki:Source resources (D98). Its container
 * .meta declares TWO ldp:constrainedBy docs (concept.shacl.ttl + source.shacl.ttl).
 * The floor must fetch BOTH, MERGE the quads into one shape store, and validate the
 * projected graph against the union. SHACL then dispatches by class naturally:
 *   - a wiki:Source node matches sh:targetClass wiki:Source (SourceShape), whose
 *     sh:node wiki:ConceptShape resolves in the merged store → identifier + prefLabel
 *     are both required;
 *   - a plain skos:Concept node does NOT match sh:targetClass wiki:Source → SourceShape
 *     is INERT (no spurious 422 for a concept that has no dct:identifier).
 *
 * Like AdmissionFloorPermissive.test.ts, this file does NOT mock
 * validateQuadsAgainstShape — REAL rdf-validate-shacl runs over the REAL overlay shapes,
 * so the dispatch behavior is what is genuinely under test. Only fetchDataset is stubbed
 * (to serve the on-disk shapes without HTTP), and the floor's real shapeStore() merge runs.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SHAPES = join(__dirname, "..", "..", "..", "..", "overlays", "wiki-memory", "shapes");
const CONCEPT_SHAPE_TTL = readFileSync(join(SHAPES, "concept.shacl.ttl"), "utf8");
const SOURCE_SHAPE_TTL = readFileSync(join(SHAPES, "source.shacl.ttl"), "utf8");

// Serve each requested shape file as a REAL parsed quad stream (internal/quads), keyed by
// the URL basename. NO conformance mock — the floor's merge + rdf-validate-shacl run for real.
vi.mock("@solid/community-server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solid/community-server")>();
  const { BasicRepresentation } = actual;
  const { Parser } = await import("n3");
  return {
    ...actual,
    fetchDataset: vi.fn(async (url: string) => {
      const ttl = url.includes("source") ? SOURCE_SHAPE_TTL : CONCEPT_SHAPE_TTL;
      return new BasicRepresentation(new Parser().parse(ttl), "internal/quads");
    }),
  };
});

import { BasicRepresentation, RepresentationMetadata, fetchDataset } from "@solid/community-server";
import { DataFactory } from "n3";
import { ShaclValidationError } from "../src/error/ShaclValidationError";
import { LDP } from "../src/util/Vocabularies";
import { AdmissionFloorStore } from "../src/storage/AdmissionFloorStore";

const { namedNode, quad, literal } = DataFactory;

const CONTAINER = "https://pod.example.org/wiki/concepts/";
const CONCEPT_SHAPE_URL = "https://pod.example.org/vault/meta/shapes/concept.shacl.ttl";
const SOURCE_SHAPE_URL = "https://pod.example.org/vault/meta/shapes/source.shacl.ttl";
const RESOURCE = "https://pod.example.org/wiki/concepts/paper.md";

const SKOS = "http://www.w3.org/2004/02/skos/core#";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const WIKI_SOURCE = "https://pod.vardeman.me/vault/ontology/wiki#Source";
const SKOS_CONCEPT = SKOS + "Concept";
const SKOS_PREFLABEL = SKOS + "prefLabel";
const DCT_IDENTIFIER = "http://purl.org/dc/terms/identifier";

function md(path: string, body = "# body") {
  return new BasicRepresentation(body, new RepresentationMetadata({ path }, "text/markdown"));
}

// Parent container declaring BOTH constrainedBy docs (the dual-shape concepts/ floor).
function dualParentRep() {
  const meta = new RepresentationMetadata({ path: CONTAINER });
  meta.add(LDP.terms.constrainedBy, namedNode(CONCEPT_SHAPE_URL));
  meta.add(LDP.terms.constrainedBy, namedNode(SOURCE_SHAPE_URL));
  return new BasicRepresentation("", meta);
}

function makeStrategies() {
  const identifierStrategy = {
    isRootContainer: () => false,
    getParentContainer: () => ({ path: CONTAINER }),
  } as any;
  const auxiliaryStrategy = {
    isAuxiliaryIdentifier: (id: { path: string }) => id.path.endsWith(".meta"),
    getSubjectIdentifier: (id: { path: string }) => ({ path: id.path.replace(/\.meta$/, "") }),
  } as any;
  const source = {
    getRepresentation: vi.fn(async () => dualParentRep()),
    setRepresentation: vi.fn(async () => new Map() as any),
    addResource: vi.fn(async () => new Map() as any),
    deleteResource: vi.fn(async () => new Map() as any),
  };
  return { identifierStrategy, auxiliaryStrategy, source };
}

function makeProjector(projection: any) {
  return {
    version: "9.9.9-test",
    canProject: vi.fn((rep: any) => rep.metadata.contentType === "text/markdown"),
    project: vi.fn(async () => projection),
    snapshot: vi.fn(async () => ({ oldBody: null, oldMetaTtl: null })),
    materialize: vi.fn(async () => undefined),
  };
}

function makeStore(projection: any) {
  const { identifierStrategy, auxiliaryStrategy, source } = makeStrategies();
  const projector = makeProjector(projection);
  const store = new AdmissionFloorStore(source as any, identifierStrategy, auxiliaryStrategy, projector as any);
  return { store, source, projector };
}

describe("AdmissionFloorStore — plural constrainedBy + merged-shape class dispatch", () => {
  it("(a) a wiki:Source missing dct:identifier is REJECTED against the merged {concept,source} store", async () => {
    // Has prefLabel (so ConceptShape's minCount passes) but NO dct:identifier — SourceShape's
    // dct:identifier minCount 1 fires (matched via sh:targetClass wiki:Source).
    const projection = {
      quads: [
        quad(namedNode(RESOURCE + "#this"), namedNode(RDF_TYPE), namedNode(WIKI_SOURCE)),
        quad(namedNode(RESOURCE + "#this"), namedNode(SKOS_PREFLABEL), literal("Some Paper")),
      ],
      governed: [SKOS_PREFLABEL],
    };
    const { store, source, projector } = makeStore(projection);
    await expect(
      store.setRepresentation({ path: RESOURCE }, md(RESOURCE, "source, no identifier")),
    ).rejects.toBeInstanceOf(ShaclValidationError);
    expect(source.setRepresentation).not.toHaveBeenCalled();
    expect(projector.materialize).not.toHaveBeenCalled();
  });

  it("(b) a wiki:Source WITH dct:identifier + prefLabel CONFORMS to both merged shapes", async () => {
    const projection = {
      quads: [
        quad(namedNode(RESOURCE + "#this"), namedNode(RDF_TYPE), namedNode(WIKI_SOURCE)),
        quad(namedNode(RESOURCE + "#this"), namedNode(SKOS_PREFLABEL), literal("Some Paper")),
        quad(namedNode(RESOURCE + "#this"), namedNode(DCT_IDENTIFIER), literal("10.1234/abc")),
      ],
      governed: [SKOS_PREFLABEL, DCT_IDENTIFIER],
    };
    const { store, source, projector } = makeStore(projection);
    await expect(
      store.setRepresentation({ path: RESOURCE }, md(RESOURCE, "source with citekey")),
    ).resolves.toBeDefined();
    expect(source.setRepresentation).toHaveBeenCalledTimes(1);
    expect(projector.materialize).toHaveBeenCalledTimes(1);
  });

  it("(c) a plain skos:Concept (no Source type, no identifier) CONFORMS — SourceShape is INERT (no spurious 422)", async () => {
    // The no-spurious-422 proof: SourceShape's dct:identifier requirement targets
    // sh:targetClass wiki:Source, which this node is NOT, so it never fires here.
    const projection = {
      quads: [
        quad(namedNode(RESOURCE + "#this"), namedNode(RDF_TYPE), namedNode(SKOS_CONCEPT)),
        quad(namedNode(RESOURCE + "#this"), namedNode(SKOS_PREFLABEL), literal("Photosynthesis")),
      ],
      governed: [SKOS_PREFLABEL],
    };
    const { store, source } = makeStore(projection);
    await expect(
      store.setRepresentation({ path: RESOURCE }, md(RESOURCE, "plain concept, no identifier")),
    ).resolves.toBeDefined();
    expect(source.setRepresentation).toHaveBeenCalledTimes(1);
  });

  it("(d) getAll plurality: a dual-constrainedBy parent fetches BOTH shape docs (get would THROW on multiple)", async () => {
    (fetchDataset as any).mockClear();
    const projection = {
      quads: [
        quad(namedNode(RESOURCE + "#this"), namedNode(RDF_TYPE), namedNode(SKOS_CONCEPT)),
        quad(namedNode(RESOURCE + "#this"), namedNode(SKOS_PREFLABEL), literal("X")),
      ],
      governed: [SKOS_PREFLABEL],
    };
    const { store } = makeStore(projection);
    await store.setRepresentation({ path: RESOURCE }, md(RESOURCE, "concept"));
    // Both constrainedBy docs were dereferenced and merged — proving constrainedByFor
    // returned the FULL set (getAll), not a single value, and did not throw.
    const fetchedUrls = (fetchDataset as any).mock.calls.map((c: any[]) => c[0]);
    expect(fetchedUrls).toContain(CONCEPT_SHAPE_URL);
    expect(fetchedUrls).toContain(SOURCE_SHAPE_URL);
  });
});
