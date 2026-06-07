/**
 * TrailerDecoratingStore — the A′ conditional dynamic trailer (view-layer spec §4.3).
 *
 * Default GET serves the stored body BYTE-IDENTICAL unless the resource carries open
 * curation state (mem:hasOpenAction in its folded-in .meta), in which case the rendered
 * pod:notice block is appended at serve time. The trailer is the only reliable agent-
 * facing channel: D112 Probe 2 proved the Link header never reaches curl agents, so the
 * body must carry the signal. It is CONDITIONAL — appended only when there is open state —
 * to minimise the imitation hazard (RQ-View-2: seeded exemplars teach phantom affordances).
 *
 * Layering (Task 11 wiring): inserted ABOVE MonitoringStore as the new top of the chain,
 * so ONLY the outbound LDP read path passes through it. Internal consumers (projection
 * listener, ops-index, ViewHttpHandler — all reading via ResourceStore_Monitoring) bypass
 * it, so internal reads never see trailers. Write-back of the trailer is guarded by the
 * Task-10 AdmissionFloorStore 422.
 */
import {
  PassthroughStore,
  BasicRepresentation,
  readableToString,
  readableToQuads,
  INTERNAL_QUADS,
} from "@solid/community-server";
import type {
  ResourceStore,
  Representation,
  RepresentationPreferences,
  ResourceIdentifier,
  Conditions,
  AuxiliaryStrategy,
} from "@solid/community-server";
import { DataFactory } from "n3";
import { renderTrailer, type OpenAction } from "./trailer";

const { namedNode } = DataFactory;

// mem: namespace + mem:hasOpenAction. Re-declared locally (NOT imported): each CSS
// extension is an isolated npm package with no shared cross-package constants channel
// (same situation parseProposal.ts / CurationLinkMetadataWriter.ts document). The
// canonical source is the Pod's mem.ttl; ops-index/parseProposal.ts and
// profile-link/CurationLinkMetadataWriter.ts carry the same string — an agreement test
// against the live mem.ttl is the cross-cutting lock (FOLLOWUPS).
const MEM = "https://pod.vardeman.me/vault/ontology/mem#";
const MEM_HAS_OPEN_ACTION = namedNode(`${MEM}hasOpenAction`);
const MEM_RATIONALE = namedNode(`${MEM}rationale`);
const RDF_TYPE = namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");

export class TrailerDecoratingStore extends PassthroughStore {
  public constructor(
    source: ResourceStore,
    private readonly auxiliaryStrategy: AuxiliaryStrategy,
  ) {
    super(source);
  }

  public async getRepresentation(
    identifier: ResourceIdentifier,
    preferences: RepresentationPreferences,
    conditions?: Conditions,
  ): Promise<Representation> {
    const rep = await super.getRepresentation(identifier, preferences, conditions);
    // .meta and other auxiliaries are never decorated (would corrupt the graph view).
    if (this.auxiliaryStrategy.isAuxiliaryIdentifier(identifier)) return rep;
    // Only the markdown body is a trailer target; turtle/JSON-LD/etc. pass through.
    if (rep.metadata.contentType !== "text/markdown") return rep;
    const actions = rep.metadata.getAll(MEM_HAS_OPEN_ACTION);
    if (actions.length === 0) return rep;

    // Decorating path only past here — buffering the stream is justified.
    const body = await readableToString(rep.data);
    const open: OpenAction[] = await Promise.all(
      actions.map(async (a) => {
        const { type, rationale } = await this.describeOp(a.value);
        return { op: a.value, type, rationale };
      }),
    );
    const decorated = body + renderTrailer(open);
    return new BasicRepresentation(decorated, rep.metadata);
  }

  // ONE fetch of the op resource yields both its rationale and a compact type label.
  // A read failure is graceful: rationale undefined, type falls back to "mem:Action".
  private async describeOp(opUrl: string): Promise<{ type: string; rationale?: string }> {
    try {
      const rep = await this.source.getRepresentation(
        { path: opUrl },
        { type: { [INTERNAL_QUADS]: 1 } },
      );
      const store = await readableToQuads(rep.data);
      const op = namedNode(opUrl);
      const rationale = store.getObjects(op, MEM_RATIONALE, null)[0]?.value;
      const typeIri = store.getObjects(op, RDF_TYPE, null)[0]?.value;
      return { type: typeIri ? compactMem(typeIri) : "mem:Action", rationale };
    } catch {
      return { type: "mem:Action", rationale: undefined };
    }
  }
}

// "…/mem#RealignAction" → "mem:RealignAction"; non-mem IRIs return the local name
// under the mem: prefix only when they live in the mem namespace, else the bare IRI.
function compactMem(iri: string): string {
  return iri.startsWith(MEM) ? `mem:${iri.slice(MEM.length)}` : iri;
}
