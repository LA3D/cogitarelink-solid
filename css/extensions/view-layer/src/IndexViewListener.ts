/**
 * IndexViewListener — derived definition-line index.md children (SP2 Task 5;
 * RQ-Discovery-1 fork a: on-write static index.md child, NOT conneg).
 *
 * Subscribes to MonitoringStore 'changed' events. When a direct member of a
 * registered wiki container changes (Create/Update/Delete — body or .meta),
 * regenerates that container's index.md from the members' .meta graphs via
 * buildIndexMarkdown (the agreement-tested view of the declared query at
 * <viewsBase>/container-index), then merges derivation provenance into the
 * index's own .meta:
 *
 *   <index.md> prov:wasDerivedFrom  <container/> ;
 *              prov:wasGeneratedBy  <{viewsBase}container-index> ;
 *              prov:generatedAtTime "<now>"^^xsd:dateTime .
 *
 * The three prov triples are REPLACED each regeneration (no accumulation);
 * everything else in the index .meta is preserved (merge-don't-clobber).
 *
 * The index document itself is honestly typed: buildIndexMarkdown emits
 * frontmatter `type: sub:ContainerIndex` (SP2 amendment), which the projection
 * CURIE map resolves so `<#this> a sub:ContainerIndex` materializes through the
 * normal in-band floor — frontmatter type wins over the container's D98 class
 * fallback, and no deployed shape targets sub:ContainerIndex, so the floor
 * admits the write. The index .meta merge below ALSO passes the floor's direct
 * .meta validation: PageShape (the only shape that fires on it) keeps its
 * dct:title + schema:mainEntity from the materialized projection, which this
 * merge preserves.
 *
 * Re-entrancy: writing index.md emits a 'changed' event (and the in-band floor
 * materializes index.md.meta during the same write), but every self-write event
 * carries an index.md / index.md.meta / container-self path — all of which
 * memberContainer already filters. So the PATH FILTER alone suppresses
 * self-writes; there is deliberately NO global in-flight flag (an earlier
 * ops-index-style `deriving` flag gated event ENTRY and silently DROPPED real
 * member events arriving during a regeneration, leaving the index stale —
 * the test_delete_refreshes_index flake). Member events instead ALWAYS enqueue
 * onto the per-container promise chain: an event landing during a running
 * regeneration schedules a fresh regeneration after it (the running one may
 * have read pre-event state), and overlapping member writes serialize rather
 * than interleave half-written indexes.
 *
 * DELETE delivery: MonitoringStore emits 'changed' with as:Delete for the
 * removed resource itself, so member deletes regenerate from the post-delete
 * ldp:contains listing — verified live (tests/test_index_views.py).
 *
 * Registered containers = the six durable wiki containers. /working/ is
 * deliberately EXCLUDED (D73 two-stage commit: drafts are not navigable
 * member-of-record until crystallized).
 */
import { getLoggerFor } from "global-logger-factory";
import {
  Initializer,
  INTERNAL_QUADS,
  BasicRepresentation,
  readableToQuads,
} from "@solid/community-server";
import type { MonitoringStore, ResourceIdentifier } from "@solid/community-server";
import { DataFactory, Store } from "n3";
import type { Quad } from "@rdfjs/types";
import { buildIndexMarkdown } from "./indexView";

const { namedNode, literal, quad } = DataFactory;

const LDP_CONTAINS = "http://www.w3.org/ns/ldp#contains";
const PROV = "http://www.w3.org/ns/prov#";
const XSD_DATETIME = "http://www.w3.org/2001/XMLSchema#dateTime";

const PROV_PREDS = new Set([
  `${PROV}wasDerivedFrom`,
  `${PROV}wasGeneratedBy`,
  `${PROV}generatedAtTime`,
]);

export class IndexViewListener extends Initializer {
  protected readonly logger = getLoggerFor(this);

  // Registered container URLs (absolute, trailing slash).
  private readonly containerUrls: string[];

  // The view descriptor IRI for prov:wasGeneratedBy, derived from viewsBase.
  private readonly containerIndexView: string;

  // Per-container serialization: overlapping member writes chain rather than
  // interleave regenerations. Self-writes (index.md / index.md.meta) re-emit
  // 'changed' through the same MonitoringStore but are excluded by
  // memberContainer — no global in-flight flag (it would drop member events).
  private readonly pending = new Map<string, Promise<void>>();

  public constructor(
    private readonly store: MonitoringStore,
    baseUrl: string,
    containers: string[],
    viewsBase: string,
  ) {
    super();
    const root = baseUrl.replace(/\/$/u, "");
    this.containerUrls = containers.map((c): string =>
      c.startsWith("http") ? c : `${root}${c}`,
    );
    const base = viewsBase.endsWith("/") ? viewsBase : `${viewsBase}/`;
    this.containerIndexView = `${base}container-index`;
  }

  public async handle(): Promise<void> {
    this.store.on("changed", (target: ResourceIdentifier, _activity: unknown): void => {
      const ctr = this.memberContainer(target.path);
      if (!ctr) return;
      const prev = this.pending.get(ctr) ?? Promise.resolve();
      const next = prev
        .then((): Promise<void> => this.regenerate(ctr))
        .catch((err: unknown): void => {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`index-view: ${ctr}: ${msg}`);
        })
        .finally((): void => {
          // Prune the entry once the chain has settled so the map doesn't
          // accumulate resolved promises indefinitely.
          if (this.pending.get(ctr) === next) this.pending.delete(ctr);
        });
      this.pending.set(ctr, next);
    });
    this.logger.info(`IndexViewListener attached (${this.containerUrls.length} containers)`);
  }

  /**
   * The registered container `path` is a DIRECT member (or a member's .meta) of,
   * or undefined. The container itself, index.md, index.md.meta, and nested
   * resources (.operations/ etc.) all return undefined.
   */
  private memberContainer(path: string): string | undefined {
    const p = path.endsWith(".meta") ? path.slice(0, -".meta".length) : path;
    for (const ctr of this.containerUrls) {
      if (!p.startsWith(ctr)) continue;
      const rest = p.slice(ctr.length);
      if (!rest || rest.includes("/") || rest === "index.md") return undefined;
      return ctr;
    }
    return undefined;
  }

  private async regenerate(ctr: string): Promise<void> {
    const members = await this.members(ctr);

    // Gather every member's .meta quads (tolerate missing — e.g. a freshly
    // deleted member, or a member whose projection hasn't landed yet).
    const allStore = new Store();
    for (const member of members) {
      try {
        const rep = await (this.store as any).getRepresentation(
          { path: `${member}.meta` },
          { type: { [INTERNAL_QUADS]: 1 } },
        );
        allStore.addQuads((await readableToQuads(rep.data)).getQuads(null, null, null, null));
      } catch {
        // No .meta — skip this member.
      }
    }

    const markdown = buildIndexMarkdown(ctr, allStore.getQuads(null, null, null, null));
    const indexId = { path: `${ctr}index.md` };

    // Write the body. Goes through the full store chain: the in-band floor
    // validates the projected graph (frontmatter-typed sub:ContainerIndex —
    // unshaped, passes) and materializes index.md.meta as part of the same
    // setRepresentation call. The MarkdownProjectionListener fires async
    // post-event, so index.md.meta may gain additional quads after mergeProvenance
    // reads it — the merge preserves unknown triples (merge-don't-clobber), and
    // the next regeneration re-merges, so eventual consistency holds.
    await (this.store as any).setRepresentation(
      indexId,
      new BasicRepresentation(markdown, indexId, "text/markdown"),
    );

    await this.mergeProvenance(ctr, indexId.path);
    this.logger.debug(`index-view: regenerated ${indexId.path} (${members.length} members)`);
  }

  // Direct members from ldp:contains, excluding sub-containers and the index itself.
  private async members(ctr: string): Promise<string[]> {
    let ctrStore: Store;
    try {
      const rep = await (this.store as any).getRepresentation(
        { path: ctr },
        { type: { [INTERNAL_QUADS]: 1 } },
      );
      ctrStore = await readableToQuads(rep.data);
    } catch {
      return [];
    }
    return ctrStore
      .getQuads(null, LDP_CONTAINS, null, null)
      .map((q: Quad): string => q.object.value)
      .filter((m: string): boolean => !m.endsWith("/") && m !== `${ctr}index.md`);
  }

  /**
   * Merge the 3 derivation-provenance triples into the index's .meta:
   * read existing quads (the floor's materialized projection), drop any PRIOR
   * prov triples on the index subject (replace, don't accumulate), append the
   * fresh set, write back. The write passes the floor's direct-.meta validation
   * (PageShape conforms — title/mainEntity preserved; sub:ContainerIndex unshaped).
   */
  private async mergeProvenance(ctr: string, indexUrl: string): Promise<void> {
    const metaId = { path: `${indexUrl}.meta` };

    let existing: Quad[] = [];
    try {
      const rep = await (this.store as any).getRepresentation(
        metaId,
        { type: { [INTERNAL_QUADS]: 1 } },
      );
      existing = (await readableToQuads(rep.data)).getQuads(null, null, null, null);
    } catch {
      existing = [];
    }

    const kept = existing.filter(
      (q: Quad): boolean => !(q.subject.value === indexUrl && PROV_PREDS.has(q.predicate.value)),
    );
    const idx = namedNode(indexUrl);
    const next = [
      ...kept,
      quad(idx, namedNode(`${PROV}wasDerivedFrom`), namedNode(ctr)),
      quad(idx, namedNode(`${PROV}wasGeneratedBy`), namedNode(this.containerIndexView)),
      quad(idx, namedNode(`${PROV}generatedAtTime`),
        literal(new Date().toISOString(), namedNode(XSD_DATETIME))),
    ];

    await (this.store as any).setRepresentation(
      metaId,
      new BasicRepresentation(next, metaId, INTERNAL_QUADS),
    );
  }
}
