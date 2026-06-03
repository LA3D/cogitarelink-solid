/**
 * SHACL validator for Solid Pod containers.
 * Ported from CommunitySolidServer/shape-validator-component for CSS v8.
 * All imports from @solid/community-server use the v8 ESM exports.
 */
import type { AuxiliaryStrategy, RepresentationConverter } from '@solid/community-server';
import {
  BadRequestHttpError,
  BasicRepresentation,
  cloneRepresentation,
  fetchDataset,
  INTERNAL_QUADS,
  NotImplementedHttpError,
  readableToQuads,
} from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import type { Store } from 'n3';
import { ShaclValidationError } from '../../error/ShaclValidationError';
import { NoOpUnprocessableWriteHook } from '../../NoOpUnprocessableWriteHook';
import { RDF_CONTENT_TYPES } from '../../util/ContentTypes';
import { LDP, SH } from '../../util/Vocabularies';
import type { ShapeValidatorInput } from './ShapeValidator';
import { ShapeValidator } from './ShapeValidator';
import { validateQuadsAgainstShape } from './validateQuadsAgainstShape.js';

// Hook interface for SHACL rejection callbacks.
// Declared as a local type alias for structural typing — NOT exported as a
// class so componentsjs-generator doesn't generate a nominal type that would
// block cross-package Override injection. The constructor parameter is typed
// as `unknown` so componentsjs-generator emits ParameterRangeWildcard, which
// accepts any component (including mem-trigger's MemTriggerUnprocessableWriteHook).
// Internal usage narrows via duck-type cast.
type IUnprocessableWriteHookLike = {
  onShaclRejection(input: {
    targetUri: string;
    validationReport: string;
    writerWebId?: string;
    timestamp: Date;
  }): Promise<void>;
};

export class ShaclValidator extends ShapeValidator {
  private readonly converter: RepresentationConverter;
  protected readonly logger = getLoggerFor(this);
  private readonly auxiliaryStrategy: AuxiliaryStrategy;
  private readonly unprocessableHook: IUnprocessableWriteHookLike;

  public constructor(
    converter: RepresentationConverter,
    auxiliaryStrategy: AuxiliaryStrategy,
    unprocessableHook?: unknown,
  ) {
    super();
    this.converter = converter;
    this.auxiliaryStrategy = auxiliaryStrategy;
    // Cast to duck type — structural compatibility enforced at runtime.
    // Both NoOpUnprocessableWriteHook and MemTriggerUnprocessableWriteHook
    // satisfy this interface via structural typing. Nullish coalescing handles
    // the case where Components.js does not inject a hook (undefined).
    this.unprocessableHook = unprocessableHook != null
      ? (unprocessableHook as IUnprocessableWriteHookLike)
      : new NoOpUnprocessableWriteHook();
  }

  public async canHandle({ parentRepresentation, representation }: ShapeValidatorInput): Promise<void> {
    if (this.auxiliaryStrategy.isAuxiliaryIdentifier({ path: representation.metadata.identifier.value })) {
      throw new NotImplementedHttpError('No shape validation executed on auxiliary files.');
    }

    // A SHACL validator validates RDF. Non-RDF bodies (e.g. text/markdown) are projected
    // into their .meta graph by the AdmissionFloorStore + a BodyProjector and validated there.
    const ct = representation.metadata.contentType;
    if (ct && !RDF_CONTENT_TYPES.has(ct)) {
      throw new NotImplementedHttpError(`No shape validation on non-RDF content-type ${ct}.`);
    }

    const shapeURL = parentRepresentation.metadata.get(LDP.terms.constrainedBy)?.value;
    if (!shapeURL) {
      throw new NotImplementedHttpError('No ldp:constrainedBy predicate.');
    }

    if (representation.isEmpty) {
      throw new BadRequestHttpError('Data could not be validated as it could not be converted to rdf');
    }
  }

  public async handle(input: ShapeValidatorInput): Promise<void> {
    const { parentRepresentation, representation } = input;
    const shapeURL = parentRepresentation.metadata.get(LDP.terms.constrainedBy)!.value;

    let representationData: BasicRepresentation;
    const preferences = { type: { [INTERNAL_QUADS]: 1 } };
    try {
      const tempRepresentation = await cloneRepresentation(representation);
      this.logger.debug(`Resource to be validated: ${representation.metadata.identifier.value}`);
      representationData = await this.converter.handleSafe({
        identifier: { path: representation.metadata.identifier.value },
        representation: tempRepresentation,
        preferences,
      });
    } catch (error: unknown) {
      representation.data.destroy();
      if (NotImplementedHttpError.isInstance(error)) {
        throw new BadRequestHttpError('Data could not be validated as it could not be converted to rdf',
          { cause: error });
      }
      throw error;
    }
    const dataStore = await readableToQuads(representationData.data);

    this.logger.debug(`Shape URL from parent metadata: ${shapeURL}`);
    const shape = await fetchDataset(shapeURL);
    const shapeStore = await readableToQuads(shape.data);
    this.targetClassCheck(shapeStore, dataStore, shapeURL);

    const result = await validateQuadsAgainstShape(dataStore, shapeStore);
    this.logger.debug(`Validation: ${result.conforms ? 'success' : 'failure'}`);
    if (!result.conforms) {
      await this.invokeHookAndThrow(representation.metadata.identifier.value, result.reportTurtle!, shapeURL);
    }
  }

  /**
   * Invokes IUnprocessableWriteHook (substrate archival) and then throws
   * ShaclValidationError. Hook errors are swallowed — the 422 must always
   * be returned to the agent regardless of substrate archival outcome.
   *
   * Exposed as a public method (rather than inline) so the hook contract is
   * unit-testable without driving the full SHACL pipeline.
   */
  public async invokeHookAndThrow(
    targetUri: string,
    reportTurtle: string,
    shapeURL: string = 'urn:test:no-shape-url',
  ): Promise<void> {
    try {
      await this.unprocessableHook.onShaclRejection({
        targetUri,
        validationReport: reportTurtle,
        timestamp: new Date(),
      });
    } catch (hookErr: unknown) {
      const msg = hookErr instanceof Error ? hookErr.message : String(hookErr);
      this.logger.warn(`UnprocessableWrite hook error (substrate event archival failed; 422 still returned to agent): ${msg}`);
    }
    throw new ShaclValidationError(shapeURL, reportTurtle);
  }

  public async handleSafe(input: ShapeValidatorInput): Promise<void> {
    let canHandle: boolean;
    try {
      await this.canHandle(input);
      canHandle = true;
    } catch {
      canHandle = false;
    }
    if (canHandle) {
      await this.handle(input);
    }
  }

  private targetClassCheck(shapeStore: Store, dataStore: Store, shapeURL: string): void {
    const targetClasses = shapeStore.getObjects(null, SH.targetClass, null);
    const targetClassesPresent = targetClasses.some(
      (targetClass) => dataStore.countQuads(null, null, targetClass, null) > 0,
    );
    if (!targetClassesPresent) {
      throw new BadRequestHttpError(
        `Data not accepted as no nodes in the body conform to any of the target classes of ${shapeURL}`,
      );
    }
  }
}
