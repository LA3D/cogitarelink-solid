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
  private readonly typeIndexUri: string;
  private chain: Promise<void> = Promise.resolve();

  public constructor(
    monitoringStore: MonitoringStore,
    store: ResourceStore,
    eventsContainer: string,
    baseUrl: string,
    boundThreshold: number,
    reflectionIntervalMs: number,
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

    this.emitter = new EventEmitter({ store, eventsContainer: this.eventsContainer });
    this.unprocessable = new UnprocessableWriteDetector();
    this.bound = new BoundExceededDetector({ threshold: boundThreshold });
    this.reflection = new ReflectionDueDetector({ intervalMs: reflectionIntervalMs });
    this.contradiction = new ContradictionDetector({ contradictoryPairs });
  }

  public async handle(): Promise<void> {
    this.durableContainers = await loadDurableContainers(this.store, this.typeIndexUri);
    if (this.durableContainers.size === 0) {
      this.logger.warn(
        `MemTriggerListener: durable-container set is empty (Type Index at ${this.typeIndexUri} may not exist yet); ReflectionDue path filter will admit nothing until a write triggers a retry.`,
      );
    }

    this.monitoringStore.on("changed", (target, activity, metadata) => {
      this.onChange(target, activity, metadata);
    });

    this.logger.info(
      `MemTriggerListener attached (eventsContainer=${this.eventsContainer}, baseUrl=${this.baseUrl}, durableContainers=${this.durableContainers.size})`,
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

    // Activity tracking for ReflectionDue path filter.
    if (this.isDurableTarget(target.path)) {
      this.lastActivity.set(target.path, new Date());
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
   * Reads the parent container via store.getRepresentation (post-commit,
   * so no re-entrant lock concern — the parent is a different resource from
   * the write target). Parses Turtle with N3.js, counts ldp:contains quads,
   * then delegates to BoundExceededDetector.maybeEmit with flapping guard.
   */
  private async checkBound(target: ResourceIdentifier): Promise<void> {
    // Derive parent container URI: strip last segment, ensure trailing /.
    const parentUri = deriveParentContainer(target.path);
    if (parentUri === null) return;
    // Defense-in-depth filter (also filtered in onChange).
    if (parentUri.includes("/.events/") || parentUri.includes("/.operations/")) return;

    let containerTurtle: string;
    try {
      const representation = await this.store.getRepresentation(
        { path: parentUri },
        { type: { "text/turtle": 1 } },
      );
      containerTurtle = await streamToString(representation.data);
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

async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
