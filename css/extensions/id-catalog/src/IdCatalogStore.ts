/**
 * IdCatalogStore — the server-derived identifier-scheme catalog (D111 §4.4).
 *
 * The Pod hosts an LDP container of identifier-scheme records (`/id/schemes/doi`, etc.),
 * each an agent-written Turtle doc validated by SchemeRecordShape. The catalog container's
 * own RDF must carry one server-derived "thin entry" per record so `GET /id/schemes/`
 * serves the whole scheme index. Those derived triples are the SUBSTRATE's, not the
 * agent's — exactly like `ldp:contains`: an agent may NEVER author them.
 *
 * This PassthroughStore wrapper enforces that split:
 *   - a record write (PUT/POST under the catalog) → pass the body through, then derive the
 *     thin entry from the just-written record and rewrite the catalog .meta, in-band;
 *   - a record delete → pass through, then remove that record's entry from the .meta;
 *   - a client write that TOUCHES the catalog container / its .meta / a catalog-fragment
 *     subject (`<…/id/schemes/#doi>`) → reject with 409 ConflictHttpError. Write the
 *     RECORD, not the index.
 *
 * Mirrors the AdmissionFloorStore idiom: PassthroughStore subclass, clone-before-read of
 * single-use streams, BasicRepresentation re-wraps, `find(changes.keys(), …Create)` to
 * recover the POST-created identifier, `readableToQuads`/`readableToString` for reads, an
 * INTERNAL_QUADS .meta read cycle, and an N3 Writer for the Turtle the .meta is written as.
 *
 * Server wiring (Components.js) is the NEXT task — this file is build + unit tests only.
 */
import type {
  ResourceStore,
  Representation,
  ResourceIdentifier,
  Conditions,
  ChangeMap,
  Patch,
} from '@solid/community-server';
import {
  PassthroughStore,
  BasicRepresentation,
  cloneRepresentation,
  readableToString,
  readableToQuads,
  ConflictHttpError,
  INTERNAL_QUADS,
  AS,
  SOLID_AS,
  find,
} from '@solid/community-server';
import type { Quad } from '@rdfjs/types';
import { Store, Writer, Parser, DataFactory } from 'n3';
import { getLoggerFor } from 'global-logger-factory';
import { deriveThinEntry, findDerivedSubjects } from './deriveEntry.js';

const FOAF_IS_PRIMARY_TOPIC_OF = 'http://xmlns.com/foaf/0.1/isPrimaryTopicOf';

export class IdCatalogStore extends PassthroughStore {
  protected readonly logger = getLoggerFor(this);

  // The catalog container URL (ends with '/'). Its .meta carries the derived index.
  // CSS's auxiliary strategy appends `.meta` to the container URL incl. trailing slash
  // → `/id/schemes/.meta` (NOT `/id/schemes.meta`).
  private readonly catalogMetaPath: string;

  // Re-entrancy guard: when WE rewrite the catalog .meta, the write goes back through
  // this.source (below Locking — see rewriteMeta) and must NOT be re-rejected by the
  // container/.meta guards. Single-writer dev Pod; revisit at multi-agent WAC activation.
  private deriving = false;

  public constructor(
    source: ResourceStore,
    private readonly catalogUrl: string,
  ) {
    super(source);
    if (!catalogUrl.endsWith('/')) throw new Error('catalogUrl must end with "/" (container URL)');
    this.catalogMetaPath = `${catalogUrl}.meta`;
  }

  // --- write guards + record derivation (PUT) --------------------------------

  public async setRepresentation(
    id: ResourceIdentifier,
    representation: Representation,
    conditions?: Conditions,
  ): Promise<ChangeMap> {
    if (!this.deriving && this.isCatalogOrMeta(id)) {
      throw this.derivedConflict([ this.catalogUrl ]);
    }
    if (this.isRecord(id)) {
      // Clone before consuming the stream — the original must still flow to source.
      const cloned = await cloneRepresentation(representation);
      const result = await this.source.setRepresentation(id, representation, conditions);
      await this.deriveForRecord(id.path, cloned);
      return result;
    }
    return super.setRepresentation(id, representation, conditions);
  }

  // --- PATCH guard (N3 Patch over the catalog .meta) -------------------------

  public async modifyResource(
    id: ResourceIdentifier,
    patch: Patch,
    conditions?: Conditions,
  ): Promise<ChangeMap> {
    if (!this.deriving && this.isCatalogOrMeta(id)) {
      // Clone before reading: the patch stream is single-use and must still reach source.
      const cloned = await cloneRepresentation(patch);
      const body = await readableToString(cloned.data);
      // Our guard only acts on patches it can READ. A body our N3 parser rejects can't be
      // a well-formed insert of derived triples either — so pass it through. CSS's own
      // patch handler (same N3.js family) then rejects it with the correct 4xx, instead of
      // our layer leaking a raw parse error as a 500.
      let touched: string[];
      try {
        touched = findDerivedSubjects(body, this.catalogUrl);
      } catch (error: unknown) {
        this.logger.debug(`id-catalog: unparseable patch on ${id.path}, passing through to source: ${error}`);
        return super.modifyResource(id, patch, conditions);
      }
      if (touched.length > 0) {
        throw this.derivedConflict(touched);
      }
    }
    return super.modifyResource(id, patch, conditions);
  }

  // --- POST derivation (addResource onto the catalog) ------------------------

  public async addResource(
    container: ResourceIdentifier,
    representation: Representation,
    conditions?: Conditions,
  ): Promise<ChangeMap> {
    if (container.path !== this.catalogUrl) {
      return super.addResource(container, representation, conditions);
    }
    // The slug→identifier resolution happens in the backend, so the record URL is
    // unknown until after creation — clone, commit, then recover the created id from
    // the ChangeMap (same pattern AdmissionFloorStore uses for POST gating).
    const cloned = await cloneRepresentation(representation);
    const changes = await this.source.addResource(container, representation, conditions);
    const created = find(
      changes.keys(),
      (idf: ResourceIdentifier) =>
        Boolean(changes.get(idf)?.has(SOLID_AS.terms.activity, AS.terms.Create)),
    );
    if (created) {
      await this.deriveForRecord(created.path, cloned);
    }
    return changes;
  }

  // --- DELETE: drop the record's entry from the index ------------------------

  public async deleteResource(
    id: ResourceIdentifier,
    conditions?: Conditions,
  ): Promise<ChangeMap> {
    const wasRecord = this.isRecord(id);
    const result = await super.deleteResource(id, conditions);
    if (wasRecord) {
      try {
        await this.rewriteMeta(id.path, null);
      } catch (error: unknown) {
        // The record delete succeeded; a derivation failure must not fail the client's
        // request. The audit bijection check (record ↔ entry) is the backstop.
        this.logger.error(`id-catalog: failed to drop entry for deleted ${id.path}: ${error}`);
      }
    }
    return result;
  }

  // --- derivation core -------------------------------------------------------

  // Parse the just-written record (Turtle, baseIRI = record URL), derive its thin entry,
  // and rewrite the catalog .meta with it. A derivation failure is logged, never thrown:
  // the record write already succeeded.
  private async deriveForRecord(recordUrl: string, body: Representation): Promise<void> {
    try {
      const text = await readableToString(body.data);
      const quads = new Parser({ baseIRI: recordUrl }).parse(text);
      const entry = deriveThinEntry(quads, recordUrl, this.catalogUrl);
      if (!entry) {
        // No catalog-fragment primaryTopic — the floor should have rejected this record.
        // Belt-and-suspenders: log and leave the index untouched.
        this.logger.warn(`id-catalog: ${recordUrl} has no catalog-fragment primaryTopic; no entry derived`);
        return;
      }
      await this.rewriteMeta(recordUrl, entry);
    } catch (error: unknown) {
      this.logger.error(`id-catalog: failed to derive entry for ${recordUrl}: ${error}`);
    }
  }

  /**
   * Rewrite the catalog .meta with one record's entry. `entry === null` means delete
   * (the record was removed). The contract is replace-PER-RECORD: drop the record's
   * OLD entry, then add the new one. The old entry is identified by its
   * `foaf:isPrimaryTopicOf → recordUrl` back-link in the CURRENT store (so a topic
   * CHANGE — `#doi → #doi-new` — doesn't orphan the stale `#doi` entry), plus the new
   * entry's own subject (covers a first-PUT after manual cleanup). Delete uses only the
   * back-link match (the new topic isn't known from the recordUrl alone).
   *
   * Lock trade-off: the internal write goes through this.source BELOW the platform's
   * Locking layer (this store wraps the resource store, the lock wraps the request).
   * Acceptable on a single-writer dev Pod; revisit at multi-agent WAC activation — see
   * the AdmissionFloorStore materialize() lock note for the same trade-off.
   */
  private async rewriteMeta(recordUrl: string, entry: Quad[] | null): Promise<void> {
    const existing = await this.readMetaQuads();

    // Subjects of the record's OLD entry: every subject back-linked to this record
    // (the same match the delete path uses — replace-per-record, not replace-by-topic),
    // plus, when adding, the new entry's own subject.
    const recordNode = DataFactory.namedNode(recordUrl);
    const topicValues = new Set(
      existing
        .getQuads(null, DataFactory.namedNode(FOAF_IS_PRIMARY_TOPIC_OF), recordNode, null)
        .map((q) => q.subject.value),
    );
    if (entry) {
      for (const q of entry) topicValues.add(q.subject.value);
    }

    const kept = existing
      .getQuads(null, null, null, null)
      .filter((q) => !topicValues.has(q.subject.value));

    const next = new Store([ ...kept, ...(entry ?? []) ]);
    const ttl = await this.writeTurtle(next);

    const metaId = { path: this.catalogMetaPath };
    this.deriving = true;
    try {
      await this.source.setRepresentation(metaId, new BasicRepresentation(ttl, 'text/turtle'));
    } finally {
      this.deriving = false;
    }
  }

  // Read the current catalog .meta as quads (INTERNAL_QUADS — the runtime read shape).
  // A missing .meta resolves to an empty store (the first record bootstraps the index).
  private async readMetaQuads(): Promise<Store> {
    try {
      const rep = await this.source.getRepresentation(
        { path: this.catalogMetaPath },
        { type: { [INTERNAL_QUADS]: 1 } },
      );
      return await readableToQuads(rep.data);
    } catch {
      return new Store();
    }
  }

  private writeTurtle(store: Store): Promise<string> {
    const writer = new Writer();
    for (const q of store.getQuads(null, null, null, null)) {
      writer.addQuad(q);
    }
    return new Promise<string>((resolve, reject) => {
      writer.end((err, result) => (err ? reject(err) : resolve(result)));
    });
  }

  // --- identity predicates ---------------------------------------------------

  private isCatalogOrMeta(id: ResourceIdentifier): boolean {
    return id.path === this.catalogUrl || id.path === this.catalogMetaPath;
  }

  // A record target: a resource directly under the catalog container that is not the
  // container itself, not its .meta, not a sub-container (no trailing slash).
  private isRecord(id: ResourceIdentifier): boolean {
    const p = id.path;
    return (
      p.startsWith(this.catalogUrl) &&
      p !== this.catalogUrl &&
      p !== this.catalogMetaPath &&
      !p.endsWith('.meta') &&
      // sub-containers of the catalog escape both guards — the floor gate on the parent container handles them
      !p.endsWith('/')
    );
  }

  private derivedConflict(subjects: string[]): ConflictHttpError {
    return new ConflictHttpError(
      `Catalog triples for ${subjects.join(', ')} are server-derived (D111); write the record, not the index.`,
    );
  }
}
