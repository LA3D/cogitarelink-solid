import { describe, it, expect } from "vitest";
import { guardedStreamFrom } from "@solid/community-server";
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

function makeStore(opts: { bodyMissing?: boolean } = {}) {
  return {
    async getRepresentation(id: { path: string }, prefs: any) {
      const path = id.path;
      const wantsQuads = !!(prefs?.type && prefs.type["internal/quads"]);
      const wantsTurtle = !!(prefs?.type && prefs.type["text/turtle"]);

      // .meta resource — RDF record's .meta carries the open action.
      if (path === `${RDF_RES}.meta`) {
        const s = new Store(RDF_META_QUADS);
        if (wantsQuads) {
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

function build(opts: { bodyMissing?: boolean } = {}) {
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

  it("propagates 404 when the body is missing", async () => {
    const h = build({ bodyMissing: true });
    const res = makeResponse();
    await expect(h.handle(input("GET", "fused", res) as any)).rejects.toThrow();
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
});

describe("ViewHttpHandler.handle — alt", () => {
  it("serves the 2-view catalog as turtle naming fused and people tokens (not doc/graph)", async () => {
    const h = build();
    const res = makeResponse();
    await h.handle(input("GET", "alt", res) as any);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("text/turtle");
    expect(res.body).toContain("fused");
    expect(res.body).toContain("people");
    expect(res.body).not.toContain('"doc"');
    expect(res.body).not.toContain('"graph"');
  });
});

describe("ViewHttpHandler.handle — errors", () => {
  it("unknown token → 400 listing valid tokens", async () => {
    const h = build();
    const res = makeResponse();
    await h.handle(input("GET", "bogus", res) as any);
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain("fused");
    expect(res.body).toContain("alt");
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
    expect(res.body).toContain("alt");
  });

  it("?_profile=graph → 400 (removed token, hits default arm)", async () => {
    const h = build();
    const res = makeResponse();
    await h.handle(input("GET", "graph", res) as any);
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain("fused");
    expect(res.body).toContain("alt");
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
