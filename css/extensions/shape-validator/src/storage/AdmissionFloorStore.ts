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
 * D73 two-stage commit (e.g. /working/) needs NO special case here (audit FOLLOWUPS #5):
 * the permissive tier is carried by the DATA MODEL, not a path substring. A working
 * container's ldp:constrainedBy points at a permissive shape (sh:closed false, no
 * mandatory predicates) that any draft conforms to trivially — so validating the
 * projected graph against the container shape IS the policy. The former
 * isPermissive('/working/') substring bypass was empirically redundant and has been
 * removed; the shape decides, uniformly, for every container.
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
  isContainerIdentifier,
  NotFoundHttpError,
  INTERNAL_QUADS,
  AS,
  SOLID_AS,
  find,
} from '@solid/community-server';
import type { Quad } from '@rdfjs/types';
import { Store, Parser, DataFactory } from 'n3';
import { createHash } from 'crypto';
import { getLoggerFor } from 'global-logger-factory';
import { RDF_CONTENT_TYPES } from '../util/ContentTypes';
import { DEFAULT_STAMP_PRED } from '../util/StampPredicate';
import { LDP } from '../util/Vocabularies';
import type { BodyProjector } from './BodyProjector';
import { validateQuadsAgainstShape } from './validators/validateQuadsAgainstShape.js';
import { ShaclValidationError } from '../error/ShaclValidationError';

// Default body-hash stamp predicate. Recorded on the resource subject in .meta so
// the substrate can detect post-admission body edits that bypassed the floor. The
// deployment IRI lives in util (host out of THIS source — a layering test bans the
// host here) and is wired via config (the stampPredicate constructor param, like
// storagePath). Re-exported as STAMP_PRED so importers keep one import site; the
// stampAgreement test asserts config == this constant on both sides.
export const STAMP_PRED = DEFAULT_STAMP_PRED;

export class AdmissionFloorStore extends PassthroughStore {
  protected readonly logger = getLoggerFor(this);

  // Duck-typed BodyProjector. The constructor parameter is typed `unknown` so
  // componentsjs-generator emits ParameterRangeWildcard (mirrors ShaclValidator's
  // unprocessableHook) — this lets a structurally-compatible BodyProjector impl
  // injected from a sibling bundle without a nominal cross-bundle range mismatch
  // (BodyProjector is an interface declared in THIS bundle; the impl lives in
  // another). Internal usage narrows via the cast below.
  private readonly projector: BodyProjector;

  public constructor(
    source: ResourceStore,
    private readonly identifierStrategy: IdentifierStrategy,
    private readonly auxiliaryStrategy: AuxiliaryStrategy,
    projector: unknown,
    // Body-hash stamp predicate. LAST param + defaulted to STAMP_PRED so existing
    // unit tests stay green; the deployment IRI is supplied via config (like
    // storagePath) so this profile-agnostic store names no host.
    private readonly stampPredicate: string = STAMP_PRED,
  ) {
    super(source);
    this.projector = projector as BodyProjector;
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
    // target (the .meta graph) is gated regardless of the write path. The REAL runtime
    // path is PatchingStore → N3Patcher: it reads the current .meta as internal/quads,
    // applies the N3 patch, and calls this setRepresentation with the patched graph whose
    // contentType is 'internal/quads' (NOT a textual RDF type). A raw PUT of text/turtle
    // to a governed .meta reaches the same branch with TEXT data. Both must be floored.
    // Scope guard: the container's own .meta (ldp:contains listing) is exempt — only
    // a governed resource's .meta is floored.
    if (this.auxiliaryStrategy.isAuxiliaryIdentifier(id)) {
      const subject = this.auxiliaryStrategy.getSubjectIdentifier(id);
      const subjectIsContainer = isContainerIdentifier(subject);
      const shapesForMeta = subjectIsContainer ? [] : await this.constrainedByFor(subject);
      // A governed resource's .meta is RDF by definition: validate internal/quads (the
      // patched-graph path), any textual RDF serialisation (the raw-PUT path), or a missing
      // content-type. We do not silently skip — if a bizarre non-RDF type ever arrives for a
      // .meta, validating-by-parse fails loudly below, which is the correct outcome.
      if (shapesForMeta.length > 0 && this.isMetaRdfWrite(representation)) {
        // Clone before consuming the stream — the original must still flow to super.
        const cloned = await cloneRepresentation(representation);
        const dataStore = await this.metaQuads(cloned, id);
        const result = await validateQuadsAgainstShape(dataStore, await this.shapeStore(shapesForMeta));
        if (!result.conforms) {
          throw new ShaclValidationError(shapesForMeta[0], result.reportTurtle!);
        }
      }
      return super.setRepresentation(id, representation, conditions);
    }

    const shapeUrls = await this.constrainedByFor(id);
    // Not a constrained container, or a content-type the projector doesn't handle
    // (RDF bodies) → pass straight through. RDF bodies are validated by the existing
    // ShapeValidationStore path.
    if (
      shapeUrls.length === 0 ||
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
    // conformsOrReject throws ShaclValidationError on a shape failure. (A working
    // container's permissive shape conforms trivially, so drafts pass here.)
    await this.conformsOrReject(projected.quads, shapeUrls);

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
    let shapeUrls: string[] = [];
    try {
      const rep = await this.source.getRepresentation(container, {});
      // getAll, not get: a multi-shape container (concepts/) holds >1 constrainedBy,
      // and get THROWS on multiple values.
      shapeUrls = rep.metadata.getAll(LDP.terms.constrainedBy).map((t) => t.value);
    } catch (error: unknown) {
      if (!NotFoundHttpError.isInstance(error)) {
        throw error;
      }
    }
    if (shapeUrls.length === 0 || !this.projector.canProject(representation)) {
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
      await this.conformsOrReject(projected.quads, shapeUrls);
    } catch (error: unknown) {
      // Roll back the just-created resource so a rejected POST leaves no residue.
      await this.source.deleteResource(created);
      throw error;
    }
    await this.materialize(created, projected, body);
    return changes;
  }

  // Validate the projected graph against the container shape. Resolves on conformance;
  // throws ShaclValidationError (→ 422 + Turtle report) otherwise. Permissive (D73
  // /working/) containers need no special case: their constrainedBy shape conforms
  // trivially for drafts, so the shape verdict IS the policy (audit FOLLOWUPS #5).
  private async conformsOrReject(
    quads: Quad[],
    shapeUrls: string[],
  ): Promise<void> {
    const result = await validateQuadsAgainstShape(new Store(quads), await this.shapeStore(shapeUrls));
    if (result.conforms) {
      return;
    }
    // The ShaclValidationError needs ONE shapeURL for its message; use the container's
    // primary (first-declared) shape. The 422 BODY (result.reportTurtle) carries the
    // real failing shape's details (sh:sourceShape per result), so naming the primary
    // here is the least-misleading single-URL choice — the report disambiguates.
    throw new ShaclValidationError(shapeUrls[0], result.reportTurtle!);
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
    await this.projector.materialize(id, stamped, [ ...projected.governed, this.stampPredicate ]);
  }

  /**
   * ALL ldp:constrainedBy shape URLs of the parent container (D108 §1.5: container = the
   * shape SET, class = dispatch by sh:targetClass within it). Empty when unconstrained /
   * root / missing. A container may declare more than one constrainedBy (one container can
   * hold resources of several classes, each with its own shape), so this is plural; getAll
   * (NOT get, which THROWS on multiple values) reads them. Order is the metadata's: index 0
   * is the container's primary shape (used as the least-misleading ShaclValidationError URL).
   */
  private async constrainedByFor(id: ResourceIdentifier): Promise<string[]> {
    if (this.identifierStrategy.isRootContainer(id)) {
      return [];
    }
    const parent = this.identifierStrategy.getParentContainer(id);
    try {
      const rep = await this.source.getRepresentation(parent, {});
      return rep.metadata.getAll(LDP.terms.constrainedBy).map((t) => t.value);
    } catch (error: unknown) {
      if (NotFoundHttpError.isInstance(error)) {
        return [];
      }
      throw error;
    }
  }

  // Fetch EACH constrainedBy shape doc and MERGE the quads into one Store. SHACL targeting
  // then dispatches by class naturally: a node is validated only by the NodeShapes whose
  // sh:targetClass it carries. A shape whose target class a node does NOT have is inert for
  // that node (no spurious 422); a shape that references another via sh:node has that other
  // resolved in the merged store. Both validation paths (markdown-body + direct .meta) call
  // this with the same URL set, so they cannot diverge on semantics.
  private async shapeStore(shapeUrls: string[]): Promise<Store> {
    const merged = new Store();
    for (const url of shapeUrls) {
      const shape = await fetchDataset(url);
      merged.addQuads((await readableToQuads(shape.data)).getQuads(null, null, null, null));
    }
    return merged;
  }

  // True when a .meta write should be validated as RDF. A governed resource's .meta is
  // RDF by definition, so this accepts CSS's internal quad-object stream (internal/quads —
  // the PatchingStore → N3Patcher runtime path), any textual RDF serialisation (the raw-PUT
  // path), and a missing content-type. A non-RDF content-type is still admitted here and
  // fails loudly at parse time in metaQuads(), rather than being silently skipped.
  private isMetaRdfWrite(representation: Representation): boolean {
    const ct = representation.metadata.contentType;
    if (!ct) return true;
    if (ct === INTERNAL_QUADS) return true;
    return RDF_CONTENT_TYPES.has(ct);
  }

  // Read a .meta representation into a quad Store, handling both runtime shapes:
  //   - internal/quads (PatchingStore → N3Patcher): data IS a stream of quad objects.
  //   - textual RDF (raw PUT of text/turtle): data is TEXT — parse with N3. Base IRI is the
  //     .meta document's own URL (id.path) so relative IRIs resolve as the projection produces
  //     them (MetaWriter uses the same `${resourceUrl}.meta` base for its read cycle).
  private async metaQuads(representation: Representation, id: ResourceIdentifier): Promise<Store> {
    if (representation.metadata.contentType === INTERNAL_QUADS) {
      return await readableToQuads(representation.data);
    }
    const text = await readableToString(representation.data);
    return new Store(new Parser({ baseIRI: id.path }).parse(text));
  }

  private stampQuad(id: ResourceIdentifier, body: string) {
    const hash = createHash('sha256').update(body).digest('hex');
    return DataFactory.quad(
      DataFactory.namedNode(id.path),
      DataFactory.namedNode(this.stampPredicate),
      DataFactory.literal(hash),
    );
  }
}
