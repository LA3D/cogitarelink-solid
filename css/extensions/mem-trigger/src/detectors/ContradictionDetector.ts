import { randomUUID } from "crypto";
import { Writer, DataFactory } from "n3";
import { MEM, SUBSTRATE_ACTOR, DEFAULT_EVENTS_CONTAINER } from "../types";

const { namedNode, literal, quad } = DataFactory;

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const AS_NS = "https://www.w3.org/ns/activitystreams#";
const PROV = "http://www.w3.org/ns/prov#";
const XSD_DT = "http://www.w3.org/2001/XMLSchema#dateTime";

export interface ContradictionEdge {
  predicate: string;
  object: string;
}

export interface ContradictionOpts {
  contradictoryPairs: Array<[string, string]>;
}

export interface ContradictionInput {
  subject: string;
  edges: ContradictionEdge[];
  now: Date;
  eventsContainer?: string;
}

interface Contradiction {
  predA: string;
  predB: string;
  object: string;
}

/**
 * Hand-picked predicate-pair contradiction detector. v1 pair list per HR-6:
 * [(wiki:supports, wiki:criticizes)]. Scans a subject's edges; if both
 * predicates in a configured pair point at the same object, emits a
 * mem:ContradictionDetected event noting predicates + contradicted object.
 *
 * Pure detector — caller supplies the edge set (typically harvested from
 * the just-written resource's body-projected .meta triples).
 */
export class ContradictionDetector {
  private readonly pairs: Array<[string, string]>;

  public constructor(opts: ContradictionOpts) {
    this.pairs = opts.contradictoryPairs;
  }

  public maybeEmit(input: ContradictionInput): string | null {
    const found = this.findContradiction(input.edges);
    if (!found) return null;
    return this.buildEvent(input, found);
  }

  private findContradiction(edges: ContradictionEdge[]): Contradiction | null {
    // Index edges by predicate → set of objects.
    const byPredicate = new Map<string, Set<string>>();
    for (const e of edges) {
      let s = byPredicate.get(e.predicate);
      if (!s) {
        s = new Set();
        byPredicate.set(e.predicate, s);
      }
      s.add(e.object);
    }
    for (const [predA, predB] of this.pairs) {
      const a = byPredicate.get(predA);
      const b = byPredicate.get(predB);
      if (!a || !b) continue;
      for (const obj of a) {
        if (b.has(obj)) {
          return { predA, predB, object: obj };
        }
      }
    }
    return null;
  }

  private buildEvent(input: ContradictionInput, c: Contradiction): string {
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
    writer.addQuad(
      quad(activity, namedNode(RDF_TYPE), namedNode(`${MEM}ContradictionDetected`)),
    );
    writer.addQuad(quad(activity, namedNode(`${AS_NS}actor`), namedNode(SUBSTRATE_ACTOR)));
    writer.addQuad(
      quad(activity, namedNode(`${PROV}wasAssociatedWith`), namedNode(SUBSTRATE_ACTOR)),
    );
    writer.addQuad(quad(activity, namedNode(`${AS_NS}object`), namedNode(input.subject)));
    writer.addQuad(quad(activity, namedNode(`${AS_NS}target`), namedNode(eventsContainer)));
    writer.addQuad(
      quad(
        activity,
        namedNode(`${AS_NS}published`),
        literal(input.now.toISOString(), namedNode(XSD_DT)),
      ),
    );
    writer.addQuad(
      quad(activity, namedNode(`${MEM}contradictingPredicate`), namedNode(c.predA)),
    );
    writer.addQuad(
      quad(activity, namedNode(`${MEM}contradictingPredicate`), namedNode(c.predB)),
    );
    writer.addQuad(
      quad(activity, namedNode(`${MEM}contradictedObject`), namedNode(c.object)),
    );

    let out = "";
    writer.end((err, result) => {
      if (err) throw err;
      out = result;
    });
    return out;
  }
}
