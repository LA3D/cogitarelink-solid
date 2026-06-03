/**
 * AdmissionFloorStore — D108 Front-2 admission floor (the in-band SHACL 422).
 *
 * A PassthroughStore wrapper that gates writes to constrained containers. For
 * non-RDF bodies it cannot validate directly (a SHACL validator validates RDF),
 * so it asks a BodyProjector to project the body into its candidate .meta graph,
 * validates THAT against the container's ldp:constrainedBy shape, and rejects with
 * a 422 (ShaclValidationError, Turtle report body) when the projected graph does
 * not conform. On success it commits the body and asks the projector to
 * materialize the projected graph (plus a body-hash stamp) into the .meta — in-band,
 * synchronously (RQ-Enforce-1), so retrieval immediately reflects the admitted graph.
 *
 * Layering: this file is PROFILE-AGNOSTIC. It must name no profile-specific vocabulary
 * or pipeline symbols (a layering test greps the floor source) — materialization (which
 * needs the ESM-only MetaWriter) is owned by the BodyProjector, not the floor. RDF
 * bodies are validated by the existing ShapeValidationStore / ShaclValidator path; this
 * store passes them through.
 *
 * Permissive containers (D73 two-stage commit, e.g. /working/) skip the reject but
 * still project + materialize, so the candidate graph is observable before crystallize.
 */
import type {
  ResourceStore,
  Representation,
  ResourceIdentifier,
  Conditions,
  ChangeMap,
  IdentifierStrategy,
  AuxiliaryStrategy,
} from '@solid/community-server';
import {
  PassthroughStore,
  BasicRepresentation,
  cloneRepresentation,
  readableToString,
  readableToQuads,
  fetchDataset,
  NotFoundHttpError,
  AS,
  SOLID_AS,
  find,
} from '@solid/community-server';
import type { Quad } from '@rdfjs/types';
import { Store, DataFactory } from 'n3';
import { createHash } from 'crypto';
import { getLoggerFor } from 'global-logger-factory';
import { LDP } from '../util/Vocabularies';
import type { BodyProjector } from './BodyProjector';
import { validateQuadsAgainstShape } from './validators/validateQuadsAgainstShape.js';
import { ShaclValidationError } from '../error/ShaclValidationError';

// Body-hash stamp predicate. Recorded on the resource subject in .meta so the
// substrate can detect post-admission body edits that bypassed the floor.
export const STAMP_PRED = 'https://pod.vardeman.me/vault/ontology/substrate#bodyHash';

export class AdmissionFloorStore extends PassthroughStore {
  protected readonly logger = getLoggerFor(this);

  public constructor(
    source: ResourceStore,
    private readonly identifierStrategy: IdentifierStrategy,
    private readonly auxiliaryStrategy: AuxiliaryStrategy,
    private readonly projector: BodyProjector,
  ) {
    super(source);
  }

  // PUT path. The resource identifier is known up-front, so we project + validate
  // BEFORE committing — a rejection never touches the backend (no rollback needed).
  public async setRepresentation(
    id: ResourceIdentifier,
    representation: Representation,
    conditions?: Conditions,
  ): Promise<ChangeMap> {
    // --- Direct .meta write path (Task 8) ---
    // A PATCH/PUT to a governed resource's .meta must be validated so the conformance
    // target (the .meta graph) is gated regardless of the write path. PatchingStore
    // applies the N3 patch and calls setRepresentation with the resulting RDF graph.
    // Scope guard: the container's own .meta (ldp:contains listing) is exempt — only
    // a governed resource's .meta is floored.
    if (this.auxiliaryStrategy.isAuxiliaryIdentifier(id)) {
      const subject = this.auxiliaryStrategy.getSubjectIdentifier(id);
      const subjectIsContainer = subject.path.endsWith('/');
      const shapeForMeta = subjectIsContainer ? undefined : await this.constrainedByFor(subject);
      if (shapeForMeta && this.isRdfRepresentation(representation) && !this.isPermissive(subject)) {
        // Clone before consuming the stream — the original must still flow to super.
        const cloned = await cloneRepresentation(representation);
        const dataStore = await readableToQuads(cloned.data);
        const result = await validateQuadsAgainstShape(dataStore, await this.shapeStore(shapeForMeta));
        if (!result.conforms) {
          throw new ShaclValidationError(shapeForMeta, result.reportTurtle!);
        }
      }
      return super.setRepresentation(id, representation, conditions);
    }

    const shapeUrl = await this.constrainedByFor(id);
    // Not a constrained container, or a content-type the projector doesn't handle
    // (RDF bodies) → pass straight through. RDF bodies are validated by the existing
    // ShapeValidationStore path.
    if (
      !shapeUrl ||
      !this.projector.canProject(representation)
    ) {
      return super.setRepresentation(id, representation, conditions);
    }

    // The stream is single-use: read it to a string, then re-wrap every delegate
    // call as a fresh BasicRepresentation so the body is re-readable downstream.
    const body = await readableToString(representation.data);

    const projected = await this.projector.project(id, body);
    if (!projected) {
      // Projector recognised the content-type but the body is not substrate-governed
      // (no thing class) → admit it unvalidated, no materialization.
      return super.setRepresentation(id, new BasicRepresentation(body, representation.metadata), conditions);
    }

    // Reject BEFORE committing — a non-conforming PUT never reaches the backend.
    // conformsOrPermissive throws ShaclValidationError on a non-permissive failure.
    await this.conformsOrPermissive(id, projected.quads, shapeUrl);

    // Commit the body first (so the resource exists on disk before MetaWriter
    // resolves its path), then materialize the admitted graph + body-hash stamp.
    const committed = await super.setRepresentation(
      id,
      new BasicRepresentation(body, representation.metadata),
      conditions,
    );
    await this.materialize(id, projected, body);
    return committed;
  }

  // POST path. PassthroughStore.addResource delegates straight to source.addResource
  // (it does NOT route through setRepresentation), and the slug→identifier resolution
  // happens in the backend — so the final resource identifier is unknown until after
  // creation. We therefore commit first, then project + validate against the created
  // identifier; a non-conforming, non-permissive POST is rolled back (deleteResource)
  // before the 422 propagates, so the floor is still all-or-nothing.
  public async addResource(
    container: ResourceIdentifier,
    representation: Representation,
    conditions?: Conditions,
  ): Promise<ChangeMap> {
    let shapeUrl: string | undefined;
    try {
      const rep = await this.source.getRepresentation(container, {});
      shapeUrl = rep.metadata.get(LDP.terms.constrainedBy)?.value;
    } catch (error: unknown) {
      if (!NotFoundHttpError.isInstance(error)) {
        throw error;
      }
    }
    if (!shapeUrl || !this.projector.canProject(representation)) {
      return super.addResource(container, representation, conditions);
    }

    const body = await readableToString(representation.data);
    const changes = await super.addResource(
      container,
      new BasicRepresentation(body, representation.metadata),
      conditions,
    );
    const created = find(
      changes.keys(),
      (idf: ResourceIdentifier) =>
        Boolean(changes.get(idf)?.has(SOLID_AS.terms.activity, AS.terms.Create)),
    );
    if (!created) {
      return changes;
    }

    const projected = await this.projector.project(created, body);
    if (!projected) {
      return changes;
    }

    try {
      await this.conformsOrPermissive(created, projected.quads, shapeUrl);
    } catch (error: unknown) {
      // Roll back the just-created resource so a rejected POST leaves no residue.
      await this.source.deleteResource(created);
      throw error;
    }
    await this.materialize(created, projected, body);
    return changes;
  }

  // Validate the projected graph against the container shape. Resolves on conformance
  // OR when the target is a permissive (D73 /working/) container; throws
  // ShaclValidationError (→ 422 + Turtle report) for a non-permissive non-conformance.
  private async conformsOrPermissive(
    id: ResourceIdentifier,
    quads: Quad[],
    shapeUrl: string,
  ): Promise<void> {
    const result = await validateQuadsAgainstShape(new Store(quads), await this.shapeStore(shapeUrl));
    if (result.conforms || this.isPermissive(id)) {
      return;
    }
    throw new ShaclValidationError(shapeUrl, result.reportTurtle!);
  }

  // Materialize the admitted graph + a body-hash stamp into the resource's .meta,
  // replacing only governed predicates (D81 Model A). Delegated to the projector
  // because MetaWriter is ESM-only and the floor stays profile-agnostic.
  private async materialize(
    id: ResourceIdentifier,
    projected: { quads: Quad[]; governed: string[] },
    body: string,
  ): Promise<void> {
    const stamped = [ ...projected.quads, this.stampQuad(id, body) ];
    await this.projector.materialize(id, stamped, [ ...projected.governed, STAMP_PRED ]);
  }

  /** ldp:constrainedBy of the parent container, or undefined if unconstrained/root/missing. */
  private async constrainedByFor(id: ResourceIdentifier): Promise<string | undefined> {
    if (this.identifierStrategy.isRootContainer(id)) {
      return undefined;
    }
    const parent = this.identifierStrategy.getParentContainer(id);
    try {
      const rep = await this.source.getRepresentation(parent, {});
      return rep.metadata.get(LDP.terms.constrainedBy)?.value;
    } catch (error: unknown) {
      if (NotFoundHttpError.isInstance(error)) {
        return undefined;
      }
      throw error;
    }
  }

  private async shapeStore(shapeUrl: string): Promise<Store> {
    const shape = await fetchDataset(shapeUrl);
    return await readableToQuads(shape.data);
  }

  // D73 two-stage commit: writes under a permissive (working) container are admitted
  // even when non-conforming, then crystallized into a durable container later.
  private isPermissive(id: ResourceIdentifier): boolean {
    return id.path.includes('/working/');
  }

  // True if the representation's content-type is a recognised RDF serialisation.
  // A .meta write is RDF by definition; treat a missing content-type as RDF.
  private isRdfRepresentation(representation: Representation): boolean {
    const ct = representation.metadata.contentType;
    if (!ct) return true;
    return [
      'text/turtle',
      'application/ld+json',
      'application/n-triples',
      'application/n-quads',
      'application/trig',
      'text/n3',
      'application/rdf+xml',
    ].includes(ct);
  }

  private stampQuad(id: ResourceIdentifier, body: string) {
    const hash = createHash('sha256').update(body).digest('hex');
    return DataFactory.quad(
      DataFactory.namedNode(id.path),
      DataFactory.namedNode(STAMP_PRED),
      DataFactory.literal(hash),
    );
  }
}
