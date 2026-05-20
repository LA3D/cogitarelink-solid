import { randomUUID } from "crypto";
import { Writer, DataFactory } from "n3";
import { MEM, SUBSTRATE_ACTOR, DEFAULT_EVENTS_CONTAINER } from "../types";

const { namedNode, literal, quad } = DataFactory;

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const AS_NS = "https://www.w3.org/ns/activitystreams#";
const PROV = "http://www.w3.org/ns/prov#";
const XSD_DT = "http://www.w3.org/2001/XMLSchema#dateTime";

export interface ReflectionDueOpts {
  intervalMs?: number;
}

export interface ReflectionDueInput {
  lastEmitted: Date | null;
  lastActivity: Date | null;
  now: Date;
  eventsContainer?: string;
}

/**
 * Emits mem:ReflectionDue when the configured interval has elapsed since
 * the last emission AND there has been activity since the last emit.
 * First-time emit fires when lastEmitted=null and lastActivity exists.
 *
 * Pure detector — no timers, no I/O. Caller drives `now` (typically a
 * periodic tick or write-time check).
 */
export class ReflectionDueDetector {
  private readonly intervalMs: number;

  public constructor(opts: ReflectionDueOpts = {}) {
    this.intervalMs = opts.intervalMs ?? 24 * 3600 * 1000;
  }

  public maybeEmit(input: ReflectionDueInput): string | null {
    const { lastEmitted, lastActivity, now } = input;

    if (lastEmitted === null) {
      // First time: only fire if any activity has happened.
      if (lastActivity === null) return null;
    } else {
      // Interval check.
      if (now.getTime() - lastEmitted.getTime() < this.intervalMs) return null;
      // Activity must have happened since last emit.
      if (lastActivity === null || lastActivity.getTime() <= lastEmitted.getTime())
        return null;
    }

    return this.buildEvent(input);
  }

  private buildEvent(input: ReflectionDueInput): string {
    const activityIri = `urn:uuid:${randomUUID()}`;
    const eventsContainer = input.eventsContainer ?? DEFAULT_EVENTS_CONTAINER;

    const writer = new Writer({
      prefixes: {
        as: AS_NS,
        mem: MEM,
        prov: PROV,
        xsd: "http://www.w3.org/2001/XMLSchema#",
      },
    });

    const activity = namedNode(activityIri);
    writer.addQuad(quad(activity, namedNode(RDF_TYPE), namedNode(`${AS_NS}Activity`)));
    writer.addQuad(quad(activity, namedNode(RDF_TYPE), namedNode(`${MEM}Event`)));
    writer.addQuad(quad(activity, namedNode(RDF_TYPE), namedNode(`${MEM}ReflectionDue`)));
    writer.addQuad(quad(activity, namedNode(`${AS_NS}actor`), namedNode(SUBSTRATE_ACTOR)));
    writer.addQuad(
      quad(activity, namedNode(`${PROV}wasAssociatedWith`), namedNode(SUBSTRATE_ACTOR)),
    );
    writer.addQuad(quad(activity, namedNode(`${AS_NS}target`), namedNode(eventsContainer)));
    writer.addQuad(
      quad(
        activity,
        namedNode(`${AS_NS}published`),
        literal(input.now.toISOString(), namedNode(XSD_DT)),
      ),
    );
    if (input.lastEmitted) {
      writer.addQuad(
        quad(
          activity,
          namedNode(`${MEM}previousEmittedAt`),
          literal(input.lastEmitted.toISOString(), namedNode(XSD_DT)),
        ),
      );
    }
    if (input.lastActivity) {
      writer.addQuad(
        quad(
          activity,
          namedNode(`${MEM}lastActivityAt`),
          literal(input.lastActivity.toISOString(), namedNode(XSD_DT)),
        ),
      );
    }

    let out = "";
    writer.end((err, result) => {
      if (err) throw err;
      out = result;
    });
    return out;
  }
}
