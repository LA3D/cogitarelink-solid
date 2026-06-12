import { describe, it, expect } from "vitest";
import { guardedStreamFrom, NotImplementedHttpError } from "@solid/community-server";
import { Store, DataFactory } from "n3";
import { ViewHttpHandler } from "../src/ViewHttpHandler";
import { ViewAssembler } from "../src/ViewAssembler";

const { namedNode, quad, literal } = DataFactory;

const BASE = "https://pod.vardeman.me";
const VIEWS = "https://pod.vardeman.me/vault/meta/views/";
const RES = `${BASE}/vault/wiki/concepts/agent-memory.md`;

const STORED_BODY = "# Agent Memory\n\nthe agent memory note\n";

// A known .meta triple the views must surface.
const META_QUADS = [
  quad(namedNode(RES), namedNode("http://purl.org/dc/terms/title"), literal("Agent Memory")),
  quad(namedNode(`${RES}#this`),
       namedNode("http://www.w3.org/2004/02/skos/core#prefLabel"), literal("Agent Memory")),
];

// ── RDF resource case (substrate-wide fused, e.g. /id/schemes/orcid) ──
// An RDF record (text/turtle) with its OWN triples, whose .meta carries an open action.
const RDF_RES = `${BASE}/id/schemes/orcid`;
const HAS_OPEN_ACTION = "https://pod.vardeman.me/vault/ontology/mem#hasOpenAction";
const RDF_OWN_QUADS = [
  quad(namedNode(RDF_RES), namedNode("http://www.w3.org/2004/02/skos/core#prefLabel"),
       literal("ORCID")),
  quad(namedNode(RDF_RES), namedNode("http://www.w3.org/2004/02/skos/core#notation"),
       literal("orcid")),
];
const RDF_META_QUADS = [
  quad(namedNode(RDF_RES), namedNode(HAS_OPEN_ACTION),
       namedNode("https://pod.vardeman.me/id/.operations/abc")),
];
// CSS stamps on-the-fly bookkeeping (posix:mtime/size) into the ResponseMetadata
// named graph on every INTERNAL_QUADS read — the fused union must exclude it.
const RESPONSE_META_GRAPH = "urn:npm:solid:community-server:meta:ResponseMetadata";
const RDF_BOOKKEEPING_QUADS = [
  quad(namedNode(`${RDF_RES}.meta`), namedNode("http://www.w3.org/ns/posix/stat#mtime"),
       literal("1749600000"), namedNode(RESPONSE_META_GRAPH)),
  quad(namedNode(`${RDF_RES}.meta`), namedNode("http://www.w3.org/ns/posix/stat#size"),
       literal("123"), namedNode(RESPONSE_META_GRAPH)),
];

const FUSED_PROJECTION = "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }";

// View descriptor stubs — minimal turtle, each carries its token as a literal.
function descriptor(token: string): string {
  return `<${VIEWS}${token}> <http://www.w3.org/ns/dx/prof/hasToken> "${token}" .\n`;
}

const DESCRIPTORS: Record<string, string> = {
  [`${VIEWS}fused`]: descriptor("fused"),
  [`${VIEWS}people`]: descriptor("people"),
};

// A fake ResourceStore whose getRepresentation services:
//  - the stored body (text/markdown preference) → STORED_BODY
//  - the .meta resource (INTERNAL_QUADS or text/turtle) → META_QUADS
//  - {viewsBase}fused-projection (text/markdown / string) → FUSED_PROJECTION
//  - the two {viewsBase}<view> descriptors (turtle/quads) → DESCRIPTORS
// Minimal metadata stub exposing the contentType getter the handler reads.
function meta(contentType: string) {
  return { contentType };
}

function makeStore(opts: { bodyMissing?: boolean; projectionMissing?: boolean } = {}) {
  return {
    async getRepresentation(id: { path: string }, prefs: any) {
      const path = id.path;
      const wantsQuads = !!(prefs?.type && prefs.type["internal/quads"]);
      const wantsTurtle = !!(prefs?.type && prefs.type["text/turtle"]);

      // .meta resource — RDF record's .meta carries the open action. Faithful to
      // CSS: the INTERNAL_QUADS read also carries the ResponseMetadata named graph.
      if (path === `${RDF_RES}.meta`) {
        if (wantsQuads) {
          const s = new Store([...RDF_META_QUADS, ...RDF_BOOKKEEPING_QUADS]);
          return { data: guardedStreamFrom(s.getQuads(null, null, null, null)),
                   metadata: meta("internal/quads") };
        }
        const a = new ViewAssembler();
        const ttl = await a.serializeTurtle(RDF_META_QUADS);
        return { data: guardedStreamFrom(ttl), metadata: meta("text/turtle") };
      }

      // .meta resource (markdown note).
      if (path.endsWith(".meta")) {
        if (wantsQuads) {
          const s = new Store(META_QUADS);
          return { data: guardedStreamFrom(s.getQuads(null, null, null, null)),
                   metadata: meta("internal/quads") };
        }
        // turtle string
        const a = new ViewAssembler();
        const ttl = await a.serializeTurtle(META_QUADS);
        return { data: guardedStreamFrom(ttl), metadata: meta("text/turtle") };
      }

      // fused-projection query text.
      if (path === `${VIEWS}fused-projection`) {
        if (opts.projectionMissing) {
          const { NotFoundHttpError } = await import("@solid/community-server");
          throw new NotFoundHttpError();
        }
        return { data: guardedStreamFrom(FUSED_PROJECTION), metadata: meta("text/plain") };
      }

      // view descriptors.
      if (DESCRIPTORS[path]) {
        if (wantsQuads || wantsTurtle) {
          // serve as quads parsed from the turtle stub
          const { Parser } = await import("n3");
          const quads = new Parser().parse(DESCRIPTORS[path]);
          return { data: guardedStreamFrom(quads), metadata: meta("internal/quads") };
        }
        return { data: guardedStreamFrom(DESCRIPTORS[path]), metadata: meta("text/turtle") };
      }

      // the RDF record. Faithful to CSS: an empty-prefs read returns the stored
      // SERIALIZED turtle (bytes that readableToQuads can't parse); only an
      // internal/quads read yields the resource's own quad stream.
      if (path === RDF_RES) {
        if (wantsQuads) {
          const s = new Store(RDF_OWN_QUADS);
          return { data: guardedStreamFrom(s.getQuads(null, null, null, null)),
                   metadata: meta("internal/quads") };
        }
        const a = new ViewAssembler();
        const ttl = await a.serializeTurtle(RDF_OWN_QUADS);
        return { data: guardedStreamFrom(ttl), metadata: meta("text/turtle") };
      }

      // stored markdown body.
      if (path === RES) {
        if (opts.bodyMissing) {
          const { NotFoundHttpError } = await import("@solid/community-server");
          throw new NotFoundHttpError();
        }
        return { data: guardedStreamFrom(STORED_BODY), metadata: meta("text/markdown") };
      }

      throw new Error(`unexpected getRepresentation: ${path}`);
    },
  };
}

function makeResponse() {
  const headers: Record<string, string | string[]> = {};
  let body = "";
  let statusCode = 0;
  return {
    response: {
      writeHead(status: number, hdrs?: Record<string, string | string[]>) {
        statusCode = status;
        if (hdrs) for (const [k, v] of Object.entries(hdrs)) headers[k.toLowerCase()] = v;
        return this;
      },
      setHeader(k: string, v: string | string[]) { headers[k.toLowerCase()] = v; },
      end(chunk?: string) { if (chunk) body += chunk; },
      set statusCode(v: number) { statusCode = v; },
      get statusCode() { return statusCode; },
    } as any,
    get body() { return body; },
    get statusCode() { return statusCode; },
    headers,
  };
}

function build(opts: { bodyMissing?: boolean; projectionMissing?: boolean } = {}) {
  return new ViewHttpHandler(
    makeStore(opts) as any,
    new ViewAssembler(),
    BASE,
    VIEWS,
  );
}

function input(method: string, profile: string, res: ReturnType<typeof makeResponse>) {
  const q = profile === null ? "" : `?_profile=${profile}`;
  return {
    request: { method, url: `/vault/wiki/concepts/agent-memory.md${q}` } as any,
    response: res.response,
  };
}

describe("ViewHttpHandler.canHandle", () => {
  it("rejects a URL with no _profile", async () => {
    const h = build();
    const res = makeResponse();
    await expect(
      h.canHandle({
        request: { method: "GET", url: "/vault/wiki/concepts/agent-memory.md" } as any,
        response: res.response,
      } as any),
    ).rejects.toThrow();
  });

  it("accepts a URL carrying ?_profile=", async () => {
    const h = build();
    const res = makeResponse();
    await expect(h.canHandle(input("GET", "fused", res) as any)).resolves.toBeUndefined();
  });

  it("accepts an empty ?_profile= (token \"\")", async () => {
    const h = build();
    const res = makeResponse();
    await expect(
      h.canHandle({
        request: { method: "GET", url: "/vault/wiki/concepts/agent-memory.md?_profile=" } as any,
        response: res.response,
      } as any),
    ).resolves.toBeUndefined();
  });

  // SP2-T7: alt (selection-era catalog) is retired. The request falls through to
  // plain LDP — the resource itself is served, not a 400. GET/HEAD ONLY (F1).
  it("?_profile=alt is no longer claimed on GET (falls through to LDP as NotImplemented)", async () => {
    const h = build();
    const res = makeResponse();
    await expect(h.canHandle(input("GET", "alt", res) as any))
      .rejects.toThrow(NotImplementedHttpError);
  });

  // F1: a non-GET/HEAD with ANY ?_profile= token stays claimed — a fall-through
  // PUT lands the write on the underlying resource (CSS strips the query).
  it("PUT ?_profile=alt IS claimed (write guard — lens law)", async () => {
    const h = build();
    const res = makeResponse();
    await expect(h.canHandle(input("PUT", "alt", res) as any)).resolves.toBeUndefined();
  });

  it("PUT ?_profile=alt handled → 405 read-only", async () => {
    const h = build();
    const res = makeResponse();
    await h.handle(input("PUT", "alt", res) as any);
    expect(res.statusCode).toBe(405);
    expect(res.headers["allow"]).toBe("GET, HEAD, OPTIONS");
  });
});

describe("ViewHttpHandler.handle — fused", () => {
  it("serves body + fenced turtle containing a .meta triple", async () => {
    const h = build();
    const res = makeResponse();
    await h.handle(input("GET", "fused", res) as any);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("text/markdown");
    expect(res.body.startsWith(STORED_BODY.trimEnd())).toBe(true);
    expect(res.body).toContain("```turtle");
    expect(res.body).toContain("prefLabel");
    expect(String(res.headers["link"])).toContain("/views/fused");
  });

  // SP2-T7: a thrown NotFoundHttpError reaches HandlerServerConfigurator, which
  // writes a blanket 500 — the handler must write the 404 itself (memento idiom).
  it("?_profile=fused on a missing base resource yields 404, not 500", async () => {
    const h = build({ bodyMissing: true });
    const res = makeResponse();
    await expect(h.handle(input("GET", "fused", res) as any)).resolves.toBeUndefined();
    expect(res.statusCode).toBe(404);
  });

  // F2: a missing fused-projection ARTIFACT is a server-side gap, not a missing
  // page. Pre-fix, its NotFoundHttpError reached handle()'s catch and wrote
  // "404 No resource at <page>" — a false claim about an existing page. It must
  // surface as InternalServerError (the configurator writes the honest 500).
  it("missing view artifact on an EXISTING page is NOT a 404 naming the page", async () => {
    const h = build({ projectionMissing: true });
    const res = makeResponse();
    await expect(h.handle(input("GET", "fused", res) as any))
      .rejects.toThrow(/fused view artifact missing/);
    expect(res.statusCode).not.toBe(404);
  });

  // D114 T5: fused must be substrate-wide + content-type-agnostic. An RDF record
  // (text/turtle, e.g. /id/schemes/orcid) fuses as ONE merged turtle graph
  // (own triples ∪ .meta), text/turtle, NO markdown fence.
  it("RDF resource: merges own triples with .meta as one turtle graph (no fence)", async () => {
    const h = build();
    const res = makeResponse();
    await h.handle({
      request: { method: "GET", url: `/id/schemes/orcid?_profile=fused` } as any,
      response: res.response,
    } as any);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("text/turtle");
    // resource-own triple present
    expect(res.body).toContain("ORCID");
    // .meta open-action triple present
    expect(res.body).toContain("hasOpenAction");
    // ONE merged graph — no markdown fence
    expect(res.body).not.toContain("```turtle");
    expect(String(res.headers["link"])).toContain("/views/fused");
  });

  // SP2-T7: the .meta INTERNAL_QUADS read carries CSS's on-the-fly bookkeeping
  // (posix:mtime/size in the ResponseMetadata named graph) — filtered from the union.
  it("fused RDF output excludes the CSS ResponseMetadata named-graph quads", async () => {
    const h = build();
    const res = makeResponse();
    await h.handle({
      request: { method: "GET", url: `/id/schemes/orcid?_profile=fused` } as any,
      response: res.response,
    } as any);
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("hasOpenAction");
    expect(res.body).not.toContain("posix");
    expect(res.body).not.toContain("mtime");
  });

  // SP2-T7: fused turtle is prefixed (FOLLOWUPS: Comunica/N3 emitted full IRIs).
  it("fused RDF output is prefixed Turtle (skos prefix declared, used)", async () => {
    const h = build();
    const res = makeResponse();
    await h.handle({
      request: { method: "GET", url: `/id/schemes/orcid?_profile=fused` } as any,
      response: res.response,
    } as any);
    expect(res.body).toContain("@prefix skos:");
    expect(res.body).toContain("skos:prefLabel");
  });
});

describe("ViewAssembler.serializeTurtle — prefixes (SP2-T7)", () => {
  it("emits prefixed Turtle (skos/schema/dct/prov/sub prefixes declared)", async () => {
    const a = new ViewAssembler();
    const ttl = await a.serializeTurtle([
      quad(namedNode(`${RES}#this`),
           namedNode("http://www.w3.org/2004/02/skos/core#prefLabel"), literal("X")),
      quad(namedNode(`${RES}#this`),
           namedNode("https://schema.org/name"), literal("X")),
      quad(namedNode(RES), namedNode("http://purl.org/dc/terms/title"), literal("X")),
      quad(namedNode(RES), namedNode("http://www.w3.org/ns/prov#wasDerivedFrom"), namedNode(RES)),
      quad(namedNode(RES),
           namedNode("https://pod.vardeman.me/vault/ontology/substrate#realization"),
           literal("X")),
    ]);
    for (const p of ["@prefix skos:", "@prefix schema:", "@prefix dct:", "@prefix prov:", "@prefix sub:"]) {
      expect(ttl).toContain(p);
    }
    expect(ttl).toContain("skos:prefLabel");
    expect(ttl).toContain("sub:realization");
  });
});

describe("ViewHttpHandler.handle — errors", () => {
  it("unknown token → 400 listing valid tokens (alt no longer listed)", async () => {
    const h = build();
    const res = makeResponse();
    await h.handle(input("GET", "bogus", res) as any);
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain("fused");
    expect(res.body).not.toContain("alt");
  });

  it("empty token (?_profile=) → 400", async () => {
    const h = build();
    const res = makeResponse();
    await h.handle({
      request: { method: "GET", url: "/vault/wiki/concepts/agent-memory.md?_profile=" } as any,
      response: res.response,
    } as any);
    expect(res.statusCode).toBe(400);
  });

  it("?_profile=doc → 400 (removed token, hits default arm)", async () => {
    const h = build();
    const res = makeResponse();
    await h.handle(input("GET", "doc", res) as any);
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain("fused");
  });

  it("?_profile=graph → 400 (removed token, hits default arm)", async () => {
    const h = build();
    const res = makeResponse();
    await h.handle(input("GET", "graph", res) as any);
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain("fused");
  });

  it("PUT → 405 read-only, Allow header, body names the document view + stripped url", async () => {
    const h = build();
    const res = makeResponse();
    await h.handle(input("PUT", "fused", res) as any);
    expect(res.statusCode).toBe(405);
    expect(res.headers["allow"]).toBe("GET, HEAD, OPTIONS");
    expect(res.body).toContain("document view");
    expect(res.body).toContain(RES);
    expect(res.body).not.toContain("_profile");
  });
});
