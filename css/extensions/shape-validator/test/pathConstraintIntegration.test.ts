/**
 * Integration-level tests for pathBasedClassConstraint wired into
 * ShapeValidationStore.checkPathConstraint (D99 Layer 2).
 *
 * De-mocked + config-parametrized (audit F7/F8):
 *
 *  (a) The constraint set under test is read from the LIVE config
 *      (css/config/solid-config.json's ShapeValidationStore.pathConstraints) —
 *      NOT a fabricated set. The previous version hand-wrote `/wiki/events/`
 *      prefixes that did not match the deployed `/vault/wiki/events/`, so nothing
 *      tied the shipped config to an assertion. Cases are generated from the real
 *      prefixes (stampAgreement.test.ts is the config-reading exemplar).
 *
 *  (b) At least one case is driven through the REAL CSS RepresentationConverter
 *      (RdfToQuadConverter) — the actual seam class where Floor-Bug-1 lived — so
 *      the Turtle→INTERNAL_QUADS path that production uses is exercised, not a
 *      hand-rolled converter stub. A second, lighter converter parses real Turtle
 *      with N3 into a Readable of RDF/JS Quad objects; that stream SHAPE is
 *      exactly what RdfToQuadConverter emits for INTERNAL_QUADS (an object-mode
 *      stream of Quad objects, read back by readableToQuads), which the
 *      "real-converter parity" test below asserts explicitly.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import type {
  AuxiliaryStrategy,
  IdentifierStrategy,
  Representation,
  RepresentationConverter,
  ResourceStore,
} from "@solid/community-server";
import {
  BasicRepresentation,
  guardedStreamFrom,
  RepresentationMetadata,
  RdfToQuadConverter,
  readableToQuads,
} from "@solid/community-server";
import { Parser } from "n3";
import { Readable } from "stream";
import { ShaclValidationError } from "../src/error/ShaclValidationError";
import { ShapeValidationStore } from "../src/storage/ShapeValidationStore";
import { PathConstraintConfig } from "../src/pathConstraint";

// ---------------------------------------------------------------------------
// Real config: read the deployed pathConstraints
// ---------------------------------------------------------------------------

const CONFIG = join(__dirname, "..", "..", "..", "config");

interface RawConstraint {
  pathPrefix: string;
  allowedClasses: string[];
  forbiddenClasses: string[];
}

function liveConstraints(): RawConstraint[] {
  const doc = JSON.parse(readFileSync(join(CONFIG, "solid-config.json"), "utf8"));
  const entry = (doc["@graph"] as Array<Record<string, unknown>>).find(
    (e) => e["@type"] === "ShapeValidationStore",
  );
  if (!entry) throw new Error("no ShapeValidationStore entry in solid-config.json");
  const constraints = entry.pathConstraints;
  if (!Array.isArray(constraints)) throw new Error("ShapeValidationStore.pathConstraints is not an array");
  return (constraints as RawConstraint[]).map((c) => ({
    pathPrefix: c.pathPrefix,
    allowedClasses: c.allowedClasses ?? [],
    forbiddenClasses: c.forbiddenClasses ?? [],
  }));
}

const LIVE = liveConstraints();
// Construct via the real class so the F2 trailing-slash guard runs on the
// deployed config too (a non-container prefix in config would throw here).
const CONSTRAINTS: PathConstraintConfig[] = LIVE.map(
  (c) => new PathConstraintConfig(c.pathPrefix, c.allowedClasses, c.forbiddenClasses),
);

// Pod origin the test URLs sit under. Path component is what matters; the
// constraints are matched against url.pathname.
const ORIGIN = "https://pod.example.org";

// ---------------------------------------------------------------------------
// Converters
// ---------------------------------------------------------------------------

/**
 * The REAL CSS converter. Turns text/turtle into an INTERNAL_QUADS
 * BasicRepresentation. This is the seam class — used by the "real-converter"
 * cases below so the production Turtle→quads path is exercised for real.
 */
function makeRealConverter(): RepresentationConverter {
  return new RdfToQuadConverter() as unknown as RepresentationConverter;
}

/**
 * Lightweight converter: parse real Turtle with N3 into a Readable of RDF/JS
 * Quad objects. The stream SHAPE (object-mode stream of Quad objects) matches
 * RdfToQuadConverter's INTERNAL_QUADS output; the "real-converter parity" test
 * asserts both produce the same quad set for the same input.
 */
function makeN3Converter(): RepresentationConverter {
  return {
    handleSafe: async ({ identifier, representation }: { identifier: any; representation: Representation }) => {
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        representation.data.on("data", (c: unknown) => {
          chunks.push(typeof c === "string" ? Buffer.from(c) : (c as Buffer));
        });
        representation.data.on("end", resolve);
        representation.data.on("error", reject);
      });
      const turtle = Buffer.concat(chunks).toString("utf-8");
      const quads = new Parser({ format: "Turtle", baseIRI: identifier.path }).parse(turtle);
      const quadStream = Readable.from(quads) as unknown as NodeJS.ReadableStream;
      const meta = new RepresentationMetadata({ path: identifier.path });
      meta.contentType = "internal/quads";
      return new BasicRepresentation(quadStream as any, meta);
    },
  } as unknown as RepresentationConverter;
}

/** Converter that always throws — simulates a non-RDF (markdown) body. */
function makeFailConverter(): RepresentationConverter {
  return {
    handleSafe: async () => {
      throw new Error("cannot convert text/markdown to quads");
    },
  } as unknown as RepresentationConverter;
}

// ---------------------------------------------------------------------------
// Other dependencies (NOT the seam under test — plain fakes are fine here)
// ---------------------------------------------------------------------------

function makeValidator() {
  return { handleSafe: async () => undefined } as any;
}

function makeSource(): ResourceStore {
  return {
    getRepresentation: async () => new BasicRepresentation(),
    addResource: async () => new Map(),
    setRepresentation: async () => new Map(),
    deleteResource: async () => new Map(),
  } as unknown as ResourceStore;
}

function makeIdentifierStrategy(): IdentifierStrategy {
  return {
    isRootContainer: () => false,
    getParentContainer: (id: any) => ({ path: id.path.replace(/\/[^/]+$/, "/") }),
    supportsIdentifier: () => true,
  } as unknown as IdentifierStrategy;
}

function makeMetadataStrategy(): AuxiliaryStrategy {
  return {
    // Mirror CSS's SuffixAuxiliaryIdentifierStrategy(.meta): suffix endsWith.
    isAuxiliaryIdentifier: (id: any) => id.path.endsWith(".meta"),
    getSubjectIdentifier: (id: any) => ({ path: id.path.replace(/\.meta$/, "") }),
    getAuxiliaryIdentifier: (id: any) => ({ path: id.path + ".meta" }),
    getAuxiliaryIdentifiers: () => [],
  } as unknown as AuxiliaryStrategy;
}

class TestableShapeValidationStore extends ShapeValidationStore {
  public async testCheckPathConstraint(identifier: any, representation: Representation): Promise<void> {
    return this.checkPathConstraint(identifier, representation);
  }
}

function makeStore(
  converter: RepresentationConverter,
  constraints: PathConstraintConfig[] = CONSTRAINTS,
  tboxPaths: string[] = [],
): TestableShapeValidationStore {
  return new TestableShapeValidationStore(
    makeSource(),
    makeIdentifierStrategy(),
    makeMetadataStrategy(),
    converter,
    makeValidator(),
    constraints,
    tboxPaths,
  );
}

function turtleRep(baseUrl: string, body: string): Representation {
  const meta = new RepresentationMetadata({ path: baseUrl });
  meta.contentType = "text/turtle";
  return new BasicRepresentation(guardedStreamFrom(body), meta);
}

// Build a representative violating body for a constraint, given the live config.
// - allow-list constraint: a body whose only type is NOT in the allow-list.
// - forbidden-list constraint: a body declaring the first forbidden class.
function violatingBody(subject: string, c: RawConstraint): string | null {
  if (c.forbiddenClasses.length > 0) {
    return `<${subject}> a <${c.forbiddenClasses[0]}> .`;
  }
  if (c.allowedClasses.length > 0) {
    // schema:Thing is (assumed) not in any mem/AS allow-list.
    return `<${subject}> a <https://schema.org/Thing> .`;
  }
  return null; // pure pass-through constraint — nothing to violate
}

// ---------------------------------------------------------------------------
// Config-parametrized tests against the REAL deployed constraints
// ---------------------------------------------------------------------------

describe("ShapeValidationStore construction guard (audit F2)", () => {
  it("throws at construction when a configured pathPrefix is not a container prefix", () => {
    // Plain object (Components.js sets member fields directly, no constructor) with a
    // missing trailing slash — the store constructor must reject it loudly at boot.
    const bad = [{ pathPrefix: "/vault/wiki/events", allowedClasses: [], forbiddenClasses: [] }] as any;
    expect(() => makeStore(makeN3Converter(), bad)).toThrow(/must end with "\/"/);
  });

  it("constructs cleanly with the deployed (all-trailing-slash) config", () => {
    expect(() => makeStore(makeN3Converter())).not.toThrow();
  });
});

describe("ShapeValidationStore.checkPathConstraint — deployed config (audit F7/F8)", () => {
  it("every deployed pathPrefix is a container prefix ending in '/'", () => {
    for (const c of LIVE) {
      expect(c.pathPrefix.endsWith("/")).toBe(true);
    }
  });

  // One generated rejection case per deployed constraint that has a violation.
  for (const c of LIVE) {
    const subject = `${ORIGIN}${c.pathPrefix}foo.ttl#this`;
    const resourceUrl = `${ORIGIN}${c.pathPrefix}foo.ttl`;
    const body = violatingBody(subject, c);
    if (!body) continue;

    it(`rejects a violating write under ${c.pathPrefix} (N3 stream path)`, async () => {
      const store = makeStore(makeN3Converter());
      await expect(
        store.testCheckPathConstraint({ path: resourceUrl }, turtleRep(resourceUrl, body)),
      ).rejects.toThrow(ShaclValidationError);
    });
  }

  it("passes a write to an unconstrained path", async () => {
    const store = makeStore(makeN3Converter());
    const url = `${ORIGIN}/vault/other/doc.ttl`;
    const body = `<${url}#this> a <https://pod.vardeman.me/vault/ontology/mem#Event> .`;
    await expect(
      store.testCheckPathConstraint({ path: url }, turtleRep(url, body)),
    ).resolves.toBeUndefined();
  });

  it("skips the check for a non-RDF body (converter throws)", async () => {
    const store = makeStore(makeFailConverter());
    const url = `${ORIGIN}/vault/wiki/events/page.md`;
    const meta = new RepresentationMetadata({ path: url });
    meta.contentType = "text/markdown";
    const rep = new BasicRepresentation(guardedStreamFrom("# heading"), meta);
    await expect(store.testCheckPathConstraint({ path: url }, rep)).resolves.toBeUndefined();
  });

  it("skips the check for a .meta resource (AuxiliaryStrategy)", async () => {
    const store = makeStore(makeN3Converter());
    const url = `${ORIGIN}/vault/wiki/events/foo.md.meta`;
    // ldp:Container types that would false-positive against an allow-list, but
    // .meta is auxiliary → skipped before the constraint fires.
    const body = `<${ORIGIN}/vault/wiki/events/foo.md> a <http://www.w3.org/ns/ldp#BasicContainer> .`;
    await expect(
      store.testCheckPathConstraint({ path: url }, turtleRep(url, body)),
    ).resolves.toBeUndefined();
  });

  it("skips the check when the write target IS a constrained container (bootstrap)", async () => {
    const store = makeStore(makeN3Converter());
    const containerPath = LIVE[0].pathPrefix; // a real constrained container
    const url = `${ORIGIN}${containerPath}`;
    const body = `<> <http://purl.org/dc/terms/title> "Container" .`;
    await expect(
      store.testCheckPathConstraint({ path: url }, turtleRep(url, body)),
    ).resolves.toBeUndefined();
  });

  // TBox loud-fail (audit F5): a configured-but-unreadable tboxPath must THROW when
  // the closure is built (on the first governed write under a constrained path), not
  // silently warn + build an empty closure (the documented weeks-long regression).
  it("throws on a write under a constrained path when a configured tboxPath cannot be read", async () => {
    const store = makeStore(makeN3Converter(), CONSTRAINTS, ["/nonexistent/typo-tbox.ttl"]);
    const c = LIVE.find((x) => x.forbiddenClasses.length > 0)!;
    const url = `${ORIGIN}${c.pathPrefix}foo.ttl`;
    const body = `<${url}#this> a <${c.forbiddenClasses[0]}> .`;
    await expect(
      store.testCheckPathConstraint({ path: url }, turtleRep(url, body)),
    ).rejects.toThrow(/tboxPath could not be read/);
  });
});

// ---------------------------------------------------------------------------
// REAL converter: drive a case through RdfToQuadConverter (the seam class)
// ---------------------------------------------------------------------------

describe("ShapeValidationStore.checkPathConstraint — REAL RdfToQuadConverter seam", () => {
  // Pick a forbidden-list constraint from the live config to drive end-to-end
  // through the real converter.
  const forbidden = LIVE.find((c) => c.forbiddenClasses.length > 0)!;

  it("rejects a forbidden-class write driven through the real CSS converter", async () => {
    expect(forbidden).toBeDefined();
    const store = makeStore(makeRealConverter());
    const url = `${ORIGIN}${forbidden.pathPrefix}foo.ttl`;
    const body = `
      <${url}#this> a <${forbidden.forbiddenClasses[0]}> .
    `;
    await expect(
      store.testCheckPathConstraint({ path: url }, turtleRep(url, body)),
    ).rejects.toThrow(ShaclValidationError);
  });

  it("admits a non-forbidden write driven through the real CSS converter", async () => {
    const store = makeStore(makeRealConverter());
    const url = `${ORIGIN}${forbidden.pathPrefix}foo.ttl`;
    const body = `
      <${url}#this> a <https://schema.org/Event> .
    `;
    await expect(
      store.testCheckPathConstraint({ path: url }, turtleRep(url, body)),
    ).resolves.toBeUndefined();
  });

  // Parity: the lightweight N3 converter's INTERNAL_QUADS stream produces the
  // same quad set the real RdfToQuadConverter produces for the same Turtle —
  // which is why the N3 path is a faithful stand-in for the bulk cases above.
  it("N3 converter stream shape == real RdfToQuadConverter quad set", async () => {
    const url = `${ORIGIN}/vault/wiki/events/foo.ttl`;
    const body = `
      @prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .
      <${url}#this> a mem:Event ; <http://purl.org/dc/terms/title> "T" .
    `;
    const ident = { path: url };

    const realRep = await makeRealConverter().handleSafe({
      identifier: ident as any,
      representation: turtleRep(url, body),
      preferences: { type: { "internal/quads": 1 } },
    });
    const realStore = await readableToQuads(realRep.data);

    const n3Rep = await makeN3Converter().handleSafe({
      identifier: ident as any,
      representation: turtleRep(url, body),
      preferences: { type: { "internal/quads": 1 } },
    } as any);
    const n3Store = await readableToQuads(n3Rep.data);

    const norm = (s: any) =>
      s
        .getQuads(null, null, null, null)
        .map((q: any) => `${q.subject.value} ${q.predicate.value} ${q.object.value}`)
        .sort();
    expect(norm(n3Store)).toEqual(norm(realStore));
  });
});
