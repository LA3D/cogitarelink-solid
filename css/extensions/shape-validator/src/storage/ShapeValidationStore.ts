/**
 * ResourceStore wrapper that validates writes against SHACL shapes.
 * Ported from CommunitySolidServer/shape-validator-component for CSS v8.
 * All imports from @solid/community-server use the v8 ESM exports.
 */
import type { Store } from 'n3';
import { DataFactory } from 'n3';
import type { Term } from 'rdf-js';
import type { AuxiliaryStrategy, IdentifierStrategy, Representation, ResourceIdentifier, Conditions, RepresentationConverter, ResourceStore, ChangeMap } from '@solid/community-server';
import {
  BasicRepresentation,
  filter,
  reduce,
  INTERNAL_QUADS,
  BadRequestHttpError,
  NotFoundHttpError,
  isContainerIdentifier,
  cloneRepresentation,
  readableToQuads,
  PassthroughStore,
} from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { Writer } from 'n3';
import { LDP } from '../util/Vocabularies';
import type { ShapeValidator } from './validators/ShapeValidator';
import type { PathConstraintConfig } from '../pathConstraint';
import { evaluatePathConstraint } from '../pathConstraint';
import { ShaclValidationError } from '../error/ShaclValidationError';

const { namedNode } = DataFactory;

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

export class ShapeValidationStore extends PassthroughStore {
  private readonly identifierStrategy: IdentifierStrategy;
  private readonly metadataStrategy: AuxiliaryStrategy;
  private readonly converter: RepresentationConverter;
  private readonly validator: ShapeValidator;
  private readonly pathConstraints: PathConstraintConfig[];
  protected readonly logger = getLoggerFor(this);

  public constructor(
    source: ResourceStore,
    identifierStrategy: IdentifierStrategy,
    metadataStrategy: AuxiliaryStrategy,
    converter: RepresentationConverter,
    validator: ShapeValidator,
    pathConstraints: PathConstraintConfig[] = [],
  ) {
    super(source);
    this.metadataStrategy = metadataStrategy;
    this.identifierStrategy = identifierStrategy;
    this.converter = converter;
    this.validator = validator;
    this.pathConstraints = pathConstraints;
  }

  public async addResource(identifier: ResourceIdentifier, representation: Representation, conditions?: Conditions): Promise<ChangeMap> {
    await this.checkPathConstraint(identifier, representation);
    const parentRepresentation = await this.source.getRepresentation(identifier, {});
    await this.validator.handleSafe({ parentRepresentation, representation });
    return await this.source.addResource(identifier, representation, conditions);
  }

  public async setRepresentation(identifier: ResourceIdentifier, representation: Representation, conditions?: Conditions): Promise<ChangeMap> {
    if (this.metadataStrategy.isAuxiliaryIdentifier(identifier) &&
        isContainerIdentifier(this.metadataStrategy.getSubjectIdentifier(identifier))) {
      await this.validateConstrainedByCondition(identifier, representation);
    }

    if (!this.identifierStrategy.isRootContainer(identifier)) {
      await this.checkPathConstraint(identifier, representation);
      const parentIdentifier = this.identifierStrategy.getParentContainer(identifier);
      let parentRepresentation: BasicRepresentation = new BasicRepresentation();
      try {
        parentRepresentation = await this.source.getRepresentation(parentIdentifier, {});
      } catch (error: unknown) {
        if (!NotFoundHttpError.isInstance(error)) {
          throw error;
        }
      }
      await this.validator.handleSafe({ parentRepresentation, representation });
    }

    const updatedResources = await this.source.setRepresentation(identifier, representation, conditions);
    if (updatedResources.size < 2) {
      return updatedResources;
    }
    if (updatedResources.size === 2 && !isContainerIdentifier(identifier)) {
      return updatedResources;
    }
    await this.validateNoContainersCreated(updatedResources);
    return updatedResources;
  }

  protected async validateNoContainersCreated(updatedResources: ChangeMap): Promise<void> {
    const topIdentifier = reduce(updatedResources.keys(),
      (a: ResourceIdentifier, b: ResourceIdentifier) => a.path.length < b.path.length ? a : b);

    const topRepresentation = await this.source.getRepresentation(topIdentifier, {});
    const topStore = await this.representationToStore(topIdentifier, topRepresentation);
    const shapes = this.extractShapes(topIdentifier, topStore);

    if (shapes.length > 0) {
      const createdIdentifiers = Array.from(filter(updatedResources.keys(),
        (id: ResourceIdentifier) => id.path !== topIdentifier.path));
      const sortedIdentifiers = createdIdentifiers.sort(
        (a: ResourceIdentifier, b: ResourceIdentifier) => b.path.length - a.path.length);
      for (const sortedIdentifier of sortedIdentifiers) {
        await this.source.deleteResource(sortedIdentifier);
      }
      throw new BadRequestHttpError('Not allowed to create new containers within a constrained container');
    }
  }

  protected async validateConstrainedByCondition(identifier: ResourceIdentifier, representation: Representation): Promise<void> {
    const subjectIdentifier = this.metadataStrategy.getSubjectIdentifier(identifier);
    const dataStore = await this.representationToStore(identifier, await cloneRepresentation(representation));
    const newShapes = this.extractShapes(identifier, dataStore);

    const currentShapes = this.extractShapes(
      identifier,
      await this.representationToStore(identifier, await this.source.getRepresentation(identifier, {})),
    );

    if (newShapes.length > 1) {
      throw new BadRequestHttpError('A container can only be constrained by at most one shape resource.');
    }

    const children = dataStore.getObjects(namedNode(subjectIdentifier.path), LDP.terms.contains, null);
    if ((newShapes.length === 1 && !(currentShapes[0] === newShapes[0])) && children.length > 0) {
      throw new BadRequestHttpError(
        'A container can only be constrained when there are no resources present in that container.',
      );
    }
  }

  protected async representationToStore(identifier: ResourceIdentifier, representation: Representation): Promise<Store> {
    const preferences = { type: { [INTERNAL_QUADS]: 1 } };
    representation = await this.converter.handleSafe({
      identifier,
      representation: await cloneRepresentation(representation),
      preferences,
    });
    return await readableToQuads(representation.data);
  }

  protected extractShapes(identifier: ResourceIdentifier, store: Store): string[] {
    let subjectIdentifier: ResourceIdentifier = identifier;
    if (this.metadataStrategy.isAuxiliaryIdentifier(identifier)) {
      subjectIdentifier = this.metadataStrategy.getSubjectIdentifier(identifier);
    }
    return store.getObjects(
      namedNode(subjectIdentifier.path), LDP.terms.constrainedBy, null,
    ).map((shape: Term): string => shape.value);
  }

  /**
   * Check path-based class constraints (D99 Layer 2). Extracts rdf:type values
   * from the incoming representation (best-effort — non-RDF bodies are skipped)
   * and calls evaluatePathConstraint. On violation, throws ShaclValidationError
   * with a synthesised sh:ValidationReport Turtle body.
   *
   * The representation stream is cloned before inspection so it remains readable
   * for the downstream SHACL validator.
   */
  protected async checkPathConstraint(identifier: ResourceIdentifier, representation: Representation): Promise<void> {
    if (this.pathConstraints.length === 0) {
      return;
    }
    // Extract the path component from the full URL (strip scheme + host)
    const url = new URL(identifier.path);
    const resourcePath = url.pathname;

    let resourceClasses: string[] = [];
    try {
      // Attempt to parse the representation as quads. Clone so the original
      // stream remains intact for the downstream SHACL validator.
      const clone = await cloneRepresentation(representation);
      const dataStore = await this.representationToStore(identifier, clone);
      resourceClasses = dataStore
        .getObjects(null, namedNode(RDF_TYPE), null)
        .map((t: Term) => t.value);
    } catch {
      // Non-RDF body (e.g. text/markdown) — skip path constraint check.
      this.logger.debug(`checkPathConstraint: could not parse body for ${resourcePath}, skipping`);
      return;
    }

    const result = evaluatePathConstraint(resourcePath, resourceClasses, this.pathConstraints);
    if (!result.ok && result.violation) {
      const violatingClass = result.violation.forbiddenClass ?? result.violation.notInAllowList ?? '';
      const reportTurtle = await this.buildPathViolationReport(result.violation.message, violatingClass);
      // Use an empty string for shapeURL since this is a path-level constraint,
      // not a SHACL shape URL. The violation message names the constraint.
      throw new ShaclValidationError('path-constraint', reportTurtle);
    }
  }

  /** Serialise a path-constraint violation as a sh:ValidationReport Turtle string. */
  private buildPathViolationReport(message: string, violatingClass: string): Promise<string> {
    const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
    const SH_NS = 'http://www.w3.org/ns/shacl#';
    const { quad, namedNode: nn, literal, blankNode } = DataFactory;

    const report = blankNode('report');
    const result = blankNode('r1');
    const quads = [
      quad(report, nn(`${RDF}type`), nn(`${SH_NS}ValidationReport`)),
      quad(report, nn(`${SH_NS}conforms`), literal('false', nn('http://www.w3.org/2001/XMLSchema#boolean'))),
      quad(report, nn(`${SH_NS}result`), result),
      quad(result, nn(`${RDF}type`), nn(`${SH_NS}ValidationResult`)),
      quad(result, nn(`${SH_NS}resultSeverity`), nn(`${SH_NS}Violation`)),
      quad(result, nn(`${SH_NS}resultPath`), nn(`${RDF}type`)),
      quad(result, nn(`${SH_NS}resultMessage`), literal(message)),
    ];
    if (violatingClass) {
      quads.push(quad(result, nn(`${SH_NS}value`), nn(violatingClass)));
    }

    return new Promise<string>((resolve, reject) => {
      const writer = new Writer({
        prefixes: {
          sh: SH_NS,
          rdf: RDF,
          xsd: 'http://www.w3.org/2001/XMLSchema#',
        },
      });
      for (const q of quads) {
        writer.addQuad(q);
      }
      writer.end((err: Error | null, res: string) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
  }
}
