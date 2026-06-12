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

// Stub fetchDataset so shapeStore() resolves without HTTP — but return a REAL
// empty quad representation so the floor's real readableToQuads(shape.data) works.
// We deliberately do NOT stub readableToQuads / the N3 parser: the .meta-graph
// reading path is exactly what D108-Floor-Bug-1 masked, so it must run for real.
// validateQuadsAgainstShape is still mocked (the conformance verdict is the seam).
vi.mock("@solid/community-server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solid/community-server")>();
  const { BasicRepresentation } = actual;
  return {
    ...actual,
    fetchDataset: vi.fn(async () => new BasicRepresentation([], "internal/quads")),
  };
});

import { Store, DataFactory } from "n3";
import { BasicRepresentation, RepresentationMetadata } from "@solid/community-server";
import { ShaclValidationError } from "../src/error/ShaclValidationError";
import { LDP } from "../src/util/Vocabularies";
import { AdmissionFloorStore, STAMP_PRED } from "../src/storage/AdmissionFloorStore";
import { VERSION_PRED } from "../src/util/StampPredicate";

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
    // Strip the .meta suffix to obtain the subject resource.
    getSubjectIdentifier: (id: { path: string }) => ({ path: id.path.replace(/\.meta$/, "") }),
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

// snapshot defaults to the first-write signature; pass one to simulate a prior state.
function makeProjector(projection: any, snapshot: any = { oldBody: null, oldMetaTtl: null }) {
  return {
    version: "9.9.9-test",
    canProject: vi.fn((rep: any) => rep.metadata.contentType === "text/markdown"),
    project: vi.fn(async () => projection),
    snapshot: vi.fn(async () => snapshot),
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
    expect(governed).toContain(VERSION_PRED);
    expect(governed).toContain(SKOS_PREFLABEL);
    // stamp quads present on the resource subject: exactly one bodyHash + one version
    const hashStamps = quads.filter((q: any) => q.predicate.value === STAMP_PRED);
    expect(hashStamps).toHaveLength(1);
    expect(hashStamps[0].subject.value).toBe(RESOURCE);
    const versionStamps = quads.filter((q: any) => q.predicate.value === VERSION_PRED);
    expect(versionStamps).toHaveLength(1);
    expect(versionStamps[0].subject.value).toBe(RESOURCE);
    // the version value flows from the injected projector (the floor stays profile-agnostic)
    expect(versionStamps[0].object.value).toBe("9.9.9-test");
  });

  it("takes the pre-commit snapshot AFTER validation, BEFORE commit, and hands it to materialize", async () => {
    validateMock.mockResolvedValue({ conforms: true });
    const { identifierStrategy, auxiliaryStrategy } = makeStrategies();
    const snapshot = { oldBody: "# old", oldMetaTtl: `<${RESOURCE}#this> <urn:a> "b" .` };
    const projector = makeProjector(conceptProjection(), snapshot);
    const source = makeSource();
    const store = new AdmissionFloorStore(source as any, identifierStrategy, auxiliaryStrategy, projector as any);

    await store.setRepresentation({ path: RESOURCE }, md(RESOURCE, "---\ntype: concept\n---\n# P"));

    expect(projector.snapshot).toHaveBeenCalledTimes(1);
    expect(projector.snapshot.mock.calls[0][0].path).toBe(RESOURCE);
    // ordering: snapshot BEFORE the commit (CSS writeMetadataFile clobbers .meta — D82 root cause)
    expect(projector.snapshot.mock.invocationCallOrder[0])
      .toBeLessThan(source.setRepresentation.mock.invocationCallOrder[0]);
    // the SAME snapshot object reaches materialize as the 4th argument
    expect(projector.materialize.mock.calls[0][3]).toBe(snapshot);
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
    // snapshot is taken only AFTER validation succeeds — a rejected PUT touches nothing
    expect(projector.snapshot).not.toHaveBeenCalled();
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

  // NOTE: the former "permissive /working/ path" test, which relied on the deleted
  // isPermissive('/working/') substring bypass + a MOCKED conforms:false verdict, has
  // moved to AdmissionFloorPermissive.test.ts — where the REAL working.shacl.ttl runs.
  // The data-model-carries-the-policy claim (audit FOLLOWUPS #5) must be tested against
  // the real permissive shape, not a mocked conformance verdict, so it lives there.

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

// --- Direct .meta PATCH/PUT path (Task 8) -----------------------------------
// PatchingStore applies the N3 patch to the current .meta and calls setRepresentation
// with the RESULTING .meta graph (already RDF). The floor must validate that graph.

const RESOURCE_META = RESOURCE + ".meta";
const CONTAINER_META = CONTAINER + ".meta";
const WORKING_RESOURCE = "https://pod.example.org/wiki/working/draft.md";
const WORKING_META = WORKING_RESOURCE + ".meta";

// A turtle representation that looks like a raw-PUT .meta graph (textual RDF path).
function metaTtl(path: string, body = "<#this> a <urn:T> .") {
  const meta = new RepresentationMetadata({ path }, "text/turtle");
  return new BasicRepresentation(body, meta);
}

// An internal/quads representation — the REAL runtime path: PatchingStore → N3Patcher
// hands the floor a patched graph as a quad-object stream (contentType internal/quads),
// NOT textual RDF. This is the content-type that D108-Floor-Bug-1 silently skipped.
// data is a Quad[] (CSS BasicRepresentation accepts an object array for internal/quads),
// which the floor's real readableToQuads() reads back into a Store.
function metaQuadsRep(path: string, quads: any[] = [quad(namedNode(RESOURCE + "#this"), namedNode(RDF_TYPE), namedNode(SKOS_CONCEPT))]) {
  const meta = new RepresentationMetadata({ path }, "internal/quads");
  return new BasicRepresentation(quads, meta);
}

describe("AdmissionFloorStore.setRepresentation — direct .meta write path", () => {
  // REGRESSION test for D108-Floor-Bug-1: the patched graph arrives as internal/quads.
  // Pre-fix, isRdfRepresentation() returned false for internal/quads, so validation was
  // SKIPPED and a non-conforming .meta committed (205). The fix gates on internal/quads
  // and reads the quad stream, so a failing graph now throws. This case would PASS-through
  // (no throw, source.setRepresentation called once) against the pre-fix code.
  it("internal/quads graph that fails validation: throws ShaclValidationError and does NOT commit (regression for D108-Floor-Bug-1)", async () => {
    validateMock.mockResolvedValue({ conforms: false, reportTurtle: "@prefix sh: <#> . _:r a sh:ValidationReport ." });
    const { identifierStrategy, auxiliaryStrategy } = makeStrategies();
    const projector = makeProjector(conceptProjection());
    const source = makeSource();
    const store = new AdmissionFloorStore(source as any, identifierStrategy, auxiliaryStrategy, projector as any);

    await expect(
      store.setRepresentation({ path: RESOURCE_META }, metaQuadsRep(RESOURCE_META)),
    ).rejects.toBeInstanceOf(ShaclValidationError);

    expect(source.setRepresentation).not.toHaveBeenCalled();
    expect(validateMock).toHaveBeenCalledTimes(1);
  });

  it("internal/quads graph that conforms: commits the .meta graph", async () => {
    validateMock.mockResolvedValue({ conforms: true });
    const { identifierStrategy, auxiliaryStrategy } = makeStrategies();
    const projector = makeProjector(conceptProjection());
    const source = makeSource();
    const store = new AdmissionFloorStore(source as any, identifierStrategy, auxiliaryStrategy, projector as any);

    await store.setRepresentation(
      { path: RESOURCE_META },
      metaQuadsRep(RESOURCE_META, [
        quad(namedNode(RESOURCE + "#this"), namedNode(RDF_TYPE), namedNode(SKOS_CONCEPT)),
        quad(namedNode(RESOURCE + "#this"), namedNode(SKOS_PREFLABEL), literal("Photosynthesis")),
      ]),
    );

    expect(source.setRepresentation).toHaveBeenCalledTimes(1);
    expect(validateMock).toHaveBeenCalledTimes(1);
  });

  it("textual text/turtle .meta that fails validation: parses the text and throws (raw-PUT path)", async () => {
    validateMock.mockResolvedValue({ conforms: false, reportTurtle: "@prefix sh: <#> . _:r a sh:ValidationReport ." });
    const { identifierStrategy, auxiliaryStrategy } = makeStrategies();
    const projector = makeProjector(conceptProjection());
    const source = makeSource();
    const store = new AdmissionFloorStore(source as any, identifierStrategy, auxiliaryStrategy, projector as any);

    await expect(
      store.setRepresentation({ path: RESOURCE_META }, metaTtl(RESOURCE_META)),
    ).rejects.toBeInstanceOf(ShaclValidationError);

    expect(source.setRepresentation).not.toHaveBeenCalled();
    expect(validateMock).toHaveBeenCalledTimes(1);
  });

  it("textual text/turtle .meta that conforms: parses the text and commits", async () => {
    validateMock.mockResolvedValue({ conforms: true });
    const { identifierStrategy, auxiliaryStrategy } = makeStrategies();
    const projector = makeProjector(conceptProjection());
    const source = makeSource();
    const store = new AdmissionFloorStore(source as any, identifierStrategy, auxiliaryStrategy, projector as any);

    await store.setRepresentation({ path: RESOURCE_META }, metaTtl(RESOURCE_META, "<#this> a <urn:T> . <#this> <" + SKOS_PREFLABEL + "> \"Photosynthesis\" ."));

    expect(source.setRepresentation).toHaveBeenCalledTimes(1);
    expect(validateMock).toHaveBeenCalledTimes(1);
  });

  it("container's own .meta (subject path ends with /): passes straight through, no validation", async () => {
    validateMock.mockResolvedValue({ conforms: false, reportTurtle: "report" });
    // auxiliaryStrategy.getSubjectIdentifier for ".../concepts/.meta" → ".../concepts/"
    const identifierStrategy = {
      isRootContainer: () => false,
      getParentContainer: () => ({ path: CONTAINER }),
    } as any;
    const auxiliaryStrategy = {
      isAuxiliaryIdentifier: () => true,
      // subject ends with "/" → container's own .meta
      getSubjectIdentifier: (_id: any) => ({ path: CONTAINER }),
    } as any;
    const projector = makeProjector(conceptProjection());
    const source = makeSource();
    const store = new AdmissionFloorStore(source as any, identifierStrategy, auxiliaryStrategy, projector as any);

    await store.setRepresentation({ path: CONTAINER_META }, metaTtl(CONTAINER_META));

    expect(source.setRepresentation).toHaveBeenCalledTimes(1);
    expect(validateMock).not.toHaveBeenCalled();
  });

  // The isPermissive('/working/') .meta bypass was deleted (audit FOLLOWUPS #5):
  // a working resource's .meta is now validated like any other governed .meta. With
  // a CONFORMING verdict it commits — there is no path-substring shortcut. (The
  // "non-conforming draft is admitted under the permissive WORKING shape" behavior is
  // covered for real in AdmissionFloorPermissive.test.ts.)
  it("working /working/ resource .meta is validated (no bypass) and commits when conforming", async () => {
    validateMock.mockResolvedValue({ conforms: true });
    const identifierStrategy = {
      isRootContainer: () => false,
      getParentContainer: () => ({ path: "https://pod.example.org/wiki/working/" }),
    } as any;
    const auxiliaryStrategy = {
      isAuxiliaryIdentifier: () => true,
      getSubjectIdentifier: (_id: any) => ({ path: WORKING_RESOURCE }),
    } as any;
    const source = makeSource();
    source.getRepresentation = vi.fn(async () => parentRep(true)) as any;
    const projector = makeProjector(conceptProjection());
    const store = new AdmissionFloorStore(source as any, identifierStrategy, auxiliaryStrategy, projector as any);

    await expect(
      store.setRepresentation({ path: WORKING_META }, metaTtl(WORKING_META)),
    ).resolves.toBeDefined();

    expect(source.setRepresentation).toHaveBeenCalledTimes(1);
    // The .meta is now validated (not bypassed by a path substring).
    expect(validateMock).toHaveBeenCalledTimes(1);
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
    // POST creates a fresh resource: the floor passes the first-write snapshot signature
    // (no FS read — the resource cannot have a prior body/.meta) so the projector stays
    // on the trivially-fine degraded branch WITHOUT a degraded signal.
    expect(projector.snapshot).not.toHaveBeenCalled();
    expect(projector.materialize.mock.calls[0][3]).toEqual({ oldBody: null, oldMetaTtl: null });
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

