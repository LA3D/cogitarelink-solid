/**
 * Custom HTTP error that carries a serialized SHACL ValidationReport as Turtle.
 * Thrown by ShaclValidator when data does not conform to the target shape.
 * ShaclErrorHandler intercepts this error and returns its reportTurtle as the
 * 422 response body with Content-Type: text/turtle — enabling agents to parse
 * the report and self-correct without opaque-error retry loops.
 */
import { HttpError } from '@solid/community-server';

export class ShaclValidationError extends HttpError {
  public readonly reportTurtle: string;
  public readonly shapeURL: string;

  public constructor(shapeURL: string, reportTurtle: string) {
    super(422, 'ShaclValidationError', `Data does not conform to ${shapeURL}`);
    this.shapeURL = shapeURL;
    this.reportTurtle = reportTurtle;
  }

  public static isInstance(error: unknown): error is ShaclValidationError {
    return HttpError.isInstance(error) &&
      error.statusCode === 422 &&
      error.name === 'ShaclValidationError';
  }
}
