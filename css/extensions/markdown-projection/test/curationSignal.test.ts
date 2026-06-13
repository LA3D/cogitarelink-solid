// PSP T5: the degraded-reprojection curation signal.
//
// The record shape MIRRORS mem-trigger's detector events (ContradictionDetector.buildEvent)
// — markdown-projection has no package edge to mem-trigger, so the shape is duplicated and
// PINNED here (the consumer is the same .events/ curation lane).
import { describe, it, expect, beforeEach } from "vitest";
import { Parser, Store, DataFactory } from "n3";
import {
  buildDegradedSignalTtl,
  signalDegraded,
  pendingCurationSignals,
  eventsContainerFor,
  DEGRADED_SUMMARY,
  SUBSTRATE_ACTOR,
} from "../src-cjs/curationSignal.js";
import { MarkdownProjectionListener, DEFAULT_STAMP_PRED } from "../src-cjs/listener.js";

const { namedNode } = DataFactory;

const AS_NS = "https://www.w3.org/ns/activitystreams#";
const MEM = "https://pod.vardeman.me/vault/ontology/mem#";
const PROV = "http://www.w3.org/ns/prov#";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

const RESOURCE = "https://pod.vardeman.me/vault/wiki/concepts/x.md";
const EVENTS = "https://pod.vardeman.me/vault/wiki/.events/";

describe("buildDegradedSignalTtl — the pinned event record shape", () => {
  const now = new Date("2026-06-12T10:00:00Z");
  const store = new Store(new Parser().parse(buildDegradedSignalTtl(RESOURCE, EVENTS, now)));
  const subject = store.getQuads(null, namedNode(RDF_TYPE), null, null)[0]?.subject;

  it("is a urn:uuid-subject as:Activity + mem:Event + mem:StalenessDetected (mem-trigger's record pattern)", () => {
    expect(subject?.value).toMatch(/^urn:uuid:/);
    const types = store.getQuads(subject, namedNode(RDF_TYPE), null, null).map((q) => q.object.value);
    expect(types).toContain(`${AS_NS}Activity`);
    expect(types).toContain(`${MEM}Event`);
    expect(types).toContain(`${MEM}StalenessDetected`);
  });

  it("carries actor + prov:wasAssociatedWith (the substrate URN)", () => {
    expect(store.getQuads(subject, namedNode(`${AS_NS}actor`), namedNode(SUBSTRATE_ACTOR), null)).toHaveLength(1);
    expect(store.getQuads(subject, namedNode(`${PROV}wasAssociatedWith`), namedNode(SUBSTRATE_ACTOR), null)).toHaveLength(1);
  });

  it("carries as:object <resource>, as:target <events container>, as:published dateTime", () => {
    expect(store.getQuads(subject, namedNode(`${AS_NS}object`), namedNode(RESOURCE), null)).toHaveLength(1);
    expect(store.getQuads(subject, namedNode(`${AS_NS}target`), namedNode(EVENTS), null)).toHaveLength(1);
    const pub = store.getQuads(subject, namedNode(`${AS_NS}published`), null, null);
    expect(pub).toHaveLength(1);
    expect(pub[0].object.value).toBe(now.toISOString());
  });

  it("carries mem:stalenessClass mem:Materialization + the degraded as:summary", () => {
    expect(
      store.getQuads(subject, namedNode(`${MEM}stalenessClass`), namedNode(`${MEM}Materialization`), null),
    ).toHaveLength(1);
    const summary = store.getQuads(subject, namedNode(`${AS_NS}summary`), null, null);
    expect(summary).toHaveLength(1);
    expect(summary[0].object.value).toBe(DEGRADED_SUMMARY);
    expect(DEGRADED_SUMMARY).toContain("pair-shadow");
    expect(DEGRADED_SUMMARY).toContain("residue possible");
  });
});

describe("eventsContainerFor", () => {
  it("derives <storageBase>/wiki/.events/ (the MemTriggerListener derivation — no baked root)", () => {
    expect(eventsContainerFor("https://pod.vardeman.me/vault")).toBe(EVENTS);
    expect(eventsContainerFor("https://pod.vardeman.me/vault/")).toBe(EVENTS);
  });
});

describe("listener drains pending signals into .events/ (mirrors EventEmitter.emit)", () => {
  beforeEach(() => { pendingCurationSignals.length = 0; });

  it("writes each queued signal as a timestamped .ttl via store.setRepresentation, then empties the buffer", async () => {
    const calls: Array<{ path: string; data: string }> = [];
    const storeStub = {
      on() {},
      async setRepresentation(id: { path: string }, rep: any) {
        const chunks: Buffer[] = [];
        for await (const c of rep.data) chunks.push(Buffer.from(c));
        calls.push({ path: id.path, data: Buffer.concat(chunks).toString("utf8") });
      },
    } as any;
    const listener = new MarkdownProjectionListener(
      storeStub, "https://pod.vardeman.me", "/tmp", undefined, "/vault", DEFAULT_STAMP_PRED, "",
    );

    signalDegraded(RESOURCE, EVENTS);
    await (listener as any).drainCurationSignals();

    expect(calls).toHaveLength(1);
    expect(calls[0].path.startsWith(EVENTS)).toBe(true);
    expect(calls[0].path.endsWith(".ttl")).toBe(true);
    expect(calls[0].data).toContain("StalenessDetected");
    expect(calls[0].data).toContain(RESOURCE);
    expect(pendingCurationSignals).toHaveLength(0);
  });

  it("a failing emit drops the signal without throwing (substrate archival must not block)", async () => {
    const storeStub = {
      on() {},
      async setRepresentation() { throw new Error("store down"); },
    } as any;
    const listener = new MarkdownProjectionListener(
      storeStub, "https://pod.vardeman.me", "/tmp", undefined, "/vault", DEFAULT_STAMP_PRED, "",
    );
    signalDegraded(RESOURCE, EVENTS);
    await expect((listener as any).drainCurationSignals()).resolves.toBeUndefined();
    expect(pendingCurationSignals).toHaveLength(0);
  });
});
