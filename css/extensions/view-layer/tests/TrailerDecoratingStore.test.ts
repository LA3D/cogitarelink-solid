import { describe, it, expect, vi } from "vitest";
import {
  BasicRepresentation,
  RepresentationMetadata,
  guardedStreamFrom,
  readableToString,
  INTERNAL_QUADS,
} from "@solid/community-server";
import { DataFactory } from "n3";
import { TrailerDecoratingStore } from "../src/TrailerDecoratingStore";
import { TRAILER_MARKER, TRAILER_END } from "../src/trailer";

const { namedNode, quad, literal } = DataFactory;

const MEM = "https://pod.vardeman.me/vault/ontology/mem#";
const MEM_HAS_OPEN_ACTION = `${MEM}hasOpenAction`;
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

const RES = "https://pod.vardeman.me/vault/wiki/concepts/agent-memory.md";
const META = `${RES}.meta`;
const OP = "https://pod.vardeman.me/vault/wiki/.operations/p1.ttl";
const BODY = "# Agent Memory\n\nthe agent memory note\n";

// Build a RepresentationMetadata carrying contentType + optional open actions.
function meta(contentType: string | undefined, openActions: string[] = []): RepresentationMetadata {
  const m = new RepresentationMetadata({ path: RES });
  if (contentType) m.contentType = contentType;
  for (const op of openActions) {
    m.add(namedNode(MEM_HAS_OPEN_ACTION), namedNode(op));
  }
  return m;
}

// op-resource quads: rdf:type mem:RealignAction (+ optional mem:rationale).
function opQuads(opts: { rationale?: string; type?: string; bad?: boolean } = {}) {
  const q = [
    quad(namedNode(OP), namedNode(RDF_TYPE),
      namedNode(opts.type ?? `${MEM}RealignAction`)),
  ];
  if (opts.rationale) {
    q.push(quad(namedNode(OP), namedNode(`${MEM}rationale`), literal(opts.rationale)));
  }
  return q;
}

// A source ResourceStore: getRepresentation services the stored body (with its
// metadata) and the op resource (INTERNAL_QUADS). opOpts=null → op fetch throws.
function makeSource(
  bodyMeta: RepresentationMetadata,
  opOpts: { rationale?: string; type?: string } | null = null,
) {
  const getRepresentation = vi.fn(async (id: { path: string }, prefs: any) => {
    if (id.path === RES) {
      return new BasicRepresentation(guardedStreamFrom(BODY), bodyMeta);
    }
    if (id.path === OP) {
      if (opOpts === null) throw new Error("op not found");
      const wantsQuads = !!(prefs?.type && prefs.type[INTERNAL_QUADS]);
      if (!wantsQuads) throw new Error("op fetch must request internal/quads");
      return { data: guardedStreamFrom(opQuads(opOpts)) } as any;
    }
    throw new Error(`unexpected getRepresentation: ${id.path}`);
  });
  return { source: { getRepresentation } as any, getRepresentation };
}

// AuxiliaryStrategy stub: only META is auxiliary.
const auxStrategy = {
  isAuxiliaryIdentifier: (id: { path: string }) => id.path.endsWith(".meta"),
} as any;

function build(
  bodyMeta: RepresentationMetadata,
  opOpts: { rationale?: string; type?: string } | null = null,
) {
  const { source, getRepresentation } = makeSource(bodyMeta, opOpts);
  return { store: new TrailerDecoratingStore(source, auxStrategy), getRepresentation };
}

describe("TrailerDecoratingStore — decorating path", () => {
  it("appends a trailer naming the op IRI when an open action is present", async () => {
    const { store } = build(meta("text/markdown", [OP]), { rationale: "stale broader" });
    const rep = await store.getRepresentation({ path: RES }, {});
    const out = await readableToString(rep.data);
    expect(out.startsWith(BODY)).toBe(true);
    expect(out).toContain(TRAILER_MARKER);
    expect(out).toContain(TRAILER_END);
    expect(out).toContain(`<${OP}>`);
    expect(out.trimEnd().endsWith(TRAILER_END)).toBe(true);
  });

  it("includes the rationale when the op resource has mem:rationale", async () => {
    const { store } = build(meta("text/markdown", [OP]), { rationale: "stale broader" });
    const out = await readableToString((await store.getRepresentation({ path: RES }, {})).data);
    expect(out).toContain("stale broader");
  });

  it("omits the rationale when the op resource has none", async () => {
    const { store } = build(meta("text/markdown", [OP]), {});
    const out = await readableToString((await store.getRepresentation({ path: RES }, {})).data);
    expect(out).toContain(`<${OP}>`);
    expect(out).not.toContain(' — "');
  });

  it("derives a compact type label from the op's rdf:type", async () => {
    const { store } = build(meta("text/markdown", [OP]), { rationale: "r" });
    const out = await readableToString((await store.getRepresentation({ path: RES }, {})).data);
    expect(out).toContain("mem:RealignAction");
  });

  it("renders the trailer (rationale undefined) when the op fetch fails", async () => {
    const { store } = build(meta("text/markdown", [OP]), null);
    const out = await readableToString((await store.getRepresentation({ path: RES }, {})).data);
    expect(out).toContain(`<${OP}>`);
    expect(out).not.toContain(' — "');
    // type falls back to mem:Action when the op is unreadable
    expect(out).toContain("mem:Action");
  });

  it("preserves the source metadata on the decorated representation", async () => {
    const bodyMeta = meta("text/markdown", [OP]);
    const { store } = build(bodyMeta, { rationale: "r" });
    const rep = await store.getRepresentation({ path: RES }, {});
    expect(rep.metadata.contentType).toBe("text/markdown");
    expect(rep.metadata.getAll(namedNode(MEM_HAS_OPEN_ACTION)).map((t) => t.value)).toContain(OP);
  });

  it("fetches the op resource exactly once (rationale + type share one fetch)", async () => {
    const { store, getRepresentation } = build(meta("text/markdown", [OP]), { rationale: "r" });
    await readableToString((await store.getRepresentation({ path: RES }, {})).data);
    const opFetches = getRepresentation.mock.calls.filter((c) => c[0].path === OP);
    expect(opFetches.length).toBe(1);
  });
});

describe("TrailerDecoratingStore — passthrough path", () => {
  it("no open action → body byte-identical (same stream, no buffering)", async () => {
    const bodyMeta = meta("text/markdown", []);
    const { store, getRepresentation } = build(bodyMeta, null);
    const rep = await store.getRepresentation({ path: RES }, {});
    const out = await readableToString(rep.data);
    expect(out).toBe(BODY);
    // only the body was fetched — no op resource read, no decoration
    expect(getRepresentation.mock.calls.filter((c) => c[0].path === OP).length).toBe(0);
  });

  it("auxiliary (.meta) identifier → never decorated", async () => {
    // Source returns a markdown-typed rep WITH an open action, but the id is .meta.
    const bodyMeta = meta("text/markdown", [OP]);
    const { source } = makeSource(bodyMeta, { rationale: "r" });
    // override source to serve at the .meta path
    source.getRepresentation = vi.fn(async () =>
      new BasicRepresentation(guardedStreamFrom(BODY), bodyMeta));
    const store = new TrailerDecoratingStore(source, auxStrategy);
    const out = await readableToString((await store.getRepresentation({ path: META }, {})).data);
    expect(out).toBe(BODY);
    expect(out).not.toContain(TRAILER_MARKER);
  });

  it("non-markdown contentType → never decorated", async () => {
    const bodyMeta = meta("text/turtle", [OP]);
    const { store } = build(bodyMeta, { rationale: "r" });
    const out = await readableToString((await store.getRepresentation({ path: RES }, {})).data);
    expect(out).toBe(BODY);
    expect(out).not.toContain(TRAILER_MARKER);
  });

  it("missing contentType → never decorated", async () => {
    const bodyMeta = meta(undefined, [OP]);
    const { store } = build(bodyMeta, { rationale: "r" });
    const out = await readableToString((await store.getRepresentation({ path: RES }, {})).data);
    expect(out).toBe(BODY);
    expect(out).not.toContain(TRAILER_MARKER);
  });
});
