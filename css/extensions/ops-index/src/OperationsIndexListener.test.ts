/**
 * Unit tests for OperationsIndexListener (D112 §5).
 *
 * Seam discipline: the "store" is an in-memory stub that captures 'changed' handlers
 * and records getRepresentation / setRepresentation calls. The real parseProposal
 * and quad-merge paths run; only the backend store is faked.
 *
 * Event signature mirrors MementoCommitListener exactly:
 *   (target: ResourceIdentifier, activity: { value?: string } | string, metadata)
 * Activity is compared via .value ?? String(activity) pattern.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { DataFactory, Store, Parser } from "n3";
import { BasicRepresentation, RepresentationMetadata, INTERNAL_QUADS, readableToQuads } from "@solid/community-server";
import { OperationsIndexListener } from "./OperationsIndexListener.js";

const { namedNode, quad } = DataFactory;

const POD = "https://pod.vardeman.me";
const OP1 = `${POD}/vault/wiki/.operations/proposal1.ttl`;
const OP2 = `${POD}/vault/wiki/.operations/proposal2.ttl`;
const TARGET = `${POD}/id/schemes/doi`;
const TARGET_META = `${TARGET}.meta`;
const OTHER_RESOURCE = `${POD}/vault/wiki/concepts/photosynthesis.md`;

const MEM_HAS_OPEN_ACTION = "https://pod.vardeman.me/vault/ontology/mem#hasOpenAction";
const MEM_REALIGN = "https://pod.vardeman.me/vault/ontology/mem#RealignAction";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const AS_NS = "https://www.w3.org/ns/activitystreams#";
const SCHEMA_STATUS = "https://schema.org/actionStatus";
const AS_OBJECT = "https://www.w3.org/ns/activitystreams#object";

// Build a Potential proposal Turtle body for a given op URL
function potentialProposalTtl(opUrl: string, targetUrl: string): string {
  return `
@prefix as:     <https://www.w3.org/ns/activitystreams#> .
@prefix mem:    <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix schema: <https://schema.org/> .
<${opUrl}> a mem:RealignAction ;
    as:object <${targetUrl}> ;
    schema:actionStatus schema:PotentialActionStatus .`;
}

// Build a non-Potential proposal Turtle body (status flip → removal signal)
function resolvedProposalTtl(opUrl: string, targetUrl: string, status: string): string {
  return `
@prefix as:     <https://www.w3.org/ns/activitystreams#> .
@prefix mem:    <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix schema: <https://schema.org/> .
<${opUrl}> a mem:RealignAction ;
    as:object <${targetUrl}> ;
    schema:actionStatus schema:${status} .`;
}

// --- in-memory stub store ---------------------------------------------------
// Holds per-path quad stores. Captures the 'changed' event handler so tests
// can fire events synchronously. Records all setRepresentation calls.

interface StoreState {
  on: (event: string, handler: Function) => void;
  getRepresentation: (id: { path: string }, prefs?: any) => Promise<any>;
  setRepresentation: (id: { path: string }, rep: any) => Promise<any>;
  _fire: (target: { path: string }, activity: string) => Promise<void>;
  _getQuads: (path: string) => any[];
  _calls: Array<{ method: string; id: string; rep?: any }>;
}

function makeStore(initialStates: Record<string, any[]> = {}): StoreState {
  const stores = new Map<string, Store>();
  const calls: Array<{ method: string; id: string; rep?: any }> = [];
  let handler: ((target: any, activity: any, metadata: any) => void) | null = null;

  // Pre-seed initial states
  for (const [path, qds] of Object.entries(initialStates)) {
    stores.set(path, new Store(qds));
  }

  return {
    _calls: calls,
    on(event: string, h: Function) {
      if (event === "changed") handler = h as any;
    },
    async getRepresentation(id: { path: string }, _prefs?: any) {
      calls.push({ method: "getRepresentation", id: id.path });
      const s = stores.get(id.path) ?? new Store();
      return new BasicRepresentation(s.getQuads(null, null, null, null), INTERNAL_QUADS);
    },
    async setRepresentation(id: { path: string }, rep: any) {
      calls.push({ method: "setRepresentation", id: id.path, rep });
      // Capture the written quads
      const qs = await readableToQuads(rep.data);
      stores.set(id.path, qs);
      return new Map();
    },
    async _fire(target: { path: string }, activity: string) {
      if (!handler) throw new Error("handler not registered");
      // Mirror MementoCommitListener's call signature:
      // store.on("changed", (target, activity, metadata) => …)
      // activity is passed as an object with .value (NamedNode-like) or plain string
      handler(target, { value: activity }, {});
      // Give the async handler a tick to settle
      await new Promise((r) => setTimeout(r, 10));
    },
    _getQuads(path: string) {
      return (stores.get(path) ?? new Store()).getQuads(null, null, null, null);
    },
  };
}

// Helper to build a BasicRepresentation from quads (used to pre-seed
// getRepresentation for the proposal resource itself)
function quadsRep(qs: any[]) {
  return new BasicRepresentation(qs, INTERNAL_QUADS);
}

// --- tests ------------------------------------------------------------------

describe("OperationsIndexListener", () => {
  it("T1: Create Potential proposal → target .meta gains mem:hasOpenAction back-pointer", async () => {
    const store = makeStore();
    // Override getRepresentation to serve the proposal quads for the op URL
    const proposalQuads = new Parser().parse(potentialProposalTtl(OP1, TARGET));
    const originalGet = store.getRepresentation.bind(store);
    store.getRepresentation = async (id: { path: string }, prefs?: any) => {
      if (id.path === OP1) {
        return new BasicRepresentation(proposalQuads, INTERNAL_QUADS);
      }
      return originalGet(id, prefs);
    };

    const listener = new OperationsIndexListener(store as any);
    await listener.handle();

    await store._fire({ path: OP1 }, `${AS_NS}Create`);

    const metaQuads = store._getQuads(TARGET_META);
    const hasOpen = metaQuads.filter(
      (q: any) => q.predicate.value === MEM_HAS_OPEN_ACTION && q.object.value === OP1
    );
    expect(hasOpen.length).toBe(1);
    expect(hasOpen[0].subject.value).toBe(TARGET);
  });

  it("T2: Update to FailedActionStatus → back-pointer removed", async () => {
    // Pre-seed the target .meta with the back-pointer (simulating a prior Create)
    const existing = [
      quad(namedNode(TARGET), namedNode(MEM_HAS_OPEN_ACTION), namedNode(OP1)),
    ];
    const store = makeStore({ [TARGET_META]: existing });

    // Proposal now has FailedActionStatus
    const failedQuads = new Parser().parse(resolvedProposalTtl(OP1, TARGET, "FailedActionStatus"));
    const originalGet = store.getRepresentation.bind(store);
    store.getRepresentation = async (id: { path: string }, prefs?: any) => {
      if (id.path === OP1) {
        return new BasicRepresentation(failedQuads, INTERNAL_QUADS);
      }
      return originalGet(id, prefs);
    };

    const listener = new OperationsIndexListener(store as any);
    await listener.handle();
    // Seed the seen map by simulating the prior Create first
    // (seen map: OP1 → TARGET)
    (listener as any).seen.set(OP1, TARGET);

    await store._fire({ path: OP1 }, `${AS_NS}Update`);

    const metaQuads = store._getQuads(TARGET_META);
    const hasOpen = metaQuads.filter(
      (q: any) => q.predicate.value === MEM_HAS_OPEN_ACTION && q.object.value === OP1
    );
    expect(hasOpen.length).toBe(0);
  });

  it("T3: Delete event for a previously-seen proposal → back-pointer removed (seen-map lookup)", async () => {
    // Pre-seed the target .meta with the back-pointer
    const existing = [
      quad(namedNode(TARGET), namedNode(MEM_HAS_OPEN_ACTION), namedNode(OP1)),
    ];
    const store = makeStore({ [TARGET_META]: existing });

    const listener = new OperationsIndexListener(store as any);
    await listener.handle();
    // Seed the seen map directly (simulating a prior Create)
    (listener as any).seen.set(OP1, TARGET);

    // Fire a Delete event (no resource to read — op is gone)
    await store._fire({ path: OP1 }, `${AS_NS}Delete`);

    const metaQuads = store._getQuads(TARGET_META);
    const hasOpen = metaQuads.filter(
      (q: any) => q.predicate.value === MEM_HAS_OPEN_ACTION && q.object.value === OP1
    );
    expect(hasOpen.length).toBe(0);
  });

  it("T4: Create event for a non-ledger resource → store untouched (no .meta write)", async () => {
    const store = makeStore();
    const listener = new OperationsIndexListener(store as any);
    await listener.handle();

    await store._fire({ path: OTHER_RESOURCE }, `${AS_NS}Create`);

    const setCalls = store._calls.filter((c: any) => c.method === "setRepresentation");
    expect(setCalls.length).toBe(0);
  });

  it("T5: Back-pointer write MERGES with existing .meta quads (pre-existing triples survive)", async () => {
    const DCT_TITLE = "http://purl.org/dc/terms/title";
    const preExisting = [
      quad(namedNode(TARGET), namedNode(DCT_TITLE), DataFactory.literal("DOI scheme")),
    ];
    const store = makeStore({ [TARGET_META]: preExisting });

    const proposalQuads = new Parser().parse(potentialProposalTtl(OP1, TARGET));
    const originalGet = store.getRepresentation.bind(store);
    store.getRepresentation = async (id: { path: string }, prefs?: any) => {
      if (id.path === OP1) {
        return new BasicRepresentation(proposalQuads, INTERNAL_QUADS);
      }
      return originalGet(id, prefs);
    };

    const listener = new OperationsIndexListener(store as any);
    await listener.handle();

    await store._fire({ path: OP1 }, `${AS_NS}Create`);

    const metaQuads = store._getQuads(TARGET_META);

    // Back-pointer present
    const hasOpen = metaQuads.filter(
      (q: any) => q.predicate.value === MEM_HAS_OPEN_ACTION && q.object.value === OP1
    );
    expect(hasOpen.length).toBe(1);

    // Pre-existing triple survived
    const titles = metaQuads.filter(
      (q: any) => q.predicate.value === DCT_TITLE
    );
    expect(titles.length).toBe(1);
    expect(titles[0].object.value).toBe("DOI scheme");
  });
});
