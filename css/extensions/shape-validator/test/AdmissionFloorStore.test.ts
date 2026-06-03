/**
 * Unit tests for AdmissionFloorStore (D108 Front-2 admission floor — markdown-body path).
 *
 * The floor cannot SHACL-validate a non-RDF body directly, so it asks a BodyProjector
 * to project the body into its candidate .meta graph, validates THAT against the
 * container's ldp:constrainedBy shape, rejects with a 422 (ShaclValidationError) on
 * non-conformance, and otherwise commits + materializes the admitted graph.
 *
 * Seam: validateQuadsAgainstShape and fetchDataset/readableToQuads are mocked so the
 * test controls conformance without a live Pod or real shape document. The PRODUCTION
 * floor code stays clean — the mock is test-only.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Control conformance per-test. The floor calls validateQuadsAgainstShape(dataStore, shapeStore).
const validateMock = vi.fn();
vi.mock("../src/storage/validators/validateQuadsAgainstShape.js", () => ({
  validateQuadsAgainstShape: (...args: unknown[]) => validateMock(...args),
}));

// Stub fetchDataset + readableToQuads so shapeStore() resolves without HTTP.
// Keep everything else from @solid/community-server real (PassthroughStore, helpers, AS…).
vi.mock("@solid/community-server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solid/community-server")>();
  return {
    ...actual,
    fetchDataset: vi.fn(async () => ({ data: "shape-stream" })),
    readableToQuads: vi.fn(async () => new (await import("n3")).Store()),
  };
});

import { Store, DataFactory } from "n3";
import { BasicRepresentation, RepresentationMetadata } from "@solid/community-server";
import { ShaclValidationError } from "../src/error/ShaclValidationError";
import { LDP } from "../src/util/Vocabularies";
import { AdmissionFloorStore, STAMP_PRED } from "../src/storage/AdmissionFloorStore";

const { namedNode, quad, literal } = DataFactory;

const CONTAINER = "https://pod.example.org/wiki/concepts/";
const RESOURCE = "https://pod.example.org/wiki/concepts/photosynthesis.md";
const SHAPE_URL = "https://pod.example.org/shapes/concept.shacl.ttl";
const SKOS_CONCEPT = "http://www.w3.org/2004/02/skos/core#Concept";
const SKOS_PREFLABEL = "http://www.w3.org/2004/02/skos/core#prefLabel";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

// --- fakes -----------------------------------------------------------------

function md(path: string, body = "# body") {
  const meta = new RepresentationMetadata({ path }, "text/markdown");
  return new BasicRepresentation(body, meta);
}

function ttl(path: string, body = "<#this> a <urn:T> .") {
  const meta = new RepresentationMetadata({ path }, "text/turtle");
  return new BasicRepresentation(body, meta);
}

// Parent container representation that declares ldp:constrainedBy (or not).
function parentRep(withConstraint: boolean) {
  const meta = new RepresentationMetadata({ path: CONTAINER });
  if (withConstraint) {
    meta.add(LDP.terms.constrainedBy, namedNode(SHAPE_URL));
  }
  return new BasicRepresentation("", meta);
}

function makeStrategies() {
  const identifierStrategy = {
    isRootContainer: (id: { path: string }) => id.path === "https://pod.example.org/",
    getParentContainer: (_id: { path: string }) => ({ path: CONTAINER }),
  } as any;
  const auxiliaryStrategy = {
    isAuxiliaryIdentifier: (id: { path: string }) => id.path.endsWith(".meta"),
  } as any;
  return { identifierStrategy, auxiliaryStrategy };
}

// Projected concept graph (page + thing + prefLabel) — governed includes prefLabel.
function conceptProjection() {
  return {
    quads: [
      quad(namedNode(RESOURCE + "#this"), namedNode(RDF_TYPE), namedNode(SKOS_CONCEPT)),
      quad(namedNode(RESOURCE + "#this"), namedNode(SKOS_PREFLABEL), literal("Photosynthesis")),
    ],
    governed: [SKOS_PREFLABEL],
  };
}

function makeProjector(projection: any) {
  return {
    canProject: vi.fn((rep: any) => rep.metadata.contentType === "text/markdown"),
    project: vi.fn(async () => projection),
    materialize: vi.fn(async () => undefined),
  };
}

function makeSource() {
  const created = { path: RESOURCE };
  const changes = new Map([[created, { has: () => true }]]) as any;
  return {
    getRepresentation: vi.fn(async () => parentRep(true)),
    setRepresentation: vi.fn(async () => new Map() as any),
    addResource: vi.fn(async () => changes),
    deleteResource: vi.fn(async () => new Map() as any),
  };
}

beforeEach(() => {
  validateMock.mockReset();
});

// --- PUT path (setRepresentation) ------------------------------------------

describe("AdmissionFloorStore.setRepresentation — markdown body path", () => {
  it("admits a conforming concept: commits the body AND materializes with the stamp predicate governed", async () => {
    validateMock.mockResolvedValue({ conforms: true });
    const { identifierStrategy, auxiliaryStrategy } = makeStrategies();
    const projector = makeProjector(conceptProjection());
    const source = makeSource();
    const store = new AdmissionFloorStore(source as any, identifierStrategy, auxiliaryStrategy, projector as any);

    await store.setRepresentation({ path: RESOURCE }, md(RESOURCE, "---\ntype: concept\n---\n# Photosynthesis"));

    expect(source.setRepresentation).toHaveBeenCalledTimes(1);
    expect(projector.materialize).toHaveBeenCalledTimes(1);
    const [, quads, governed] = projector.materialize.mock.calls[0];
    expect(governed).toContain(STAMP_PRED);
    expect(governed).toContain(SKOS_PREFLABEL);
    // stamp quad present on the resource subject
    const stamp = quads.find((q: any) => q.predicate.value === STAMP_PRED);
    expect(stamp).toBeTruthy();
    expect(stamp.subject.value).toBe(RESOURCE);
  });

  it("rejects a non-conforming concept: throws ShaclValidationError and does NOT commit", async () => {
    validateMock.mockResolvedValue({ conforms: false, reportTurtle: "@prefix sh: <#> . _:r a sh:ValidationReport ." });
    const { identifierStrategy, auxiliaryStrategy } = makeStrategies();
    const projector = makeProjector({ quads: [
      quad(namedNode(RESOURCE + "#this"), namedNode(RDF_TYPE), namedNode(SKOS_CONCEPT)),
    ], governed: [SKOS_PREFLABEL] });
    const source = makeSource();
    const store = new AdmissionFloorStore(source as any, identifierStrategy, auxiliaryStrategy, projector as any);

    await expect(
      store.setRepresentation({ path: RESOURCE }, md(RESOURCE, "---\ntype: concept\n---\n# (no prefLabel)")),
    ).rejects.toBeInstanceOf(ShaclValidationError);

    expect(source.setRepresentation).not.toHaveBeenCalled();
    expect(projector.materialize).not.toHaveBeenCalled();
  });

  it("passes RDF (non-markdown) bodies straight through: no project / validate / materialize", async () => {
    const { identifierStrategy, auxiliaryStrategy } = makeStrategies();
    const projector = makeProjector(conceptProjection());
    const source = makeSource();
    const store = new AdmissionFloorStore(source as any, identifierStrategy, auxiliaryStrategy, projector as any);

    await store.setRepresentation({ path: "https://pod.example.org/wiki/concepts/p.ttl" }, ttl("https://pod.example.org/wiki/concepts/p.ttl"));

    expect(source.setRepresentation).toHaveBeenCalledTimes(1);
    expect(projector.project).not.toHaveBeenCalled();
    expect(validateMock).not.toHaveBeenCalled();
    expect(projector.materialize).not.toHaveBeenCalled();
  });

  it("permissive /working/ path: admits + materializes a non-conforming body without throwing", async () => {
    validateMock.mockResolvedValue({ conforms: false, reportTurtle: "report" });
    const WORKING = "https://pod.example.org/wiki/working/draft.md";
    const projector = makeProjector({ quads: [
      quad(namedNode(WORKING + "#this"), namedNode(RDF_TYPE), namedNode(SKOS_CONCEPT)),
    ], governed: [SKOS_PREFLABEL] });
    const source = makeSource();
    // parent for /working/ also constrained
    source.getRepresentation = vi.fn(async () => parentRep(true)) as any;
    const identifierStrategy = {
      isRootContainer: () => false,
      getParentContainer: () => ({ path: "https://pod.example.org/wiki/working/" }),
    } as any;
    const auxiliaryStrategy = { isAuxiliaryIdentifier: (id: any) => id.path.endsWith(".meta") } as any;
    const store = new AdmissionFloorStore(source as any, identifierStrategy, auxiliaryStrategy, projector as any);

    await expect(
      store.setRepresentation({ path: WORKING }, md(WORKING, "draft")),
    ).resolves.toBeDefined();
    expect(source.setRepresentation).toHaveBeenCalledTimes(1);
    expect(projector.materialize).toHaveBeenCalledTimes(1);
  });

  it("auxiliary (.meta) writes pass straight through", async () => {
    const { identifierStrategy, auxiliaryStrategy } = makeStrategies();
    const projector = makeProjector(conceptProjection());
    const source = makeSource();
    const store = new AdmissionFloorStore(source as any, identifierStrategy, auxiliaryStrategy, projector as any);

    await store.setRepresentation({ path: RESOURCE + ".meta" }, md(RESOURCE + ".meta"));

    expect(source.setRepresentation).toHaveBeenCalledTimes(1);
    expect(projector.project).not.toHaveBeenCalled();
  });

  it("unconstrained container (no ldp:constrainedBy): passes straight through", async () => {
    const { identifierStrategy, auxiliaryStrategy } = makeStrategies();
    const projector = makeProjector(conceptProjection());
    const source = makeSource();
    source.getRepresentation = vi.fn(async () => parentRep(false)) as any;
    const store = new AdmissionFloorStore(source as any, identifierStrategy, auxiliaryStrategy, projector as any);

    await store.setRepresentation({ path: RESOURCE }, md(RESOURCE));

    expect(source.setRepresentation).toHaveBeenCalledTimes(1);
    expect(projector.project).not.toHaveBeenCalled();
  });

  it("projector returns null (recognised content-type, ungoverned body): admits unvalidated, no materialize", async () => {
    const { identifierStrategy, auxiliaryStrategy } = makeStrategies();
    const projector = makeProjector(null);
    const source = makeSource();
    const store = new AdmissionFloorStore(source as any, identifierStrategy, auxiliaryStrategy, projector as any);

    await store.setRepresentation({ path: RESOURCE }, md(RESOURCE, "# untyped"));

    expect(projector.project).toHaveBeenCalledTimes(1);
    expect(validateMock).not.toHaveBeenCalled();
    expect(source.setRepresentation).toHaveBeenCalledTimes(1);
    expect(projector.materialize).not.toHaveBeenCalled();
  });
});

// --- POST path (addResource) -----------------------------------------------

describe("AdmissionFloorStore.addResource — POST gating", () => {
  it("admits a conforming POST: commits then materializes against the created identifier", async () => {
    validateMock.mockResolvedValue({ conforms: true });
    const { identifierStrategy, auxiliaryStrategy } = makeStrategies();
    const projector = makeProjector(conceptProjection());
    const source = makeSource();
    const store = new AdmissionFloorStore(source as any, identifierStrategy, auxiliaryStrategy, projector as any);

    await store.addResource({ path: CONTAINER }, md(RESOURCE, "concept"));

    expect(source.addResource).toHaveBeenCalledTimes(1);
    expect(projector.project).toHaveBeenCalledTimes(1);
    expect(projector.project.mock.calls[0][0].path).toBe(RESOURCE); // created id, not container
    expect(projector.materialize).toHaveBeenCalledTimes(1);
    expect(source.deleteResource).not.toHaveBeenCalled();
  });

  it("rejects a non-conforming POST: rolls back the created resource and throws", async () => {
    validateMock.mockResolvedValue({ conforms: false, reportTurtle: "report" });
    const { identifierStrategy, auxiliaryStrategy } = makeStrategies();
    const projector = makeProjector(conceptProjection());
    const source = makeSource();
    const store = new AdmissionFloorStore(source as any, identifierStrategy, auxiliaryStrategy, projector as any);

    await expect(
      store.addResource({ path: CONTAINER }, md(RESOURCE, "concept")),
    ).rejects.toBeInstanceOf(ShaclValidationError);

    expect(source.addResource).toHaveBeenCalledTimes(1);
    expect(source.deleteResource).toHaveBeenCalledTimes(1);
    expect(source.deleteResource.mock.calls[0][0].path).toBe(RESOURCE);
    expect(projector.materialize).not.toHaveBeenCalled();
  });

  it("RDF POST passes straight through (no project / validate)", async () => {
    const { identifierStrategy, auxiliaryStrategy } = makeStrategies();
    const projector = makeProjector(conceptProjection());
    const source = makeSource();
    const store = new AdmissionFloorStore(source as any, identifierStrategy, auxiliaryStrategy, projector as any);

    await store.addResource({ path: CONTAINER }, ttl(RESOURCE));

    expect(source.addResource).toHaveBeenCalledTimes(1);
    expect(projector.project).not.toHaveBeenCalled();
    expect(validateMock).not.toHaveBeenCalled();
  });
});
