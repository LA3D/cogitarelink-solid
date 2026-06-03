/**
 * Unit tests for ShaclValidationError, ShaclErrorHandler, and ShaclValidator.canHandle.
 *
 * These tests verify that:
 * 1. ShaclValidationError carries the Turtle report body
 * 2. ShaclErrorHandler converts ShaclValidationError to a 422 ResponseDescription
 *    with text/turtle Content-Type and sh:ValidationReport body
 * 3. ShaclErrorHandler falls through (NotImplementedHttpError) for other error types
 * 4. ShaclValidator.canHandle skips non-RDF content-types (Front-2 §5.3)
 *
 * Note: The full ShaclValidator.handle() integration (fetching shapes, parsing data,
 * running rdf-validate-shacl) requires a live CSS Pod and is covered by
 * tests/integration/test_shacl_feedback.py.
 */
import { describe, it, expect } from "vitest";
import { ShaclValidationError } from "../src/error/ShaclValidationError";
import { ShaclErrorHandler } from "../src/http/error/ShaclErrorHandler";
import { ShaclValidator } from "../src/storage/validators/ShaclValidator";
import {
  BadRequestHttpError,
  BasicRepresentation,
  RepresentationMetadata,
} from "@solid/community-server";
import { DataFactory } from "n3";
import { LDP } from "../src/util/Vocabularies";

const { namedNode } = DataFactory;

const SAMPLE_REPORT_TURTLE = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
_:report a sh:ValidationReport ;
    sh:conforms false ;
    sh:result _:r1 .
_:r1 a sh:ValidationResult ;
    sh:resultSeverity sh:Violation ;
    sh:sourceConstraintComponent sh:MinCountConstraintComponent .
`;

const SHAPE_URL = "https://pod.example.org/shapes/test.shacl.ttl";

describe("ShaclValidationError", () => {
  it("stores shapeURL and reportTurtle", () => {
    const err = new ShaclValidationError(SHAPE_URL, SAMPLE_REPORT_TURTLE);
    expect(err.shapeURL).toBe(SHAPE_URL);
    expect(err.reportTurtle).toBe(SAMPLE_REPORT_TURTLE);
  });

  it("is a 422 HttpError", () => {
    const err = new ShaclValidationError(SHAPE_URL, SAMPLE_REPORT_TURTLE);
    expect(err.statusCode).toBe(422);
    expect(err.name).toBe("ShaclValidationError");
  });

  it("ShaclValidationError.isInstance identifies its own instances", () => {
    const err = new ShaclValidationError(SHAPE_URL, SAMPLE_REPORT_TURTLE);
    expect(ShaclValidationError.isInstance(err)).toBe(true);
  });

  it("ShaclValidationError.isInstance rejects other HttpErrors", () => {
    const err = new BadRequestHttpError("not a shacl error");
    expect(ShaclValidationError.isInstance(err)).toBe(false);
  });

  it("message includes the shapeURL", () => {
    const err = new ShaclValidationError(SHAPE_URL, SAMPLE_REPORT_TURTLE);
    expect(err.message).toContain(SHAPE_URL);
  });
});

describe("ShaclErrorHandler", () => {
  const handler = new ShaclErrorHandler();
  const mockRequest = {} as any;

  it("canHandle accepts ShaclValidationError", async () => {
    const err = new ShaclValidationError(SHAPE_URL, SAMPLE_REPORT_TURTLE);
    await expect(handler.canHandle({ error: err, request: mockRequest })).resolves.toBeUndefined();
  });

  it("canHandle rejects non-ShaclValidationError", async () => {
    const err = new BadRequestHttpError("plain error");
    await expect(handler.canHandle({ error: err, request: mockRequest })).rejects.toThrow(
      "Not a ShaclValidationError"
    );
  });

  it("handle returns 422 with text/turtle Content-Type", async () => {
    const err = new ShaclValidationError(SHAPE_URL, SAMPLE_REPORT_TURTLE);
    const result = await handler.handle({ error: err, request: mockRequest });
    expect(result.statusCode).toBe(422);
    expect(result.metadata.contentType).toBe("text/turtle");
  });

  it("handle body contains sh:ValidationReport", async () => {
    const err = new ShaclValidationError(SHAPE_URL, SAMPLE_REPORT_TURTLE);
    const result = await handler.handle({ error: err, request: mockRequest });
    const chunks: string[] = [];
    await new Promise<void>((resolve, reject) => {
      result.data!.on("data", (chunk: unknown) => chunks.push(String(chunk)));
      result.data!.on("end", resolve);
      result.data!.on("error", reject);
    });
    const body = chunks.join("");
    expect(body).toContain("sh:ValidationReport");
  });
});

// Minimal AuxiliaryStrategy stub: non-auxiliary by default.
function makeAuxStrategy(isAux = false) {
  return { isAuxiliaryIdentifier: () => isAux } as any;
}

// Build a Representation with a specific contentType and identifier path.
function makeRep(contentType: string, path: string) {
  const meta = new RepresentationMetadata({ path }, contentType);
  return new BasicRepresentation("body", meta);
}

// Build a parent Representation whose metadata declares ldp:constrainedBy.
function makeParentWithConstraint(shapeUrl: string) {
  const meta = new RepresentationMetadata({ path: "https://pod.example.org/wiki/" });
  meta.add(LDP.terms.constrainedBy, namedNode(shapeUrl));
  return new BasicRepresentation("", meta);
}

describe("ShaclValidator.canHandle — content-type guard (Front-2 §5.3)", () => {
  const validator = new ShaclValidator(
    {} as any, // converter not invoked by canHandle
    makeAuxStrategy(false),
  );
  const parent = makeParentWithConstraint(SHAPE_URL);

  it("skips validation for non-RDF (markdown) representations", async () => {
    const mdRep = makeRep("text/markdown", "https://pod.example.org/wiki/note.md");
    await expect(
      validator.canHandle({ parentRepresentation: parent, representation: mdRep }),
    ).rejects.toThrow(/non-RDF|No shape validation/i);
  });

  it("skips validation for text/html representations", async () => {
    const htmlRep = makeRep("text/html", "https://pod.example.org/wiki/page.html");
    await expect(
      validator.canHandle({ parentRepresentation: parent, representation: htmlRep }),
    ).rejects.toThrow(/non-RDF|No shape validation/i);
  });

  it("passes canHandle for text/turtle representations", async () => {
    const ttlRep = makeRep("text/turtle", "https://pod.example.org/contacts/person.ttl");
    // canHandle should resolve (no throw) — actual validation requires a live Pod
    await expect(
      validator.canHandle({ parentRepresentation: parent, representation: ttlRep }),
    ).resolves.toBeUndefined();
  });

  it("passes canHandle for application/ld+json representations", async () => {
    const jsonldRep = makeRep("application/ld+json", "https://pod.example.org/contacts/person.jsonld");
    await expect(
      validator.canHandle({ parentRepresentation: parent, representation: jsonldRep }),
    ).resolves.toBeUndefined();
  });

  it("still rejects auxiliary identifiers before the content-type check", async () => {
    const auxValidator = new ShaclValidator({} as any, makeAuxStrategy(true));
    const mdRep = makeRep("text/markdown", "https://pod.example.org/wiki/note.md.meta");
    await expect(
      auxValidator.canHandle({ parentRepresentation: parent, representation: mdRep }),
    ).rejects.toThrow(/auxiliary/i);
  });

  it("still rejects when parent has no ldp:constrainedBy (missing constraint)", async () => {
    const unconstrained = new BasicRepresentation(
      "",
      new RepresentationMetadata({ path: "https://pod.example.org/unrelated/" }),
    );
    const ttlRep = makeRep("text/turtle", "https://pod.example.org/unrelated/foo.ttl");
    await expect(
      validator.canHandle({ parentRepresentation: unconstrained, representation: ttlRep }),
    ).rejects.toThrow(/constrainedBy/i);
  });
});
