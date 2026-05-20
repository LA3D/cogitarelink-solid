import { randomUUID } from "crypto";
import { Parser, Writer, DataFactory } from "n3";
import { MEM, SUBSTRATE_ACTOR, DEFAULT_EVENTS_CONTAINER } from "../types";

const { namedNode, literal, quad } = DataFactory;

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const AS_NS = "https://www.w3.org/ns/activitystreams#";
const PROV = "http://www.w3.org/ns/prov#";
const XSD_DT = "http://www.w3.org/2001/XMLSchema#dateTime";

export interface UnprocessableWriteInput {
  targetUri: string;
  validationReport: string;
  writerWebId?: string;
  timestamp: Date;
  eventsContainer?: string;
}

/**
 * Detects SHACL-rejected writes and builds a mem:UnprocessableWrite event
 * as a Turtle string. Pure: input → maybe-Turtle. No I/O.
 *
 * Uses a named urn:uuid activity subject — N3 Patch rejects blank nodes in
 * solid:inserts formulas (Phase B finding 1).
 */
export class UnprocessableWriteDetector {
  public buildEvent(input: UnprocessableWriteInput): string | null {
    const { targetUri, validationReport, writerWebId, timestamp } = input;
    if (!validationReport || validationReport.trim().length === 0) return null;

    const activityIri = `urn:uuid:${randomUUID()}`;
    const eventsContainer = input.eventsContainer ?? DEFAULT_EVENTS_CONTAINER;

    const writer = new Writer({
      prefixes: {
        as: AS_NS,
        mem: MEM,
        prov: PROV,
        sh: "http://www.w3.org/ns/shacl#",
        xsd: "http://www.w3.org/2001/XMLSchema#",
      },
    });

    const activity = namedNode(activityIri);
    writer.addQuad(quad(activity, namedNode(RDF_TYPE), namedNode(`${AS_NS}Activity`)));
    writer.addQuad(quad(activity, namedNode(RDF_TYPE), namedNode(`${AS_NS}Reject`)));
    writer.addQuad(quad(activity, namedNode(RDF_TYPE), namedNode(`${MEM}Event`)));
    writer.addQuad(quad(activity, namedNode(RDF_TYPE), namedNode(`${MEM}UnprocessableWrite`)));
    writer.addQuad(quad(activity, namedNode(`${AS_NS}actor`), namedNode(SUBSTRATE_ACTOR)));
    writer.addQuad(
      quad(activity, namedNode(`${PROV}wasAssociatedWith`), namedNode(SUBSTRATE_ACTOR)),
    );
    writer.addQuad(quad(activity, namedNode(`${AS_NS}object`), namedNode(targetUri)));
    writer.addQuad(quad(activity, namedNode(`${AS_NS}target`), namedNode(eventsContainer)));
    writer.addQuad(
      quad(
        activity,
        namedNode(`${AS_NS}published`),
        literal(timestamp.toISOString(), namedNode(XSD_DT)),
      ),
    );
    if (writerWebId) {
      writer.addQuad(quad(activity, namedNode(`${AS_NS}to`), namedNode(writerWebId)));
    }

    // Nest validation report triples under as:context.
    // Parse the report, then rewrite each quad with a new context-blank-named
    // subject so the report is rooted at the activity via as:context.
    // We use a named bnode (Skolemized) URI to keep N3-Patch-safe.
    const contextIri = `${activityIri}#validationReport`;
    writer.addQuad(quad(activity, namedNode(`${AS_NS}context`), namedNode(contextIri)));

    try {
      const reportQuads = new Parser().parse(validationReport);
      // Skolemize: any blank node becomes a fragment of contextIri.
      const skolemize = (term: import("@rdfjs/types").Term) => {
        if (term.termType === "BlankNode") {
          return namedNode(`${contextIri}#bn-${term.value}`);
        }
        return term;
      };
      for (const q of reportQuads) {
        writer.addQuad(
          quad(
            skolemize(q.subject) as ReturnType<typeof namedNode>,
            q.predicate as ReturnType<typeof namedNode>,
            skolemize(q.object) as ReturnType<typeof namedNode>,
          ),
        );
      }
    } catch {
      // If the report doesn't parse, attach it as a literal annotation.
      writer.addQuad(
        quad(activity, namedNode(`${AS_NS}content`), literal(validationReport)),
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
