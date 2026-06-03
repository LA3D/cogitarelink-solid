import { randomUUID } from "crypto";
import { Writer, DataFactory } from "n3";
import { MEM, AS_NS, PROV, XSD, SUBSTRATE_ACTOR, DEFAULT_EVENTS_CONTAINER } from "../types";

const { namedNode, literal, quad } = DataFactory;

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

export interface BoundExceededOpts {
  threshold?: number;
  flappingProtectionMs?: number;
}

export interface BoundExceededInput {
  containerUri: string;
  childCount: number;
  lastEmittedForContainer: Date | null;
  now: Date;
  eventsContainer?: string;
}

/**
 * Emits mem:BoundExceeded when an LDP container's ldp:contains count
 * crosses the Fano bound (default 12). Per-container flapping protection
 * suppresses re-emit within `flappingProtectionMs` (default 24h).
 *
 * Pure detector — caller supplies childCount and lastEmittedForContainer.
 */
export class BoundExceededDetector {
  private readonly threshold: number;
  private readonly flappingProtectionMs: number;

  public constructor(opts: BoundExceededOpts = {}) {
    this.threshold = opts.threshold ?? 12;
    this.flappingProtectionMs = opts.flappingProtectionMs ?? 24 * 3600 * 1000;
  }

  public maybeEmit(input: BoundExceededInput): string | null {
    if (input.childCount <= this.threshold) return null;
    if (input.lastEmittedForContainer !== null) {
      const elapsed = input.now.getTime() - input.lastEmittedForContainer.getTime();
      if (elapsed < this.flappingProtectionMs) return null;
    }
    return this.buildEvent(input);
  }

  private buildEvent(input: BoundExceededInput): string {
    const activityIri = `urn:uuid:${randomUUID()}`;
    const eventsContainer = input.eventsContainer ?? DEFAULT_EVENTS_CONTAINER;

    const writer = new Writer({
      prefixes: {
        as: AS_NS,
        mem: MEM,
        prov: PROV,
        xsd: XSD,
      },
    });

    const activity = namedNode(activityIri);
    writer.addQuad(quad(activity, namedNode(RDF_TYPE), namedNode(`${AS_NS}Activity`)));
    writer.addQuad(quad(activity, namedNode(RDF_TYPE), namedNode(`${MEM}Event`)));
    writer.addQuad(quad(activity, namedNode(RDF_TYPE), namedNode(`${MEM}BoundExceeded`)));
    writer.addQuad(quad(activity, namedNode(`${AS_NS}actor`), namedNode(SUBSTRATE_ACTOR)));
    writer.addQuad(
      quad(activity, namedNode(`${PROV}wasAssociatedWith`), namedNode(SUBSTRATE_ACTOR)),
    );
    writer.addQuad(quad(activity, namedNode(`${AS_NS}object`), namedNode(input.containerUri)));
    writer.addQuad(quad(activity, namedNode(`${AS_NS}target`), namedNode(eventsContainer)));
    writer.addQuad(
      quad(
        activity,
        namedNode(`${AS_NS}published`),
        literal(input.now.toISOString(), namedNode(`${XSD}dateTime`)),
      ),
    );
    writer.addQuad(
      quad(
        activity,
        namedNode(`${MEM}childCount`),
        literal(String(input.childCount), namedNode(`${XSD}integer`)),
      ),
    );
    writer.addQuad(
      quad(
        activity,
        namedNode(`${MEM}threshold`),
        literal(String(this.threshold), namedNode(`${XSD}integer`)),
      ),
    );

    let out = "";
    writer.end((err, result) => {
      if (err) throw err;
      out = result;
    });
    return out;
  }
}
