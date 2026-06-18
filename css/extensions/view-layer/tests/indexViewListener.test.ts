/**
 * Unit tests for IndexViewListener (SP2 Task 5).
 *
 * Stub-store idiom mirrors ops-index/OperationsIndexListener.test.ts: the "store"
 * is an in-memory stub that captures the 'changed' handler and records
 * getRepresentation / setRepresentation calls. The real buildIndexMarkdown and
 * quad-merge paths run; only the backend store is faked.
 *
 * The stub ALSO re-emits a 'changed' event synchronously from setRepresentation
 * (mimicking MonitoringStore) so the re-entrancy guard is genuinely exercised:
 * without the index-self path filter in memberContainer, a regeneration would loop.
 */
import { describe, it, expect } from "vitest";
import { DataFactory, Store } from "n3";
import { BasicRepresentation, INTERNAL_QUADS, readableToQuads, readableToString } from "@solid/community-server";
import { IndexViewListener } from "../src/IndexViewListener";

const VIEWS_BASE = "https://pod.example/vault/meta/views/";
const CONTAINER_INDEX_VIEW = `${VIEWS_BASE}container-index`;

const { namedNode, literal, quad } = DataFactory;

const BASE = "https://pod.example";
const CONCEPTS = `${BASE}/vault/wiki/concepts/`;
const PEOPLE = `${BASE}/vault/wiki/people/`;
const CONTAINERS = ["/vault/wiki/concepts/", "/vault/wiki/people/"];

const LDP_CONTAINS = "http://www.w3.org/ns/ldp#contains";
const PREF = "http://www.w3.org/2004/02/skos/core#prefLabel";
const DEF = "http://www.w3.org/2004/02/skos/core#definition";
const PROV = "http://www.w3.org/ns/prov#";
const AS_NS = "https://www.w3.org/ns/activitystreams#";

function containsQuads(container: string, members: string[]) {
  return members.map((m) => quad(namedNode(container), namedNode(LDP_CONTAINS), namedNode(m)));
}

function memberMetaQuads(member: string, label: string, definition?: string) {
  const thing = namedNode(`${member}#this`);
  const qs = [quad(thing, namedNode(PREF), literal(label))];
  if (definition) qs.push(quad(thing, namedNode(DEF), literal(definition)));
  return qs;
}

// --- in-memory stub store ----------------------------------------------------
// Per-path state: quads (RDF / .meta / container listings) or text (markdown).
// setRepresentation re-fires the captured 'changed' handler synchronously, the
// way MonitoringStore emits during the awaited write — guard must suppress it.

function makeStore(initialQuads: Record<string, any[]> = {}) {
  const quadsByPath = new Map<string, Store>();
  const textByPath = new Map<string, string>();
  const calls: Array<{ method: string; id: string; contentType?: string }> = [];
  let handler: ((target: any, activity: any, metadata: any) => void) | null = null;
  let emitOnWrite = true;
  let gate: { path: string; entered: () => void; held: Promise<void> } | null = null;

  for (const [path, qds] of Object.entries(initialQuads)) {
    quadsByPath.set(path, new Store(qds));
  }

  return {
    _calls: calls,
    _setQuads(path: string, qds: any[]) {
      quadsByPath.set(path, new Store(qds));
    },
    _getQuads(path: string) {
      return (quadsByPath.get(path) ?? new Store()).getQuads(null, null, null, null);
    },
    _getText(path: string) {
      return textByPath.get(path);
    },
    _disableEmitOnWrite() {
      emitOnWrite = false;
    },
    // One-shot: the NEXT setRepresentation to `path` blocks until release().
    // `entered` resolves once the write is in flight — the window where the
    // old global `deriving` flag silently dropped real member events.
    _gateNextWrite(path: string) {
      let entered!: () => void;
      let release!: () => void;
      const enteredP = new Promise<void>((r) => (entered = r));
      const held = new Promise<void>((r) => (release = r));
      gate = { path, entered, held };
      return { entered: enteredP, release };
    },
    _fireSync(target: { path: string }, activity: string) {
      if (!handler) throw new Error("handler not registered");
      handler(target, { value: activity }, {});
    },
    on(event: string, h: Function) {
      if (event === "changed") handler = h as any;
    },
    async getRepresentation(id: { path: string }, _prefs?: any) {
      calls.push({ method: "getRepresentation", id: id.path });
      if (textByPath.has(id.path)) {
        return new BasicRepresentation(textByPath.get(id.path)!, "text/markdown");
      }
      if (!quadsByPath.has(id.path)) {
        throw new Error(`not found: ${id.path}`);
      }
      const s = quadsByPath.get(id.path)!;
      return new BasicRepresentation(s.getQuads(null, null, null, null), INTERNAL_QUADS);
    },
    async setRepresentation(id: { path: string }, rep: any) {
      const contentType = rep.metadata?.contentType;
      calls.push({ method: "setRepresentation", id: id.path, contentType });
      if (gate && gate.path === id.path) {
        const g = gate;
        gate = null;
        g.entered();
        await g.held;
      }
      if (contentType === INTERNAL_QUADS) {
        quadsByPath.set(id.path, await readableToQuads(rep.data));
      } else {
        textByPath.set(id.path, await readableToString(rep.data));
      }
      // Mimic MonitoringStore: emit 'changed' synchronously during the write.
      if (emitOnWrite && handler) handler(id, { value: `${AS_NS}Update` }, {});
      return new Map();
    },
    async _fire(target: { path: string }, activity: string) {
      if (!handler) throw new Error("handler not registered");
      handler(target, { value: activity }, {});
      // Let the queued async regeneration settle.
      await new Promise((r) => setTimeout(r, 25));
    },
  };
}

function makeListener(store: any) {
  return new IndexViewListener(store as any, BASE, CONTAINERS, VIEWS_BASE);
}

// --- tests --------------------------------------------------------------------

describe("IndexViewListener", () => {
  it("T1: member write → index.md regenerated (frontmatter + definition line) and .meta carries the 3 prov triples", async () => {
    const member = `${CONCEPTS}alpha.md`;
    const store = makeStore({
      [CONCEPTS]: containsQuads(CONCEPTS, [member]),
      [`${member}.meta`]: memberMetaQuads(member, "Alpha Topic", "First letter of memory."),
    });
    const listener = makeListener(store);
    await listener.handle();

    await store._fire({ path: member }, `${AS_NS}Update`);

    const body = store._getText(`${CONCEPTS}index.md`);
    expect(body).toBeDefined();
    // The derived index is a durable write, so it carries the substrate write
    // contract's rationale: frontmatter (projects to mem:rationale on <>).
    expect(body!.startsWith("---\ntype: sub:ContainerIndex\nrationale: ")).toBe(true);
    expect(body).toContain("\n---\n");
    expect(body).toContain("- [Alpha Topic](alpha.md) — First letter of memory.");

    const meta = store._getQuads(`${CONCEPTS}index.md.meta`);
    const idx = `${CONCEPTS}index.md`;
    const derived = meta.filter((q: any) => q.subject.value === idx && q.predicate.value === `${PROV}wasDerivedFrom`);
    expect(derived.length).toBe(1);
    expect(derived[0].object.value).toBe(CONCEPTS);
    const genBy = meta.filter((q: any) => q.subject.value === idx && q.predicate.value === `${PROV}wasGeneratedBy`);
    expect(genBy.length).toBe(1);
    expect(genBy[0].object.value).toBe(CONTAINER_INDEX_VIEW);
    const genAt = meta.filter((q: any) => q.subject.value === idx && q.predicate.value === `${PROV}generatedAtTime`);
    expect(genAt.length).toBe(1);
    expect(genAt[0].object.datatype.value).toBe("http://www.w3.org/2001/XMLSchema#dateTime");
  });

  it("T2: second regeneration REPLACES the prov triples (no accumulation of generatedAtTime)", async () => {
    const member = `${CONCEPTS}alpha.md`;
    const store = makeStore({
      [CONCEPTS]: containsQuads(CONCEPTS, [member]),
      [`${member}.meta`]: memberMetaQuads(member, "Alpha"),
    });
    const listener = makeListener(store);
    await listener.handle();

    await store._fire({ path: member }, `${AS_NS}Update`);
    await store._fire({ path: member }, `${AS_NS}Update`);

    const meta = store._getQuads(`${CONCEPTS}index.md.meta`);
    const genAt = meta.filter((q: any) => q.predicate.value === `${PROV}generatedAtTime`);
    expect(genAt.length).toBe(1);
    const derived = meta.filter((q: any) => q.predicate.value === `${PROV}wasDerivedFrom`);
    expect(derived.length).toBe(1);
  });

  it("T3: prov merge does NOT clobber pre-existing index .meta quads (floor-materialized projection survives)", async () => {
    const member = `${CONCEPTS}alpha.md`;
    const idx = `${CONCEPTS}index.md`;
    const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
    const SUB_CI = "https://pod.vardeman.me/vault/ontology/substrate#ContainerIndex";
    const store = makeStore({
      [CONCEPTS]: containsQuads(CONCEPTS, [member]),
      [`${member}.meta`]: memberMetaQuads(member, "Alpha"),
      // Simulate the in-band floor having materialized the index's own projection.
      [`${idx}.meta`]: [quad(namedNode(`${idx}#this`), namedNode(RDF_TYPE), namedNode(SUB_CI))],
    });
    const listener = makeListener(store);
    await listener.handle();

    await store._fire({ path: member }, `${AS_NS}Update`);

    const meta = store._getQuads(`${idx}.meta`);
    const typeQuads = meta.filter((q: any) => q.subject.value === `${idx}#this` && q.predicate.value === RDF_TYPE);
    expect(typeQuads.length).toBe(1);
    expect(typeQuads[0].object.value).toBe(SUB_CI);
    expect(meta.filter((q: any) => q.predicate.value === `${PROV}wasDerivedFrom`).length).toBe(1);
  });

  it("T4: out-of-container, container-self, index-self and index-meta events are ignored", async () => {
    const store = makeStore({ [CONCEPTS]: containsQuads(CONCEPTS, []) });
    const listener = makeListener(store);
    await listener.handle();

    await store._fire({ path: `${BASE}/vault/contacts/x.ttl` }, `${AS_NS}Update`);
    await store._fire({ path: CONCEPTS }, `${AS_NS}Update`);
    await store._fire({ path: `${CONCEPTS}index.md` }, `${AS_NS}Update`);
    await store._fire({ path: `${CONCEPTS}index.md.meta` }, `${AS_NS}Update`);
    // Nested (non-direct-member) resource — e.g. an .operations/ ledger entry.
    await store._fire({ path: `${CONCEPTS}.operations/p1.ttl` }, `${AS_NS}Update`);

    const writes = store._calls.filter((c) => c.method === "setRepresentation");
    expect(writes.length).toBe(0);
  });

  it("T5: re-entrancy guard — one member event yields exactly TWO writes (index.md + index.md.meta), no loop", async () => {
    const member = `${CONCEPTS}alpha.md`;
    const store = makeStore({
      [CONCEPTS]: containsQuads(CONCEPTS, [member]),
      [`${member}.meta`]: memberMetaQuads(member, "Alpha"),
    });
    const listener = makeListener(store);
    await listener.handle();

    // The stub re-emits 'changed' synchronously from every setRepresentation —
    // the index-self path filter must hold the line on its own.
    await store._fire({ path: member }, `${AS_NS}Update`);
    await new Promise((r) => setTimeout(r, 50));

    const writes = store._calls.filter((c) => c.method === "setRepresentation");
    expect(writes.map((c) => c.id).sort()).toEqual([
      `${CONCEPTS}index.md`,
      `${CONCEPTS}index.md.meta`,
    ]);
  });

  it("T6: missing member .meta is tolerated (member skipped, others indexed)", async () => {
    const withMeta = `${CONCEPTS}good.md`;
    const noMeta = `${CONCEPTS}bare.md`;
    const store = makeStore({
      [CONCEPTS]: containsQuads(CONCEPTS, [withMeta, noMeta]),
      [`${withMeta}.meta`]: memberMetaQuads(withMeta, "Good", "Has metadata."),
      // bare.md has NO .meta entry → getRepresentation throws → tolerated
    });
    const listener = makeListener(store);
    await listener.handle();

    await store._fire({ path: noMeta }, `${AS_NS}Update`);

    const body = store._getText(`${CONCEPTS}index.md`);
    expect(body).toContain("- [Good](good.md) — Has metadata.");
    expect(body).not.toContain("bare");
  });

  it("T7: member DELETE event regenerates from the remaining membership", async () => {
    const gone = `${CONCEPTS}gone.md`;
    const kept = `${CONCEPTS}kept.md`;
    // Container listing reflects post-delete state (gone.md already removed).
    const store = makeStore({
      [CONCEPTS]: containsQuads(CONCEPTS, [kept]),
      [`${kept}.meta`]: memberMetaQuads(kept, "Kept"),
    });
    const listener = makeListener(store);
    await listener.handle();

    await store._fire({ path: gone }, `${AS_NS}Delete`);

    const body = store._getText(`${CONCEPTS}index.md`);
    expect(body).toContain("- [Kept](kept.md)");
    expect(body).not.toContain("gone.md");
  });

  it("T8: events route to the RIGHT container (people write does not touch concepts index)", async () => {
    const person = `${PEOPLE}ada.md`;
    const store = makeStore({
      [PEOPLE]: containsQuads(PEOPLE, [person]),
      [`${person}.meta`]: memberMetaQuads(person, "Ada Lovelace"),
      [CONCEPTS]: containsQuads(CONCEPTS, []),
    });
    const listener = makeListener(store);
    await listener.handle();

    await store._fire({ path: person }, `${AS_NS}Create`);

    expect(store._getText(`${PEOPLE}index.md`)).toContain("Ada Lovelace");
    expect(store._getText(`${CONCEPTS}index.md`)).toBeUndefined();
  });

  it("T9: a member's .meta event (backstop projection write) also triggers regeneration", async () => {
    const member = `${CONCEPTS}late.md`;
    const store = makeStore({
      [CONCEPTS]: containsQuads(CONCEPTS, [member]),
      [`${member}.meta`]: memberMetaQuads(member, "Late Projection"),
    });
    const listener = makeListener(store);
    await listener.handle();

    await store._fire({ path: `${member}.meta` }, `${AS_NS}Update`);

    expect(store._getText(`${CONCEPTS}index.md`)).toContain("Late Projection");
  });

  it("T10: two member 'changed' events fired synchronously both contribute to the final index (per-container pending chain)", async () => {
    const alpha = `${CONCEPTS}alpha.md`;
    const beta = `${CONCEPTS}beta.md`;
    // Both members exist in the container from the start.
    const store = makeStore({
      [CONCEPTS]: containsQuads(CONCEPTS, [alpha, beta]),
      [`${alpha}.meta`]: memberMetaQuads(alpha, "Alpha", "First."),
      [`${beta}.meta`]: memberMetaQuads(beta, "Beta", "Second."),
    });
    const listener = makeListener(store);
    await listener.handle();

    // Fire both events synchronously — no await between them.
    // The pending chain must serialize the two regenerations without dropping either.
    const handler = (store as any);
    handler._fire({ path: alpha }, `${AS_NS}Update`);
    handler._fire({ path: beta }, `${AS_NS}Update`);

    // Wait long enough for both chained regenerations to settle.
    await new Promise((r) => setTimeout(r, 80));

    const body = store._getText(`${CONCEPTS}index.md`);
    expect(body).toBeDefined();
    expect(body).toContain("Alpha");
    expect(body).toContain("Beta");

    // At least one index.md write must have happened (both regenerations share the same path).
    const indexWrites = store._calls.filter(
      (c: any) => c.method === "setRepresentation" && c.id === `${CONCEPTS}index.md`,
    );
    expect(indexWrites.length).toBeGreaterThanOrEqual(1);
  });

  it("T11: a member event arriving DURING a running regeneration is NOT dropped — a fresh regeneration runs after it (the SP2-T5 stale-index flake)", async () => {
    const alpha = `${CONCEPTS}alpha.md`;
    const beta = `${CONCEPTS}beta.md`;
    const store = makeStore({
      [CONCEPTS]: containsQuads(CONCEPTS, [alpha, beta]),
      [`${alpha}.meta`]: memberMetaQuads(alpha, "Alpha", "First."),
      [`${beta}.meta`]: memberMetaQuads(beta, "Beta", "Second."),
    });
    const listener = makeListener(store);
    await listener.handle();

    // Event A: regeneration reads [alpha, beta], then blocks mid-write on index.md.
    const gate = store._gateNextWrite(`${CONCEPTS}index.md`);
    store._fireSync({ path: alpha }, `${AS_NS}Update`);
    await gate.entered;

    // While A's regeneration is in flight: beta is DELETEd. A already read the
    // pre-delete membership, so only a FRESH regeneration scheduled after A can
    // produce a correct index.
    store._setQuads(CONCEPTS, containsQuads(CONCEPTS, [alpha]));
    store._fireSync({ path: beta }, `${AS_NS}Delete`);

    gate.release();
    await new Promise((r) => setTimeout(r, 80));

    const body = store._getText(`${CONCEPTS}index.md`);
    expect(body).toBeDefined();
    expect(body).toContain("Alpha");
    expect(body).not.toContain("Beta");
  });

  it("T12 (F8): a 5-event burst during a running regeneration coalesces to ≤2 regenerations AND the final index reflects post-burst state", async () => {
    const alpha = `${CONCEPTS}alpha.md`;
    const beta = `${CONCEPTS}beta.md`;
    const store = makeStore({
      [CONCEPTS]: containsQuads(CONCEPTS, [alpha]),
      [`${alpha}.meta`]: memberMetaQuads(alpha, "Alpha", "First."),
      [`${beta}.meta`]: memberMetaQuads(beta, "Beta", "Second."),
    });
    const listener = makeListener(store);
    await listener.handle();

    // Regeneration A reads [alpha], then blocks mid-write on index.md.
    const gate = store._gateNextWrite(`${CONCEPTS}index.md`);
    store._fireSync({ path: alpha }, `${AS_NS}Update`);
    await gate.entered;

    // A 5-event burst lands while A is in flight; the membership now includes beta.
    store._setQuads(CONCEPTS, containsQuads(CONCEPTS, [alpha, beta]));
    for (let i = 0; i < 5; i += 1) store._fireSync({ path: beta }, `${AS_NS}Update`);

    gate.release();
    await new Promise((r) => setTimeout(r, 80));

    // Trailing-coalesce: the running regen + ONE more that sees final state.
    const indexWrites = store._calls.filter(
      (c: any) => c.method === "setRepresentation" && c.id === `${CONCEPTS}index.md`,
    );
    expect(indexWrites.length).toBeLessThanOrEqual(2);
    const body = store._getText(`${CONCEPTS}index.md`);
    expect(body).toContain("Alpha");
    expect(body).toContain("Beta");
  });
});

// F5: with NESTED registered containers, the member's container must be the
// LONGEST matching prefix — the old first-match loop returned undefined for an
// inner member when the outer container matched first (order-dependent).
describe("IndexViewListener — nested containers (F5 longest-prefix)", () => {
  const OUTER = `${BASE}/vault/x/`;
  const INNER = `${BASE}/vault/x/y/`;
  const orders: Record<string, string[]> = {
    "outer-first": [OUTER, INNER],
    "inner-first": [INNER, OUTER],
  };

  for (const [name, containers] of Object.entries(orders)) {
    it(`inner member event routes to the INNER container (${name})`, async () => {
      const m = `${INNER}m.md`;
      const store = makeStore({
        [OUTER]: containsQuads(OUTER, []),
        [INNER]: containsQuads(INNER, [m]),
        [`${m}.meta`]: memberMetaQuads(m, "Inner Note"),
      });
      const listener = new IndexViewListener(store as any, BASE, containers, VIEWS_BASE);
      await listener.handle();

      await store._fire({ path: m }, `${AS_NS}Update`);

      expect(store._getText(`${INNER}index.md`)).toContain("Inner Note");
      expect(store._getText(`${OUTER}index.md`)).toBeUndefined();
    });

    it(`outer member event routes to the OUTER container (${name})`, async () => {
      const m = `${OUTER}m.md`;
      const store = makeStore({
        [OUTER]: containsQuads(OUTER, [m]),
        [INNER]: containsQuads(INNER, []),
        [`${m}.meta`]: memberMetaQuads(m, "Outer Note"),
      });
      const listener = new IndexViewListener(store as any, BASE, containers, VIEWS_BASE);
      await listener.handle();

      await store._fire({ path: m }, `${AS_NS}Update`);

      expect(store._getText(`${OUTER}index.md`)).toContain("Outer Note");
      expect(store._getText(`${INNER}index.md`)).toBeUndefined();
    });

    it(`nested non-member resource is still ignored (${name})`, async () => {
      const store = makeStore({
        [OUTER]: containsQuads(OUTER, []),
        [INNER]: containsQuads(INNER, []),
      });
      const listener = new IndexViewListener(store as any, BASE, containers, VIEWS_BASE);
      await listener.handle();

      await store._fire({ path: `${OUTER}.ops/f` }, `${AS_NS}Update`);

      const writes = store._calls.filter((c) => c.method === "setRepresentation");
      expect(writes.length).toBe(0);
    });
  }
});
