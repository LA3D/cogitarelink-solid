import { getLoggerFor } from "global-logger-factory";
import {
  Initializer,
  type MonitoringStore,
  type ResourceIdentifier,
  type ResourceStore,
} from "@solid/community-server";

import { UnprocessableWriteDetector } from "./detectors/UnprocessableWriteDetector";
import { BoundExceededDetector } from "./detectors/BoundExceededDetector";
import { ReflectionDueDetector } from "./detectors/ReflectionDueDetector";
import { ContradictionDetector } from "./detectors/ContradictionDetector";
import { EventEmitter } from "./EventEmitter";

/**
 * MemTriggerListener — MonitoringStore CDC subscriber for wiki-memory L3.
 *
 * v1 wires only the BoundExceeded detector path (stubbed against the
 * in-process ResourceStore — counts ldp:contains children of the parent
 * container on each non-event write). The other three detectors are
 * instantiated but not yet invoked; their substrate hooks (shape-validator
 * failure events for UnprocessableWrite, timer for ReflectionDue, body
 * projection edges for ContradictionDetected) are post-v1 wiring work.
 * See FOLLOWUPS.md.
 *
 * Mirrors MementoCommitListener: extends Initializer, takes MonitoringStore
 * via constructor, subscribes to 'changed' in handle(), serializes work
 * via a chain Promise.
 */
export class MemTriggerListener extends Initializer {
  private readonly logger = getLoggerFor(this);
  private readonly monitoringStore: MonitoringStore;
  private readonly store: ResourceStore;
  private readonly eventsContainer: string;
  private readonly baseUrl: string;

  private readonly emitter: EventEmitter;
  private readonly unprocessable: UnprocessableWriteDetector;
  private readonly bound: BoundExceededDetector;
  private readonly reflection: ReflectionDueDetector;
  private readonly contradiction: ContradictionDetector;

  private readonly lastBoundEmit = new Map<string, Date>();
  private chain: Promise<void> = Promise.resolve();

  public constructor(
    monitoringStore: MonitoringStore,
    store: ResourceStore,
    eventsContainer: string,
    baseUrl: string,
    boundThreshold: number,
    reflectionIntervalMs: number,
    contradictoryPairs: Array<[string, string]>,
  ) {
    super();
    this.monitoringStore = monitoringStore;
    this.store = store;
    this.eventsContainer = eventsContainer.endsWith("/")
      ? eventsContainer
      : `${eventsContainer}/`;
    this.baseUrl = baseUrl.replace(/\/$/, "");

    this.emitter = new EventEmitter({ store, eventsContainer: this.eventsContainer });
    this.unprocessable = new UnprocessableWriteDetector();
    this.bound = new BoundExceededDetector({ threshold: boundThreshold });
    this.reflection = new ReflectionDueDetector({ intervalMs: reflectionIntervalMs });
    this.contradiction = new ContradictionDetector({ contradictoryPairs });
  }

  public async handle(): Promise<void> {
    this.monitoringStore.on("changed", (target, activity, metadata) => {
      this.onChange(target, activity, metadata);
    });
    this.logger.info(
      `MemTriggerListener attached (eventsContainer=${this.eventsContainer}, baseUrl=${this.baseUrl})`,
    );
  }

  private onChange(target: ResourceIdentifier, _activity: unknown, _metadata: unknown): void {
    // Filter: ignore writes to .events/ and .operations/ themselves (prevents recursion).
    if (target.path.includes("/.events/") || target.path.includes("/.operations/")) {
      return;
    }
    // Filter: only consider writes under baseUrl.
    if (!target.path.startsWith(this.baseUrl)) {
      return;
    }
    // Serialize work via chain Promise (same pattern as MementoCommitListener).
    this.chain = this.chain
      .then(async () => {
        await this.checkBound(target);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`MemTrigger onChange handler error: ${msg}`);
      });
  }

  /**
   * v1 stub: counts ldp:contains in the parent container, fires BoundExceeded
   * if the count crosses threshold (default 12 per Fano bound, D77).
   *
   * Real ldp:contains counting via this.store.getRepresentation on the parent
   * container is deferred — would require Turtle parsing + container-path
   * resolution. The chain serialization + filter + listener attachment are
   * production-ready; the count itself is currently a no-op so this method
   * never emits in v1. See FOLLOWUPS.md ("Phase C.10 — MemTrigger v1 wiring").
   */
  private async checkBound(_target: ResourceIdentifier): Promise<void> {
    // Intentional no-op for v1. Hook-point for future ldp:contains counting.
    return;
  }
}
