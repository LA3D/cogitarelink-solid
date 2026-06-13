// curationSignal.ts — the degraded-reprojection curation signal (PSP T5, spec §5/§6).
//
// When a re-projection cannot recompute its own prior output (old body unrecoverable,
// or the .meta's sub:projectorVersion stamp mismatches the running projector), the
// subtraction degrades to pair-shadow replacement — which can leave residue for
// subject+predicate pairs the new body no longer emits. The lane that sweeps that
// residue is the D112 curation loop, fed from /vault/wiki/.events/; this module
// builds and queues the event record that flags the resource.
//
// Record shape + emission MIRROR css/extensions/mem-trigger:
//   - record:   ContradictionDetector.buildEvent (urn:uuid as:Activity + mem:Event +
//               typed mem:* flag; actor/wasAssociatedWith substrate URN; as:object/
//               as:target/as:published) — here typed mem:StalenessDetected with
//               mem:stalenessClass mem:Materialization ("a derivable projection gap —
//               the resolving act is mechanical", mem.ttl);
//   - buffering: PendingEventsBuffer — the floor path's MarkdownBodyProjector holds NO
//               ResourceStore reference (and runs IN-BAND inside setRepresentation,
//               where a re-entrant store write is unsafe), so signalers push Turtle
//               here and MarkdownProjectionListener (an Initializer with store access)
//               drains on each 'changed' event;
//   - writing:  EventEmitter.emit (timestamp-slug + UUID filenames, text/turtle,
//               in-process setRepresentation) — implemented in the listener's
//               drainCurationSignals().
// mem-trigger's implementations are NOT importable from this extension (no package
// edge between extension bundles — the stampPredicates.ts/gitRead.ts constraint), so
// the vocabulary constants and patterns are duplicated; the record shape is pinned by
// test/curationSignal.test.ts.

import { randomUUID } from "crypto";
import { Writer, DataFactory } from "n3";

const { namedNode, literal, quad } = DataFactory;

// Vocab constants mirrored from mem-trigger/src/types.ts (vocabulary IRIs, not
// storage paths — outside the banned-literal storagePath scope, like stampPredicates).
const MEM = "https://pod.vardeman.me/vault/ontology/mem#";
const AS_NS = "https://www.w3.org/ns/activitystreams#";
const PROV = "http://www.w3.org/ns/prov#";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const XSD_DT = "http://www.w3.org/2001/XMLSchema#dateTime";

// Substrate identity used as as:actor — a named URN per emitting substrate component
// (mem-trigger uses urn:substrate:mem-trigger-listener; named, NOT a blank node).
export const SUBSTRATE_ACTOR = "urn:substrate:markdown-projection";

export const DEGRADED_SUMMARY =
    "re-projection degraded: prior body unrecoverable or projector-version mismatch; " +
    "pair-shadow used — residue possible";

/**
 * wiki-memory L3 layout: the events log hangs at <storageBase>/wiki/.events/ — the
 * same derivation MemTriggerListener performs. The /wiki/ SEGMENT is the profile's
 * own layout constant; the storage ROOT arrives via config (R-T1 banned-literal rule).
 */
export function eventsContainerFor(storageBase: string): string {
    return `${storageBase.replace(/\/$/, "")}/wiki/.events/`;
}

/** Build the degraded-reprojection event record (shape pinned by curationSignal.test.ts). */
export function buildDegradedSignalTtl(resourceUrl: string, eventsContainer: string, now: Date): string {
    const activity = namedNode(`urn:uuid:${randomUUID()}`);
    const writer = new Writer({
        prefixes: {
            as: AS_NS,
            mem: MEM,
            prov: PROV,
            xsd: "http://www.w3.org/2001/XMLSchema#",
        },
    });
    writer.addQuad(quad(activity, namedNode(RDF_TYPE), namedNode(`${AS_NS}Activity`)));
    writer.addQuad(quad(activity, namedNode(RDF_TYPE), namedNode(`${MEM}Event`)));
    writer.addQuad(quad(activity, namedNode(RDF_TYPE), namedNode(`${MEM}StalenessDetected`)));
    writer.addQuad(quad(activity, namedNode(`${AS_NS}actor`), namedNode(SUBSTRATE_ACTOR)));
    writer.addQuad(quad(activity, namedNode(`${PROV}wasAssociatedWith`), namedNode(SUBSTRATE_ACTOR)));
    writer.addQuad(quad(activity, namedNode(`${AS_NS}object`), namedNode(resourceUrl)));
    writer.addQuad(quad(activity, namedNode(`${AS_NS}target`), namedNode(eventsContainer)));
    writer.addQuad(quad(activity, namedNode(`${AS_NS}published`), literal(now.toISOString(), namedNode(XSD_DT))));
    writer.addQuad(quad(activity, namedNode(`${MEM}stalenessClass`), namedNode(`${MEM}Materialization`)));
    writer.addQuad(quad(activity, namedNode(`${AS_NS}summary`), literal(DEGRADED_SUMMARY)));

    let out = "";
    writer.end((err, result) => {
        if (err) throw err;
        out = result;
    });
    return out;
}

/**
 * Module-level pending-signal buffer (the PendingEventsBuffer pattern). Both write
 * paths push here; MarkdownProjectionListener.drainCurationSignals() empties it.
 */
export const pendingCurationSignals: string[] = [];

export function signalDegraded(resourceUrl: string, eventsContainer: string, now: Date = new Date()): void {
    pendingCurationSignals.push(buildDegradedSignalTtl(resourceUrl, eventsContainer, now));
}

/** Filename-safe ISO slug — mirrors mem-trigger EventEmitter.timestampSlug. */
export function timestampSlug(d: Date): string {
    return d.toISOString().replace(/[:.]/g, "-");
}
