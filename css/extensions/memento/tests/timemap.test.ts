import { describe, it, expect } from "vitest";
import { Parser, Store } from "n3";
import { serializeTimemap } from "../src/timemap";
import type { MementoRecord } from "../src/types";

const ORIGINAL = "http://pod.example/note.md";
const MEMENTO_NS = "http://mementoweb.org/ns#";

function toMementoUri(r: MementoRecord): string {
  const s = r.datetime.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `${ORIGINAL}?version=${s}`;
}

function parseStore(turtle: string): Store {
  const store = new Store();
  store.addQuads(new Parser().parse(turtle));
  return store;
}

describe("serializeTimemap", () => {
  const r1: MementoRecord = { hash: "abc1234", datetime: new Date(Date.UTC(2026, 2, 1, 12, 0, 0)) };
  const r2: MementoRecord = { hash: "def5678", datetime: new Date(Date.UTC(2026, 3, 1, 12, 0, 0)) };

  it("returns a Promise (async contract)", () => {
    const result = serializeTimemap(ORIGINAL, [r1, r2], toMementoUri);
    expect(result).toBeInstanceOf(Promise);
  });

  it("produces parseable Turtle", async () => {
    const turtle = await serializeTimemap(ORIGINAL, [r1, r2], toMementoUri);
    expect(turtle).not.toBe("");
    expect(() => parseStore(turtle)).not.toThrow();
  });

  it("declares the OriginalResource with memento:original linkage from each Memento", async () => {
    const turtle = await serializeTimemap(ORIGINAL, [r1, r2], toMementoUri);
    const store = parseStore(turtle);
    const originalLinks = store.getQuads(null, `${MEMENTO_NS}original`, null, null);
    expect(originalLinks.length).toBe(2);
    for (const q of originalLinks) {
      expect(q.object.value).toBe(ORIGINAL);
    }
  });

  it("emits a memento:mementoDatetime literal per record", async () => {
    const turtle = await serializeTimemap(ORIGINAL, [r1, r2], toMementoUri);
    const store = parseStore(turtle);
    const dts = store.getQuads(null, `${MEMENTO_NS}mementoDatetime`, null, null);
    expect(dts.length).toBe(2);
    const isoDatetimes = dts.map((q) => q.object.value).sort();
    expect(isoDatetimes).toEqual([
      "2026-03-01T12:00:00.000Z",
      "2026-04-01T12:00:00.000Z",
    ]);
  });

  it("types Memento subjects as memento:Memento", async () => {
    const turtle = await serializeTimemap(ORIGINAL, [r1, r2], toMementoUri);
    const store = parseStore(turtle);
    const types = store.getQuads(
      null,
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      `${MEMENTO_NS}Memento`,
      null,
    );
    expect(types.length).toBe(2);
  });

  it("includes a memento:TimeMap subject for the TimeMap itself", async () => {
    const turtle = await serializeTimemap(ORIGINAL, [r1, r2], toMementoUri);
    const store = parseStore(turtle);
    const timemaps = store.getQuads(
      null,
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      `${MEMENTO_NS}TimeMap`,
      null,
    );
    expect(timemaps.length).toBe(1);
  });

  it("handles empty record list — emits at least the TimeMap subject", async () => {
    const turtle = await serializeTimemap(ORIGINAL, [], toMementoUri);
    const store = parseStore(turtle);
    const timemaps = store.getQuads(
      null,
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      `${MEMENTO_NS}TimeMap`,
      null,
    );
    expect(timemaps.length).toBe(1);
    expect(store.getQuads(null, `${MEMENTO_NS}mementoDatetime`, null, null).length).toBe(0);
  });

  it("emits memento:from and memento:until on the TimeMap, spanning the record range", async () => {
    const turtle = await serializeTimemap(ORIGINAL, [r1, r2], toMementoUri);
    const store = parseStore(turtle);
    const from = store.getQuads(null, `${MEMENTO_NS}from`, null, null);
    const until = store.getQuads(null, `${MEMENTO_NS}until`, null, null);
    expect(from.length).toBe(1);
    expect(until.length).toBe(1);
    expect(from[0].object.value).toBe("2026-03-01T12:00:00.000Z");
    expect(until[0].object.value).toBe("2026-04-01T12:00:00.000Z");
  });

  it("emits memento:timegate from the OriginalResource (OriginalResource doubles as TimeGate per D61)", async () => {
    const turtle = await serializeTimemap(ORIGINAL, [r1, r2], toMementoUri);
    const store = parseStore(turtle);
    const tg = store.getQuads(null, `${MEMENTO_NS}timegate`, null, null);
    expect(tg.length).toBe(1);
    expect(tg[0].subject.value).toBe(ORIGINAL);
    expect(tg[0].object.value).toBe(ORIGINAL);
  });

  it("omits from/until when record list is empty (no datetimes to bound)", async () => {
    const turtle = await serializeTimemap(ORIGINAL, [], toMementoUri);
    const store = parseStore(turtle);
    expect(store.getQuads(null, `${MEMENTO_NS}from`, null, null).length).toBe(0);
    expect(store.getQuads(null, `${MEMENTO_NS}until`, null, null).length).toBe(0);
  });
});
