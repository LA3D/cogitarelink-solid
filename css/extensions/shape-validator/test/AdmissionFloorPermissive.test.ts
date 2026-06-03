/**
 * AdmissionFloorStore — D73 permissive (/working/) tier, tested against the REAL
 * working shape (audit FOLLOWUPS #5).
 *
 * The former isPermissive('/working/') substring bypass was deleted. The claim it
 * encoded — "writes to /working/ are admitted" — is now carried by the DATA MODEL:
 * the working container's ldp:constrainedBy points at overlays/wiki-memory/shapes/
 * working.shacl.ttl, a permissive shape (sh:closed false, only an optional
 * dct:created) that any draft conforms to trivially. So validating the projected
 * graph against the working shape IS the policy.
 *
 * Unlike AdmissionFloorStore.test.ts, this file does NOT mock
 * validateQuadsAgainstShape — the REAL rdf-validate-shacl runs against the REAL
 * shape file, so what's under test is exactly the data-model-carries-the-policy
 * claim. Only fetchDataset is stubbed (to serve the on-disk shape without HTTP).
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const WORKING_SHAPE_TTL = readFileSync(
  join(__dirname, "..", "..", "..", "..", "overlays", "wiki-memory", "shapes", "working.shacl.ttl"),
  "utf8",
);
const CONCEPT_SHAPE_TTL = readFileSync(
  join(__dirname, "..", "..", "..", "..", "overlays", "wiki-memory", "shapes", "concept.shacl.ttl"),
  "utf8",
);

// Serve the requested shape file as a REAL parsed quad stream. NO conformance mock —
// validateQuadsAgainstShape (rdf-validate-shacl) runs for real over the shape's quads.
// The floor's shapeStore() does fetchDataset(url) → readableToQuads(rep.data), and
// readableToQuads expects an INTERNAL_QUADS (RDF/JS quad-object) stream — NOT a turtle
// string — so we parse the TTL with N3 here and hand back the quads, exactly the shape
// readableToQuads consumes in production.
vi.mock("@solid/community-server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solid/community-server")>();
  const { BasicRepresentation } = actual;
  const { Parser } = await import("n3");
  return {
    ...actual,
    fetchDataset: vi.fn(async (url: string) => {
      const ttl = url.includes("working") ? WORKING_SHAPE_TTL : CONCEPT_SHAPE_TTL;
      const quads = new Parser().parse(ttl);
      return new BasicRepresentation(quads, "internal/quads");
    }),
  };
});

import { BasicRepresentation, RepresentationMetadata } from "@solid/community-server";
import { DataFactory } from "n3";
import { ShaclValidationError } from "../src/error/ShaclValidationError";
import { LDP } from "../src/util/Vocabularies";
import { AdmissionFloorStore } from "../src/storage/AdmissionFloorStore";

const { namedNode, quad, literal } = DataFactory;

const WORKING_CONTAINER = "https://pod.example.org/wiki/working/";
const WORKING_SHAPE_URL = "https://pod.example.org/shapes/working.shacl.ttl";
const WORKING_RESOURCE = "https://pod.example.org/wiki/working/draft.md";

const CONCEPT_CONTAINER = "https://pod.example.org/wiki/concepts/";
const CONCEPT_SHAPE_URL = "https://pod.example.org/shapes/concept.shacl.ttl";
const CONCEPT_RESOURCE = "https://pod.example.org/wiki/concepts/photosynthesis.md";

const WIKI_WORKING_NOTE = "https://pod.vardeman.me/vault/ontology/wiki#WorkingNote";
const SKOS_CONCEPT = "http://www.w3.org/2004/02/skos/core#Concept";
const SKOS_PREFLABEL = "http://www.w3.org/2004/02/skos/core#prefLabel";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

function md(path: string, body = "# body") {
  const meta = new RepresentationMetadata({ path }, "text/markdown");
  return new BasicRepresentation(body, meta);
}

function parentRep(shapeUrl: string) {
  const meta = new RepresentationMetadata({ path: WORKING_CONTAINER });
  meta.add(LDP.terms.constrainedBy, namedNode(shapeUrl));
  return new BasicRepresentation("", meta);
}

function makeStrategies(container: string, shapeUrl: string) {
  const identifierStrategy = {
    isRootContainer: () => false,
    getParentContainer: () => ({ path: container }),
  } as any;
  const auxiliaryStrategy = {
    isAuxiliaryIdentifier: (id: { path: string }) => id.path.endsWith(".meta"),
    getSubjectIdentifier: (id: { path: string }) => ({ path: id.path.replace(/\.meta$/, "") }),
  } as any;
  const source = {
    getRepresentation: vi.fn(async () => parentRepFor(container, shapeUrl)),
    setRepresentation: vi.fn(async () => new Map() as any),
    addResource: vi.fn(async () => new Map() as any),
    deleteResource: vi.fn(async () => new Map() as any),
  };
  return { identifierStrategy, auxiliaryStrategy, source };
}

function parentRepFor(container: string, shapeUrl: string) {
  const meta = new RepresentationMetadata({ path: container });
  meta.add(LDP.terms.constrainedBy, namedNode(shapeUrl));
  return new BasicRepresentation("", meta);
}

function makeProjector(projection: any) {
  return {
    canProject: vi.fn((rep: any) => rep.metadata.contentType === "text/markdown"),
    project: vi.fn(async () => projection),
    materialize: vi.fn(async () => undefined),
  };
}

describe("AdmissionFloorStore — permissive working tier via the REAL working shape", () => {
  it("admits a draft whose projected graph conforms to working.shacl.ttl (data model is the policy)", async () => {
    // A WorkingNote with no mandatory predicates — conforms trivially to the
    // permissive shape (sh:closed false, only an optional dct:created).
    const projection = {
      quads: [quad(namedNode(WORKING_RESOURCE + "#this"), namedNode(RDF_TYPE), namedNode(WIKI_WORKING_NOTE))],
      governed: [],
    };
    const { identifierStrategy, auxiliaryStrategy, source } = makeStrategies(WORKING_CONTAINER, WORKING_SHAPE_URL);
    const projector = makeProjector(projection);
    const store = new AdmissionFloorStore(source as any, identifierStrategy, auxiliaryStrategy, projector as any);

    await expect(
      store.setRepresentation({ path: WORKING_RESOURCE }, md(WORKING_RESOURCE, "draft body")),
    ).resolves.toBeDefined();
    // Admitted: committed AND materialized — no special bypass needed.
    expect(source.setRepresentation).toHaveBeenCalledTimes(1);
    expect(projector.materialize).toHaveBeenCalledTimes(1);
  });

  it("admits a draft carrying an arbitrary extra predicate (sh:closed false)", async () => {
    const projection = {
      quads: [
        quad(namedNode(WORKING_RESOURCE + "#this"), namedNode(RDF_TYPE), namedNode(WIKI_WORKING_NOTE)),
        quad(namedNode(WORKING_RESOURCE + "#this"), namedNode("https://example.org/scratch"), literal("anything")),
      ],
      governed: [],
    };
    const { identifierStrategy, auxiliaryStrategy, source } = makeStrategies(WORKING_CONTAINER, WORKING_SHAPE_URL);
    const projector = makeProjector(projection);
    const store = new AdmissionFloorStore(source as any, identifierStrategy, auxiliaryStrategy, projector as any);

    await expect(
      store.setRepresentation({ path: WORKING_RESOURCE }, md(WORKING_RESOURCE, "draft")),
    ).resolves.toBeDefined();
    expect(source.setRepresentation).toHaveBeenCalledTimes(1);
  });

  it("admits a working .meta draft graph (no permissive bypass — the shape conforms)", async () => {
    const { identifierStrategy, auxiliaryStrategy, source } = makeStrategies(WORKING_CONTAINER, WORKING_SHAPE_URL);
    const projector = makeProjector(null);
    const store = new AdmissionFloorStore(source as any, identifierStrategy, auxiliaryStrategy, projector as any);

    // Direct .meta write: the floor now validates it (no /working/ skip). A draft
    // graph conforms to the permissive shape, so it commits.
    const metaMeta = new RepresentationMetadata({ path: WORKING_RESOURCE + ".meta" }, "text/turtle");
    const metaRep = new BasicRepresentation(
      `<${WORKING_RESOURCE}#this> a <${WIKI_WORKING_NOTE}> .`,
      metaMeta,
    );
    await expect(
      store.setRepresentation({ path: WORKING_RESOURCE + ".meta" }, metaRep),
    ).resolves.toBeDefined();
    expect(source.setRepresentation).toHaveBeenCalledTimes(1);
  });

  it("CONTRAST: the SAME under-specified draft is REJECTED under a durable (concept) shape", async () => {
    // The exact graph admitted above (a bare typed thing, no prefLabel) is rejected
    // against the strict concept shape — proving the working shape's permissiveness
    // is what admits the draft, not a path bypass.
    const projection = {
      quads: [quad(namedNode(CONCEPT_RESOURCE + "#this"), namedNode(RDF_TYPE), namedNode(SKOS_CONCEPT))],
      governed: [SKOS_PREFLABEL],
    };
    const { identifierStrategy, auxiliaryStrategy, source } = makeStrategies(CONCEPT_CONTAINER, CONCEPT_SHAPE_URL);
    const projector = makeProjector(projection);
    const store = new AdmissionFloorStore(source as any, identifierStrategy, auxiliaryStrategy, projector as any);

    await expect(
      store.setRepresentation({ path: CONCEPT_RESOURCE }, md(CONCEPT_RESOURCE, "# (no prefLabel)")),
    ).rejects.toBeInstanceOf(ShaclValidationError);
    expect(source.setRepresentation).not.toHaveBeenCalled();
  });
});
