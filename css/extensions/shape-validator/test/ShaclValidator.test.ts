/**
 * Unit tests for ShaclValidationError and ShaclErrorHandler.
 *
 * These tests verify that:
 * 1. ShaclValidationError carries the Turtle report body
 * 2. ShaclErrorHandler converts ShaclValidationError to a 422 ResponseDescription
 *    with text/turtle Content-Type and sh:ValidationReport body
 * 3. ShaclErrorHandler falls through (NotImplementedHttpError) for other error types
 *
 * Note: The full ShaclValidator.handle() integration (fetching shapes, parsing data,
 * running rdf-validate-shacl) requires a live CSS Pod and is covered by
 * tests/integration/test_shacl_feedback.py.
 */
import { describe, it, expect } from "vitest";
import { ShaclValidationError } from "../src/error/ShaclValidationError";
import { ShaclErrorHandler } from "../src/http/error/ShaclErrorHandler";
import { BadRequestHttpError } from "@solid/community-server";

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
