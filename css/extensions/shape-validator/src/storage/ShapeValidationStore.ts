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
import { LDP } from '../util/Vocabularies';
import type { ShapeValidator } from './validators/ShapeValidator';

const { namedNode } = DataFactory;

export class ShapeValidationStore extends PassthroughStore {
  private readonly identifierStrategy: IdentifierStrategy;
  private readonly metadataStrategy: AuxiliaryStrategy;
  private readonly converter: RepresentationConverter;
  private readonly validator: ShapeValidator;
  protected readonly logger = getLoggerFor(this);

  public constructor(
    source: ResourceStore,
    identifierStrategy: IdentifierStrategy,
    metadataStrategy: AuxiliaryStrategy,
    converter: RepresentationConverter,
    validator: ShapeValidator,
  ) {
    super(source);
    this.metadataStrategy = metadataStrategy;
    this.identifierStrategy = identifierStrategy;
    this.converter = converter;
    this.validator = validator;
  }

  public async addResource(identifier: ResourceIdentifier, representation: Representation, conditions?: Conditions): Promise<ChangeMap> {
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
}
