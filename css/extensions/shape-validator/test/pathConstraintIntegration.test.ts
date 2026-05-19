/**
 * Integration-level unit tests for pathBasedClassConstraint wired into
 * ShapeValidationStore.checkPathConstraint (D99 Layer 2).
 *
 * These tests exercise checkPathConstraint directly (it is protected but
 * accessible via a test-subclass) with a stubbed converter that parses
 * Turtle bodies into N3 quad streams — the same format readableToQuads
 * expects from INTERNAL_QUADS conversions in production.
 */
import { describe, it, expect, vi } from "vitest";
import type { AuxiliaryStrategy, IdentifierStrategy, Representation, RepresentationConverter, ResourceStore } from "@solid/community-server";
import { BasicRepresentation, guardedStreamFrom, RepresentationMetadata, cloneRepresentation, readableToQuads } from "@solid/community-server";
import { Parser } from "n3";
import { Readable } from "stream";
import { ShaclValidationError } from "../src/error/ShaclValidationError";
import { ShapeValidationStore } from "../src/storage/ShapeValidationStore";
import type { PathConstraintConfig } from "../src/pathConstraint";

// ---------------------------------------------------------------------------
// Converter mock: Turtle → N3 quad stream (what representationToStore returns)
// ---------------------------------------------------------------------------

/**
 * A RepresentationConverter stub that reads the incoming Turtle stream,
 * parses it with N3.js, and returns a Readable stream of Quad objects.
 * This matches what CSS's built-in RepresentationConverter produces for
 * INTERNAL_QUADS preferences on text/turtle input.
 */
function makeTurtleConverter(): RepresentationConverter {
  return {
    handleSafe: vi.fn(async ({ identifier, representation }: { identifier: any; representation: Representation; preferences: any }) => {
      // Read stream chunks (may be strings or Buffers from guardedStreamFrom)
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        representation.data.on("data", (c: unknown) => {
          chunks.push(typeof c === "string" ? Buffer.from(c) : c as Buffer);
        });
        representation.data.on("end", resolve);
        representation.data.on("error", reject);
      });
      const turtle = Buffer.concat(chunks).toString("utf-8");
      const parser = new Parser({ format: "Turtle", baseIRI: identifier.path });
      const quads = parser.parse(turtle);
      const quadStream = Readable.from(quads) as unknown as NodeJS.ReadableStream;
      const meta = new RepresentationMetadata({ path: identifier.path });
      meta.contentType = "internal/quads";
      return new BasicRepresentation(quadStream as any, meta);
    }),
  } as unknown as RepresentationConverter;
}

/** Converter that always throws — simulates non-RDF (markdown) input. */
function makeFailConverter(): RepresentationConverter {
  return {
    handleSafe: vi.fn(async () => { throw new Error("cannot convert text/markdown to quads"); }),
  } as unknown as RepresentationConverter;
}

// ---------------------------------------------------------------------------
// Other stubs
// ---------------------------------------------------------------------------

function makeValidator() {
  return { handleSafe: vi.fn(async () => undefined) } as any;
}

function makeSource(): ResourceStore {
  return {
    getRepresentation: vi.fn(async () => new BasicRepresentation()),
    addResource: vi.fn(async () => new Map()),
    setRepresentation: vi.fn(async () => new Map()),
    deleteResource: vi.fn(async () => new Map()),
  } as unknown as ResourceStore;
}

function makeIdentifierStrategy(): IdentifierStrategy {
  return {
    isRootContainer: vi.fn(() => false),
    getParentContainer: vi.fn((id: any) => ({ path: id.path.replace(/\/[^/]+$/, "/") })),
    supportsIdentifier: vi.fn(() => true),
  } as unknown as IdentifierStrategy;
}

function makeMetadataStrategy(): AuxiliaryStrategy {
  return {
    isAuxiliaryIdentifier: vi.fn(() => false),
    getSubjectIdentifier: vi.fn((id: any) => id),
    getAuxiliaryIdentifier: vi.fn((id: any) => ({ path: id.path + ".meta" })),
    getAuxiliaryIdentifiers: vi.fn(() => []),
  } as unknown as AuxiliaryStrategy;
}

/**
 * Test-subclass that exposes the protected checkPathConstraint method
 * and overrides representationToStore to use our test converter directly.
 */
class TestableShapeValidationStore extends ShapeValidationStore {
  public async testCheckPathConstraint(identifier: any, representation: Representation): Promise<void> {
    return this.checkPathConstraint(identifier, representation);
  }
}

// ---------------------------------------------------------------------------
// Standard constraints
// ---------------------------------------------------------------------------

const CONSTRAINTS: PathConstraintConfig[] = [
  {
    pathPrefix: "/wiki/.events/",
    allowedClasses: ["https://pod.vardeman.me/vault/ontology/mem#Event"],
    forbiddenClasses: [],
  },
  {
    pathPrefix: "/wiki/events/",
    allowedClasses: [],
    forbiddenClasses: [
      "https://pod.vardeman.me/vault/ontology/mem#Event",
      "https://pod.vardeman.me/vault/ontology/mem#Action",
    ],
  },
  {
    pathPrefix: "/wiki/procedures/",
    allowedClasses: [],
    forbiddenClasses: ["https://pod.vardeman.me/vault/ontology/mem#Action"],
  },
];

function makeStore(constraints = CONSTRAINTS, failConvert = false): TestableShapeValidationStore {
  return new TestableShapeValidationStore(
    makeSource(),
    makeIdentifierStrategy(),
    makeMetadataStrategy(),
    failConvert ? makeFailConverter() : makeTurtleConverter(),
    makeValidator(),
    constraints,
  );
}

function turtleRep(baseUrl: string, body: string): Representation {
  const meta = new RepresentationMetadata({ path: baseUrl });
  meta.contentType = "text/turtle";
  return new BasicRepresentation(guardedStreamFrom(body), meta);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ShapeValidationStore.checkPathConstraint (D99 Layer 2)", () => {
  it("rejects mem:Event PUT to /wiki/events/ with ShaclValidationError", async () => {
    const store = makeStore();
    const identifier = { path: "https://pod.example.org/wiki/events/foo.ttl" };
    const body = `
      @prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .
      <https://pod.example.org/wiki/events/foo.ttl#this> a mem:Event .
    `;
    await expect(store.testCheckPathConstraint(identifier, turtleRep(identifier.path, body)))
      .rejects.toThrow(ShaclValidationError);
  });

  it("violation report body contains sh:ValidationReport and mem:Event IRI", async () => {
    const store = makeStore();
    const identifier = { path: "https://pod.example.org/wiki/events/foo.ttl" };
    const body = `
      @prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .
      <https://pod.example.org/wiki/events/foo.ttl#this> a mem:Event .
    `;
    let caught: ShaclValidationError | undefined;
    try {
      await store.testCheckPathConstraint(identifier, turtleRep(identifier.path, body));
    } catch (e) {
      if (ShaclValidationError.isInstance(e)) caught = e;
    }
    expect(caught).toBeDefined();
    expect(caught!.reportTurtle).toContain("sh:ValidationReport");
    // The violation message + value should reference the forbidden class
    expect(caught!.reportTurtle).toMatch(/mem.*Event|Event.*mem|disjoint/i);
  });

  it("passes schema:Event to /wiki/events/ (not in forbiddenClasses)", async () => {
    const store = makeStore();
    const identifier = { path: "https://pod.example.org/wiki/events/foo.ttl" };
    const body = `
      @prefix schema: <https://schema.org/> .
      <https://pod.example.org/wiki/events/foo.ttl#this> a schema:Event .
    `;
    await expect(store.testCheckPathConstraint(identifier, turtleRep(identifier.path, body)))
      .resolves.toBeUndefined();
  });

  it("passes resource with no rdf:type (empty resourceClasses)", async () => {
    const store = makeStore();
    const identifier = { path: "https://pod.example.org/wiki/events/foo.ttl" };
    const body = `
      @prefix dcterms: <http://purl.org/dc/terms/> .
      <https://pod.example.org/wiki/events/foo.ttl#this> dcterms:title "No type" .
    `;
    await expect(store.testCheckPathConstraint(identifier, turtleRep(identifier.path, body)))
      .resolves.toBeUndefined();
  });

  it("passes PUT to an unconstrained path", async () => {
    const store = makeStore();
    const identifier = { path: "https://pod.example.org/vault/other/doc.ttl" };
    const body = `
      @prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .
      <https://pod.example.org/vault/other/doc.ttl#this> a mem:Event .
    `;
    await expect(store.testCheckPathConstraint(identifier, turtleRep(identifier.path, body)))
      .resolves.toBeUndefined();
  });

  it("skips path check when converter throws (non-RDF body)", async () => {
    const store = makeStore(CONSTRAINTS, /* failConvert= */ true);
    const identifier = { path: "https://pod.example.org/wiki/events/page.md" };
    const meta = new RepresentationMetadata({ path: identifier.path });
    meta.contentType = "text/markdown";
    const rep = new BasicRepresentation(guardedStreamFrom("# heading"), meta);
    // Converter will throw → silently skipped, no ShaclValidationError
    await expect(store.testCheckPathConstraint(identifier, rep)).resolves.toBeUndefined();
  });

  it("passes when pathConstraints list is empty", async () => {
    const store = makeStore([]); // no constraints
    const identifier = { path: "https://pod.example.org/wiki/events/foo.ttl" };
    const body = `
      @prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .
      <https://pod.example.org/wiki/events/foo.ttl#this> a mem:Event .
    `;
    await expect(store.testCheckPathConstraint(identifier, turtleRep(identifier.path, body)))
      .resolves.toBeUndefined();
  });

  it("rejects mem:Action PUT to /wiki/procedures/", async () => {
    const store = makeStore();
    const identifier = { path: "https://pod.example.org/wiki/procedures/foo.ttl" };
    const body = `
      @prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .
      <https://pod.example.org/wiki/procedures/foo.ttl#this> a mem:Action .
    `;
    await expect(store.testCheckPathConstraint(identifier, turtleRep(identifier.path, body)))
      .rejects.toThrow(ShaclValidationError);
  });

  // Bug E: .meta resources must be skipped regardless of rdf:type content.
  // Container .meta PATCHes include ldp:Container / ldp:BasicContainer type
  // assertions that false-positive against substrate-only allow-lists.
  it("skips path constraint for .meta resource with ldp:Container types (Bug E)", async () => {
    const constraintsWithAllowList: PathConstraintConfig[] = [
      {
        pathPrefix: "/wiki/.events/",
        allowedClasses: ["https://www.w3.org/ns/activitystreams#Activity"],
        forbiddenClasses: [],
      },
    ];
    const store = makeStore(constraintsWithAllowList);
    // Simulate a container .meta PATCH: path ends in .meta, body has LDP types
    const identifier = { path: "https://pod.example.org/wiki/.events/foo.md.meta" };
    const body = `
      @prefix ldp: <http://www.w3.org/ns/ldp#> .
      @prefix dct: <http://purl.org/dc/terms/> .
      <https://pod.example.org/wiki/.events/foo.md>
        a ldp:BasicContainer, ldp:Container ;
        dct:title "Events container" .
    `;
    // Must not throw ShaclValidationError — ldp:BasicContainer is not as:Activity
    // but .meta paths are skipped before the allow-list check fires.
    await expect(store.testCheckPathConstraint(identifier, turtleRep(identifier.path, body)))
      .resolves.toBeUndefined();
  });

  it("still applies path constraint for non-.meta resource on constrained path (Bug E regression guard)", async () => {
    const constraintsWithAllowList: PathConstraintConfig[] = [
      {
        pathPrefix: "/wiki/.events/",
        allowedClasses: ["https://www.w3.org/ns/activitystreams#Activity"],
        forbiddenClasses: [],
      },
    ];
    const store = makeStore(constraintsWithAllowList);
    // Same content body, but this is the resource itself (no .meta suffix)
    const identifier = { path: "https://pod.example.org/wiki/.events/foo.md" };
    const body = `
      @prefix ldp: <http://www.w3.org/ns/ldp#> .
      <https://pod.example.org/wiki/.events/foo.md>
        a ldp:BasicContainer, ldp:Container .
    `;
    // ldp:BasicContainer is not in allowedClasses → constraint fires
    await expect(store.testCheckPathConstraint(identifier, turtleRep(identifier.path, body)))
      .rejects.toThrow(ShaclValidationError);
  });
});
