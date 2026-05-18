import { randomUUID } from "crypto";
import {
  BasicRepresentation,
  type ResourceStore,
  type ResourceIdentifier,
} from "@solid/community-server";

export interface EventEmitterOpts {
  store: ResourceStore;
  eventsContainer: string;
}

/**
 * Writes Turtle event resources to the events container via the in-process
 * ResourceStore (bypasses HTTP / WAC — substrate privilege). Detectors build
 * Turtle; EventEmitter just persists.
 *
 * Filenames are ISO-timestamp-prefixed + UUID-suffixed for sortability and
 * uniqueness within the same millisecond.
 */
export class EventEmitter {
  private readonly store: ResourceStore;
  private readonly eventsContainer: string;

  public constructor(opts: EventEmitterOpts) {
    this.store = opts.store;
    // Normalize to always have a trailing slash.
    this.eventsContainer = opts.eventsContainer.endsWith("/")
      ? opts.eventsContainer
      : `${opts.eventsContainer}/`;
  }

  public async emit(turtle: string): Promise<void> {
    const filename = `${EventEmitter.timestampSlug(new Date())}-${randomUUID()}.ttl`;
    const path = `${this.eventsContainer}${filename}`;
    const identifier: ResourceIdentifier = { path };
    const representation = new BasicRepresentation(turtle, "text/turtle");
    await this.store.setRepresentation(identifier, representation);
  }

  /** YYYY-MM-DDTHH-MM-SS-mmm — filename-safe ISO replacement of `:` and `.`. */
  private static timestampSlug(d: Date): string {
    return d.toISOString().replace(/[:.]/g, "-");
  }
}
