import { getLoggerFor } from "global-logger-factory";
import {
  Initializer,
  type MonitoringStore,
  type ResourceIdentifier,
  type ResourceStore,
} from "@solid/community-server";
import { Parser } from "n3";

import { UnprocessableWriteDetector } from "./detectors/UnprocessableWriteDetector";
import { BoundExceededDetector } from "./detectors/BoundExceededDetector";
import { ReflectionDueDetector } from "./detectors/ReflectionDueDetector";
import { ContradictionDetector } from "./detectors/ContradictionDetector";
import { EventEmitter } from "./EventEmitter";
import { loadDurableContainers } from "./loadDurableContainers";
import { pendingEventsBuffer } from "./PendingEventsBuffer";

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
  private readonly lastActivity = new Map<string, Date>();
  private readonly lastReflection = new Map<string, Date>();
  private durableContainers: Set<string> = new Set();
  private durableContainersLoaded = false;
  private startupTime = Date.now();
  private readonly typeIndexUri: string;
  private readonly reflectionTickRateMs: number;
  private reflectionTimer: NodeJS.Timeout | null = null;
  private chain: Promise<void> = Promise.resolve();

  public constructor(
    monitoringStore: MonitoringStore,
    store: ResourceStore,
    eventsContainer: string,
    baseUrl: string,
    boundThreshold: number,
    reflectionIntervalMs: number,
    reflectionTickRateMs: number,
    contradictoryPairs: Array<[string, string]>,
    typeIndexUri: string,
  ) {
    super();
    this.monitoringStore = monitoringStore;
    this.store = store;
    this.eventsContainer = eventsContainer.endsWith("/")
      ? eventsContainer
      : `${eventsContainer}/`;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.typeIndexUri = typeIndexUri;
    this.reflectionTickRateMs = reflectionTickRateMs;

    this.emitter = new EventEmitter({ store, eventsContainer: this.eventsContainer });
    this.unprocessable = new UnprocessableWriteDetector();
    this.bound = new BoundExceededDetector({ threshold: boundThreshold });
    this.reflection = new ReflectionDueDetector({ intervalMs: reflectionIntervalMs });
    this.contradiction = new ContradictionDetector({ contradictoryPairs });
  }

  public async handle(): Promise<void> {
    // Defer loadDurableContainers to the first onChange event to avoid the
    // 6-second CSS write-lock timeout that occurs when calling getRepresentation
    // during parallel Initializer execution (the Type Index may be under a
    // write lock from pod-setup at startup time). durableContainers starts empty;
    // the first write event triggers a lazy load.
    this.monitoringStore.on("changed", (target, activity, metadata) => {
      this.onChange(target, activity, metadata);
    });

    // Drain any events queued before handle() ran (e.g., during pod-setup).
    void this.drainPendingEvents().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`startup drain error: ${msg}`);
    });

    this.reflectionTimer = setInterval(() => {
      this.tickReflection().catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`tickReflection error: ${msg}`);
      });
    }, this.reflectionTickRateMs);

    this.logger.info(
      `MemTriggerListener attached (eventsContainer=${this.eventsContainer}, baseUrl=${this.baseUrl}); durable containers load deferred to first write`,
    );
  }

  public finalize(): void {
    if (this.reflectionTimer !== null) {
      clearInterval(this.reflectionTimer);
      this.reflectionTimer = null;
    }
  }

  private async tickReflection(): Promise<void> {
    const now = new Date();
    for (const [subjectUri, lastActivity] of this.lastActivity) {
      const lastEmitted = this.lastReflection.get(subjectUri) ?? null;
      const turtle = this.reflection.maybeEmit({
        lastEmitted,
        lastActivity,
        now,
      });
      if (turtle !== null) {
        await this.emitter.emit(turtle);
        this.lastReflection.set(subjectUri, now);
      }
    }
  }

  /**
   * Drains pendingEventsBuffer by emitting each accumulated Turtle event
   * to /.events/. Called on startup (handle()) and on each non-events
   * 'changed' event. Buffer entries are enqueued by cross-extension hooks
   * (e.g., MemTriggerUnprocessableWriteHook) that can't hold an EventEmitter
   * directly due to Components.js circular DI.
   */
  private async drainPendingEvents(): Promise<void> {
    while (pendingEventsBuffer.length > 0) {
      const turtle = pendingEventsBuffer.shift();
      if (turtle === undefined) break;
      try {
        await this.emitter.emit(turtle);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Surface via console.error since getLoggerFor is silenced in extension packages.
        console.error(`[MemTriggerListener] drainPendingEvents: emit failed (event dropped): ${msg}`);
      }
    }
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

    // Activity tracking for ReflectionDue path filter.
    if (this.isDurableTarget(target.path)) {
      this.lastActivity.set(target.path, new Date());
    }

    // Serialize work via chain Promise (same pattern as MementoCommitListener).
    this.chain = this.chain
      .then(async () => {
        // Always drain the pending-events buffer first — this runs regardless of
        // the startup grace period so that UnprocessableWrite events queued by
        // MemTriggerUnprocessableWriteHook reach /.events/ even during pod-setup.
        await this.drainPendingEvents();

        // Lazy-load durable containers on first write after startup (deferred
        // from handle() to avoid CSS write-lock timeout during parallel init).
        // Re-tried on every change until it succeeds (e.g., pod-setup may hold
        // the Type Index write lock for 6+ seconds during bulk initialization).
        if (!this.durableContainersLoaded) {
          // Wait at least 15s after startup before reading Type Index.
          // Pod-setup writes many resources within the first ~10s; calling
          // store.getRepresentation() during that window risks the 6s CSS
          // write-lock expiry that causes an uncatchable Node.js stream crash.
          const msSinceStart = Date.now() - this.startupTime;
          const STARTUP_GRACE_MS = 15_000;
          if (msSinceStart < STARTUP_GRACE_MS) {
            return; // skip checkBound until grace period expires
          }
          try {
            const containers = await loadDurableContainers(this.typeIndexUri);
            this.durableContainers = containers;
            this.durableContainersLoaded = true;
            this.logger.info(
              `MemTriggerListener: loaded durable containers (count=${this.durableContainers.size})`,
            );
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(
              `MemTriggerListener: deferred Type Index load failed, will retry on next change: ${msg}`,
            );
          }
        }
        await this.checkBound(target);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`MemTrigger onChange handler error: ${msg}`);
      });
  }

  private isDurableTarget(targetUri: string): boolean {
    try {
      const url = new URL(targetUri);
      for (const container of this.durableContainers) {
        if (url.pathname.startsWith(container)) return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  /**
   * Counts ldp:contains in the parent container, fires BoundExceeded
   * if the count crosses threshold (default 12 per Fano bound, D77).
   *
   * Reads the parent container via HTTP fetch() (not store.getRepresentation)
   * to avoid re-entering CSS's LockingResourceStore. The 'changed' event fires
   * while CSS may still hold a write lock on the parent container (it updates
   * ldp:contains as part of the same write transaction). Using fetch() avoids
   * the per-resource lock contention that causes the WrappedExpiringReadWriteLocker
   * 6s crash. Parses Turtle with N3.js, counts ldp:contains quads, then
   * delegates to BoundExceededDetector.maybeEmit with flapping guard.
   */
  private async checkBound(target: ResourceIdentifier): Promise<void> {
    // Derive parent container URI: strip last segment, ensure trailing /.
    const parentUri = deriveParentContainer(target.path);
    if (parentUri === null) return;
    // Defense-in-depth filter (also filtered in onChange).
    if (parentUri.includes("/.events/") || parentUri.includes("/.operations/")) return;

    let containerTurtle: string;
    try {
      const resp = await fetch(parentUri, { headers: { Accept: "text/turtle" } });
      if (!resp.ok) {
        this.logger.warn(`checkBound: HTTP ${resp.status} reading parent container ${parentUri}`);
        return;
      }
      containerTurtle = await resp.text();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`checkBound: could not read parent container ${parentUri}: ${msg}`);
      return;
    }

    let childCount = 0;
    try {
      const parser = new Parser({ baseIRI: parentUri });
      const quads = parser.parse(containerTurtle);
      childCount = quads.filter(
        (q) => q.predicate.value === "http://www.w3.org/ns/ldp#contains",
      ).length;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`checkBound: parse error for ${parentUri}: ${msg}`);
      return;
    }

    const now = new Date();
    const lastEmitted = this.lastBoundEmit.get(parentUri) ?? null;
    const turtle = this.bound.maybeEmit({
      containerUri: parentUri,
      childCount,
      lastEmittedForContainer: lastEmitted,
      now,
    });
    if (turtle !== null) {
      await this.emitter.emit(turtle);
      this.lastBoundEmit.set(parentUri, now);
    }
  }
}

function deriveParentContainer(path: string): string | null {
  try {
    const url = new URL(path);
    if (url.pathname === "/" || url.pathname === "") return null;
    const trimmed = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
    const idx = trimmed.lastIndexOf("/");
    if (idx < 0) return null;
    url.pathname = trimmed.slice(0, idx + 1);
    return url.toString();
  } catch {
    return null;
  }
}

