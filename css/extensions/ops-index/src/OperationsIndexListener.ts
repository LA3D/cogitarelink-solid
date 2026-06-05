/**
 * OperationsIndexListener — server-derived mem:hasOpenAction back-pointers (D112 §5).
 *
 * When a mem:RealignAction with schema:PotentialActionStatus is created in a
 * .operations/ ledger container, writes:
 *   <target> mem:hasOpenAction <proposal-url>
 * into the TARGET's .meta.
 *
 * When the status flips to Completed/Failed (Update) or the proposal is deleted,
 * removes the back-pointer.
 *
 * Floor/loop rule assignment: server-derived → inferable state. The server is
 * the authoritative source because the back-pointer is derivable from the
 * proposal's content; no agent needs to write it.
 *
 * KNOWN LIMIT (FOLLOWUPS): Delete-removal relies on the in-memory seen-map.
 * A server restart between Create and Delete leaves a dangling pointer. No
 * persistence is added here by design — noted in FOLLOWUPS.
 */
import { getLoggerFor } from "global-logger-factory";
import {
  AS,
  Initializer,
  INTERNAL_QUADS,
  BasicRepresentation,
  readableToQuads,
} from "@solid/community-server";
import type { MonitoringStore, ResourceIdentifier } from "@solid/community-server";
import type { Quad } from "@rdfjs/types";
import { Store, DataFactory } from "n3";
import { parseProposal, MEM_HAS_OPEN_ACTION, POTENTIAL } from "./parseProposal.js";

const { namedNode, quad } = DataFactory;

// Matches any resource directly under a .operations/ container
// e.g. /vault/wiki/.operations/proposal.ttl or /id/.operations/p1.ttl
const LEDGER_RE = /\/\.operations\/[^/]+$/u;

// Derive the .meta path for a given resource URL.
// CSS auxiliary strategy: append ".meta" to the resource URL (no trailing slash).
function metaPath(url: string): string {
  return `${url}.meta`;
}

export class OperationsIndexListener extends Initializer {
  protected readonly logger = getLoggerFor(this);

  // seen map: opUrl → targetUrl. Enables Delete-path removal without reading the
  // deleted resource. Restart gap is a KNOWN LIMIT (see FOLLOWUPS).
  private readonly seen = new Map<string, string>();

  // Re-entrancy guard: when WE write a .meta, the write goes back through the
  // same store. Without this, the 'changed' event our write emits would re-enter
  // onLedgerChange. Single-writer dev Pod; mirrors IdCatalogStore.deriving.
  private deriving = false;

  public constructor(private readonly store: MonitoringStore) {
    super();
  }

  public async handle(): Promise<void> {
    this.store.on("changed", (target: ResourceIdentifier, activity: unknown): void => {
      // Mirror MementoCommitListener: activity may be a NamedNode-like object
      // (with .value) or a plain string (older CSS versions).
      const iri = (activity as { value?: string }).value ?? String(activity);
      if (this.deriving || !LEDGER_RE.test(target.path)) return;
      this.onLedgerChange(target, iri).catch((err: unknown): void => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`ops-index: ${target.path}: ${msg}`);
      });
    });
    this.logger.info("OperationsIndexListener attached");
  }

  private async onLedgerChange(target: ResourceIdentifier, activityIri: string): Promise<void> {
    const opUrl = target.path;

    if (activityIri === AS.Delete) {
      // For Delete: look up the target in the seen map (resource is already gone).
      const targetUrl = this.seen.get(opUrl);
      if (!targetUrl) {
        this.logger.debug(`ops-index: Delete for unseen op ${opUrl}, skipping`);
        return;
      }
      this.seen.delete(opUrl);
      await this.setBackPointer(targetUrl, opUrl, false);
      return;
    }

    // For Create and Update: read the proposal and parse it.
    let proposalQuads: Quad[];
    try {
      const rep = await (this.store as any).getRepresentation(
        { path: opUrl },
        { type: { [INTERNAL_QUADS]: 1 } },
      );
      proposalQuads = await readableToQuads(rep.data).then((s: Store) =>
        s.getQuads(null, null, null, null),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.debug(`ops-index: could not read ${opUrl}: ${msg}`);
      return;
    }

    const proposal = parseProposal(proposalQuads, opUrl);
    if (!proposal) {
      this.logger.debug(`ops-index: ${opUrl} is not a RealignAction, skipping`);
      return;
    }

    const { target: targetUrl, status } = proposal;

    if (status === POTENTIAL) {
      // Create or re-assert the back-pointer.
      this.seen.set(opUrl, targetUrl);
      await this.setBackPointer(targetUrl, opUrl, true);
    } else {
      // Status flipped to Completed/Failed — remove the back-pointer.
      this.seen.delete(opUrl);
      await this.setBackPointer(targetUrl, opUrl, false);
    }
  }

  /**
   * Write or remove <targetUrl> mem:hasOpenAction <opUrl> in targetUrl's .meta.
   * MERGES with existing .meta quads — pre-existing triples are preserved.
   * Uses the re-entrancy guard (this.deriving) to prevent recursive 'changed' events.
   */
  private async setBackPointer(targetUrl: string, opUrl: string, present: boolean): Promise<void> {
    const metaUrl = metaPath(targetUrl);
    const metaId = { path: metaUrl };

    // Read existing .meta quads (tolerate missing — empty store on first write).
    let existingQuads: Quad[] = [];
    try {
      const rep = await (this.store as any).getRepresentation(
        metaId,
        { type: { [INTERNAL_QUADS]: 1 } },
      );
      const store = await readableToQuads(rep.data);
      existingQuads = store.getQuads(null, null, null, null);
    } catch {
      // .meta doesn't exist yet — start fresh.
      existingQuads = [];
    }

    // Remove the specific back-pointer quad (regardless of present/absent — idempotent).
    const targetNode = namedNode(targetUrl);
    const predNode = namedNode(MEM_HAS_OPEN_ACTION);
    const opNode = namedNode(opUrl);
    const kept = existingQuads.filter(
      (q: any) => !(
        q.subject.value === targetUrl &&
        q.predicate.value === MEM_HAS_OPEN_ACTION &&
        q.object.value === opUrl
      ),
    );

    // Add the back-pointer if present=true.
    const next = present
      ? [...kept, quad(targetNode, predNode, opNode)]
      : kept;

    // Write back via the store, with the re-entrancy guard active.
    this.deriving = true;
    try {
      await (this.store as any).setRepresentation(
        metaId,
        new BasicRepresentation(next, metaId, INTERNAL_QUADS),
      );
    } finally {
      this.deriving = false;
    }
  }
}
