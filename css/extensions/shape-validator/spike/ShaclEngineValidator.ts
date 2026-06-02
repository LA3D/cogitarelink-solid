/**
 * SHACL validator backed by shacl-engine (rdf-ext/shacl-engine).
 * Drop-in alternative to ShaclValidator behind the ShapeValidator seam.
 * Zazuko (rdf-validate-shacl) remains the default — this adapter is selectable
 * via Components.js injection but is NOT wired as the default.
 *
 * Factory note: shacl-engine requires a combined factory with both RDF/JS
 * DataFactory term builders (@rdfjs/data-model) AND a dataset() factory method
 * (@rdfjs/dataset). These are merged into a single object at construction time.
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
import type { DatasetCore, Quad } from '@rdfjs/types';
import type { Store } from 'n3';
import { Writer } from 'n3';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Validator: ShaclEngineValidatorClass } = require('shacl-engine') as {
  Validator: new (shapes: DatasetCore, opts: { factory: unknown }) => {
    validate: (data: { dataset: DatasetCore }) => Promise<{ conforms: boolean; dataset: DatasetCore }>;
  }
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rdfDataModel = require('@rdfjs/data-model') as {
  namedNode: (v: string) => unknown;
  blankNode: (v?: string) => unknown;
  literal: (v: string, dt?: unknown) => unknown;
  quad: (...args: unknown[]) => unknown;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rdfDataset = require('@rdfjs/dataset') as {
  dataset: (quads?: Iterable<Quad>) => DatasetCore;
};

import { ShaclValidationError } from '../../error/ShaclValidationError';
import { NoOpUnprocessableWriteHook } from '../../NoOpUnprocessableWriteHook';
import { LDP, SH } from '../../util/Vocabularies';
import type { ShapeValidatorInput } from './ShapeValidator';
import { ShapeValidator } from './ShapeValidator';

// shacl-engine factory: combines @rdfjs/data-model term builders + @rdfjs/dataset.
// shacl-engine's Validator constructor requires factory.dataset() to build report quads.
const shaclEngineFactory = {
  ...rdfDataModel,
  dataset: (quads?: Iterable<Quad>): DatasetCore => rdfDataset.dataset(quads),
};

type IUnprocessableWriteHookLike = {
  onShaclRejection(input: {
    targetUri: string;
    validationReport: string;
    writerWebId?: string;
    timestamp: Date;
  }): Promise<void>;
};

/**
 * Adapter that exposes shacl-engine behind the ShapeValidator seam.
 * Constructor signature is intentionally identical to ShaclValidator so
 * it can be swapped in via Components.js without changing the wiring
 * parameters.
 */
export class ShaclEngineValidator extends ShapeValidator {
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
    this.unprocessableHook = unprocessableHook != null
      ? (unprocessableHook as IUnprocessableWriteHookLike)
      : new NoOpUnprocessableWriteHook();
  }

  /** Identical gate logic to ShaclValidator.canHandle. */
  public async canHandle({ parentRepresentation, representation }: ShapeValidatorInput): Promise<void> {
    if (this.auxiliaryStrategy.isAuxiliaryIdentifier({ path: representation.metadata.identifier.value })) {
      throw new NotImplementedHttpError('No shape validation executed on auxiliary files.');
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

    // Convert the incoming representation to an N3 Store (quads).
    let dataStore: Store;
    try {
      const tempRep = await cloneRepresentation(representation);
      this.logger.debug(`Resource to be validated (shacl-engine): ${representation.metadata.identifier.value}`);
      const converted = await this.converter.handleSafe({
        identifier: { path: representation.metadata.identifier.value },
        representation: tempRep,
        preferences: { type: { [INTERNAL_QUADS]: 1 } },
      }) as BasicRepresentation;
      dataStore = await readableToQuads(converted.data);
    } catch (error: unknown) {
      representation.data.destroy();
      if (NotImplementedHttpError.isInstance(error)) {
        throw new BadRequestHttpError('Data could not be validated as it could not be converted to rdf',
          { cause: error });
      }
      throw error;
    }

    // Fetch and parse the SHACL shapes resource.
    this.logger.debug(`Shape URL (shacl-engine): ${shapeURL}`);
    const shapeRepresentation = await fetchDataset(shapeURL);
    const shapesStore: Store = await readableToQuads(shapeRepresentation.data);

    // targetClass gate (mirrors ShaclValidator.targetClassCheck).
    this.targetClassCheck(shapesStore, dataStore, shapeURL);

    // Convert N3 Stores → @rdfjs/dataset DatasetCore objects.
    const shapesDs = this.storeToDataset(shapesStore);
    const dataDs   = this.storeToDataset(dataStore);

    // Run shacl-engine validation (inference="none": no entailment factory).
    const validator = new ShaclEngineValidatorClass(shapesDs, { factory: shaclEngineFactory });
    const report = await validator.validate({ dataset: dataDs });

    this.logger.debug(`Validation (shacl-engine): ${report.conforms ? 'success' : 'failure'}`);
    if (!report.conforms) {
      const reportTurtle = await this.serializeDataset(report.dataset);
      await this.invokeHookAndThrow(representation.metadata.identifier.value, reportTurtle, shapeURL);
    }
  }

  /** Convert N3 Store to an @rdfjs/dataset DatasetCore. */
  private storeToDataset(store: Store): DatasetCore {
    const ds = rdfDataset.dataset();
    for (const quad of store) {
      ds.add(quad as Quad);
    }
    return ds;
  }

  /** Serialize a DatasetCore to Turtle for the validation report body. */
  private serializeDataset(dataset: DatasetCore): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const writer = new Writer({
        prefixes: {
          sh: 'http://www.w3.org/ns/shacl#',
          xsd: 'http://www.w3.org/2001/XMLSchema#',
        },
      });
      for (const quad of dataset) {
        writer.addQuad(quad as Quad);
      }
      writer.end((err: Error | null, result: string) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Invoke the hook (substrate archival) then throw ShaclValidationError.
   * Hook errors are swallowed — the 422 must always reach the client.
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
      this.logger.warn(`UnprocessableWrite hook error (shacl-engine; 422 still returned): ${msg}`);
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
