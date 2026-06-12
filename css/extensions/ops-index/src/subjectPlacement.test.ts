/**
 * D96 subject placement (SP2-T11): when the target's .meta declares
 * schema:mainEntity <#this>, the derived mem:hasOpenAction back-pointer lands
 * on the Thing subject (<#this>), not the Page subject (<>). RDF-native lanes
 * (no mainEntity) keep the <> placement.
 *
 * Rationale: the E7 g-run3 registration miss — agents scan the <#this> concept
 * subject; a governance signal on the <> page subject never enters attention.
 *
 * Same stub-store idiom as OperationsIndexListener.test.ts.
 */
import { describe, it, expect } from "vitest";
import { DataFactory, Store, Parser } from "n3";
import { BasicRepresentation, INTERNAL_QUADS, readableToQuads } from "@solid/community-server";
import { OperationsIndexListener } from "./OperationsIndexListener.js";

const { namedNode, quad } = DataFactory;

const POD = "https://pod.vardeman.me";
const OP1 = `${POD}/vault/wiki/.operations/proposal1.ttl`;
const PAGE = `${POD}/vault/wiki/concepts/photosynthesis.md`;
const PAGE_META = `${PAGE}.meta`;
const THIS = `${PAGE}#this`;
const RDF_TARGET = `${POD}/id/schemes/doi`;
const RDF_TARGET_META = `${RDF_TARGET}.meta`;

const MEM_HAS_OPEN_ACTION = "https://pod.vardeman.me/vault/ontology/mem#hasOpenAction";
const SCHEMA_MAIN_ENTITY = "https://schema.org/mainEntity";
const AS_NS = "https://www.w3.org/ns/activitystreams#";

function potentialProposalTtl(opUrl: string, targetUrl: string): string {
  return `
@prefix as:     <https://www.w3.org/ns/activitystreams#> .
@prefix mem:    <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix schema: <https://schema.org/> .
<${opUrl}> a mem:RealignAction ;
    as:object <${targetUrl}> ;
    schema:actionStatus schema:PotentialActionStatus .`;
}

function resolvedProposalTtl(opUrl: string, targetUrl: string): string {
  return `
@prefix as:     <https://www.w3.org/ns/activitystreams#> .
@prefix mem:    <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix schema: <https://schema.org/> .
<${opUrl}> a mem:RealignAction ;
    as:object <${targetUrl}> ;
    schema:actionStatus schema:FailedActionStatus .`;
}

// --- in-memory stub store (mirrors OperationsIndexListener.test.ts) ----------

function makeStore(initialStates: Record<string, any[]> = {}) {
  const stores = new Map<string, Store>();
  const calls: Array<{ method: string; id: string; rep?: any }> = [];
  let handler: ((target: any, activity: any, metadata: any) => void) | null = null;

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
      const qs = await readableToQuads(rep.data);
      stores.set(id.path, qs);
      return new Map();
    },
    async _fire(target: { path: string }, activity: string) {
      if (!handler) throw new Error("handler not registered");
      handler(target, { value: activity }, {});
      await new Promise((r) => setTimeout(r, 10));
    },
    _getQuads(path: string) {
      return (stores.get(path) ?? new Store()).getQuads(null, null, null, null);
    },
    _seed(path: string, ttl: string) {
      stores.set(path, new Store(new Parser().parse(ttl)));
    },
  };
}

function withProposal(store: any, opUrl: string, ttl: string) {
  const proposalQuads = new Parser().parse(ttl);
  const originalGet = store.getRepresentation.bind(store);
  store.getRepresentation = async (id: { path: string }, prefs?: any) => {
    if (id.path === opUrl) {
      return new BasicRepresentation(proposalQuads, INTERNAL_QUADS);
    }
    return originalGet(id, prefs);
  };
}

function openActions(quads: any[], opUrl: string) {
  return quads.filter(
    (q: any) => q.predicate.value === MEM_HAS_OPEN_ACTION && q.object.value === opUrl,
  );
}

// --- tests ------------------------------------------------------------------

describe("D96 subject placement", () => {
  it("S1: target .meta declares schema:mainEntity → back-pointer lands on <#this>", async () => {
    const existing = [
      quad(namedNode(PAGE), namedNode(SCHEMA_MAIN_ENTITY), namedNode(THIS)),
    ];
    const store = makeStore({ [PAGE_META]: existing });
    withProposal(store, OP1, potentialProposalTtl(OP1, PAGE));

    const listener = new OperationsIndexListener(store as any);
    await listener.handle();
    await store._fire({ path: OP1 }, `${AS_NS}Create`);

    const hasOpen = openActions(store._getQuads(PAGE_META), OP1);
    expect(hasOpen.length).toBe(1);
    expect(hasOpen[0].subject.value).toBe(THIS);
  });

  it("S2: no mainEntity (RDF-native lane) → back-pointer stays on <>", async () => {
    const store = makeStore();
    withProposal(store, OP1, potentialProposalTtl(OP1, RDF_TARGET));

    const listener = new OperationsIndexListener(store as any);
    await listener.handle();
    await store._fire({ path: OP1 }, `${AS_NS}Create`);

    const hasOpen = openActions(store._getQuads(RDF_TARGET_META), OP1);
    expect(hasOpen.length).toBe(1);
    expect(hasOpen[0].subject.value).toBe(RDF_TARGET);
  });

  it("S3a: retraction removes a <#this>-subject back-pointer", async () => {
    const existing = [
      quad(namedNode(PAGE), namedNode(SCHEMA_MAIN_ENTITY), namedNode(THIS)),
      quad(namedNode(THIS), namedNode(MEM_HAS_OPEN_ACTION), namedNode(OP1)),
    ];
    const store = makeStore({ [PAGE_META]: existing });
    withProposal(store, OP1, resolvedProposalTtl(OP1, PAGE));

    const listener = new OperationsIndexListener(store as any);
    await listener.handle();
    (listener as any).seen.set(OP1, PAGE);
    await store._fire({ path: OP1 }, `${AS_NS}Update`);

    expect(openActions(store._getQuads(PAGE_META), OP1).length).toBe(0);
  });

  it("S3b: retraction removes a <>-subject back-pointer", async () => {
    const existing = [
      quad(namedNode(RDF_TARGET), namedNode(MEM_HAS_OPEN_ACTION), namedNode(OP1)),
    ];
    const store = makeStore({ [RDF_TARGET_META]: existing });
    withProposal(store, OP1, resolvedProposalTtl(OP1, RDF_TARGET));

    const listener = new OperationsIndexListener(store as any);
    await listener.handle();
    (listener as any).seen.set(OP1, RDF_TARGET);
    await store._fire({ path: OP1 }, `${AS_NS}Update`);

    expect(openActions(store._getQuads(RDF_TARGET_META), OP1).length).toBe(0);
  });

  it("S4: stale pre-D96 <>-subject pointer is cleaned on the next derive", async () => {
    // Resource carries the old <>-placement AND now declares mainEntity:
    // re-derive must strip the stale quad and leave exactly one on <#this>.
    const existing = [
      quad(namedNode(PAGE), namedNode(SCHEMA_MAIN_ENTITY), namedNode(THIS)),
      quad(namedNode(PAGE), namedNode(MEM_HAS_OPEN_ACTION), namedNode(OP1)),
    ];
    const store = makeStore({ [PAGE_META]: existing });
    withProposal(store, OP1, potentialProposalTtl(OP1, PAGE));

    const listener = new OperationsIndexListener(store as any);
    await listener.handle();
    await store._fire({ path: OP1 }, `${AS_NS}Create`);

    const hasOpen = openActions(store._getQuads(PAGE_META), OP1);
    expect(hasOpen.length).toBe(1);
    expect(hasOpen[0].subject.value).toBe(THIS);
    // mainEntity itself survived the merge
    const main = store._getQuads(PAGE_META).filter(
      (q: any) => q.predicate.value === SCHEMA_MAIN_ENTITY,
    );
    expect(main.length).toBe(1);
  });
});
