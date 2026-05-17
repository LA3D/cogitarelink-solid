/**
 * ErrorHandler that intercepts ShaclValidationError and returns a 422 response
 * with Content-Type: text/turtle body containing the sh:ValidationReport.
 *
 * Registered before ConvertingErrorHandler in the WaterfallErrorHandler so
 * SHACL violations return parseable RDF instead of plain-text JSON.
 * Throws NotImplementedHttpError for all other error types so the waterfall
 * falls through to ConvertingErrorHandler as before.
 */
import type { ErrorHandlerArgs, ResponseDescription } from '@solid/community-server';
import {
  ErrorHandler,
  NotImplementedHttpError,
  RepresentationMetadata,
  guardedStreamFrom,
} from '@solid/community-server';
import { ShaclValidationError } from '../../error/ShaclValidationError';

export class ShaclErrorHandler extends ErrorHandler {
  public async canHandle({ error }: ErrorHandlerArgs): Promise<void> {
    if (!ShaclValidationError.isInstance(error)) {
      throw new NotImplementedHttpError('Not a ShaclValidationError');
    }
  }

  public async handle({ error }: ErrorHandlerArgs): Promise<ResponseDescription> {
    const shaclError = error as ShaclValidationError;
    // Reuse the error's metadata to ensure we're using the same RepresentationMetadata
    // instance that the CSS MetadataWriter chain knows how to process.
    shaclError.metadata.contentType = 'text/turtle';
    return {
      statusCode: 422,
      metadata: shaclError.metadata,
      data: guardedStreamFrom(shaclError.reportTurtle),
    };
  }
}
