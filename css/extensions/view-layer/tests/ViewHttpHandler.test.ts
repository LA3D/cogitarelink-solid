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

const FUSED_PROJECTION = "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }";

// View descriptor stubs — minimal turtle, each carries its token as a literal.
function descriptor(token: string): string {
  return `<${VIEWS}${token}> <http://www.w3.org/ns/dx/prof/hasToken> "${token}" .\n`;
}

const DESCRIPTORS: Record<string, string> = {
  [`${VIEWS}document`]: descriptor("doc"),
  [`${VIEWS}fused`]: descriptor("fused"),
  [`${VIEWS}graph`]: descriptor("graph"),
  [`${VIEWS}people`]: descriptor("people"),
};

// A fake ResourceStore whose getRepresentation services:
//  - the stored body (text/markdown preference) → STORED_BODY
//  - the .meta resource (INTERNAL_QUADS or text/turtle) → META_QUADS
//  - {viewsBase}fused-projection (text/markdown / string) → FUSED_PROJECTION
//  - the four {viewsBase}<view> descriptors (turtle/quads) → DESCRIPTORS
function makeStore(opts: { bodyMissing?: boolean } = {}) {
  return {
    async getRepresentation(id: { path: string }, prefs: any) {
      const path = id.path;
      const wantsQuads = !!(prefs?.type && prefs.type["internal/quads"]);
      const wantsTurtle = !!(prefs?.type && prefs.type["text/turtle"]);

      // .meta resource.
      if (path.endsWith(".meta")) {
        if (wantsQuads) {
          const s = new Store(META_QUADS);
          return { data: guardedStreamFrom(s.getQuads(null, null, null, null)) };
        }
        // turtle string
        const a = new ViewAssembler();
        const ttl = await a.serializeTurtle(META_QUADS);
        return { data: guardedStreamFrom(ttl) };
      }

      // fused-projection query text.
      if (path === `${VIEWS}fused-projection`) {
        return { data: guardedStreamFrom(FUSED_PROJECTION) };
      }

      // view descriptors.
      if (DESCRIPTORS[path]) {
        if (wantsQuads || wantsTurtle) {
          // serve as quads parsed from the turtle stub
          const { Parser } = await import("n3");
          const quads = new Parser().parse(DESCRIPTORS[path]);
          return { data: guardedStreamFrom(quads) };
        }
        return { data: guardedStreamFrom(DESCRIPTORS[path]) };
      }

      // stored body.
      if (path === RES) {
        if (opts.bodyMissing) {
          const { NotFoundHttpError } = await import("@solid/community-server");
          throw new NotFoundHttpError();
        }
        return { data: guardedStreamFrom(STORED_BODY) };
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
    await expect(h.canHandle(input("GET", "doc", res) as any)).resolves.toBeUndefined();
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

describe("ViewHttpHandler.handle — doc", () => {
  it("serves the stored body verbatim as text/markdown with a profile Link", async () => {
    const h = build();
    const res = makeResponse();
    await h.handle(input("GET", "doc", res) as any);
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(STORED_BODY);
    expect(res.headers["content-type"]).toBe("text/markdown");
    expect(String(res.headers["link"])).toContain('rel="profile"');
    expect(String(res.headers["link"])).toContain("/views/document");
  });

  it("HEAD doc: headers but no body", async () => {
    const h = build();
    const res = makeResponse();
    await h.handle(input("HEAD", "doc", res) as any);
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("");
    expect(res.headers["content-type"]).toBe("text/markdown");
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
});

describe("ViewHttpHandler.handle — graph", () => {
  it("serves the .meta as turtle containing a known triple", async () => {
    const h = build();
    const res = makeResponse();
    await h.handle(input("GET", "graph", res) as any);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("text/turtle");
    expect(res.body).toContain("prefLabel");
    expect(String(res.headers["link"])).toContain("/views/graph");
  });

  it("propagates 404 when the base resource is missing", async () => {
    const h = build({ bodyMissing: true });
    const res = makeResponse();
    await expect(h.handle(input("GET", "graph", res) as any)).rejects.toThrow();
  });
});

describe("ViewHttpHandler.handle — alt", () => {
  it("serves the 4-view catalog as turtle naming the tokens", async () => {
    const h = build();
    const res = makeResponse();
    await h.handle(input("GET", "alt", res) as any);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("text/turtle");
    expect(res.body).toContain("doc");
    expect(res.body).toContain("fused");
    expect(res.body).toContain("graph");
  });
});

describe("ViewHttpHandler.handle — errors", () => {
  it("unknown token → 400 listing valid tokens", async () => {
    const h = build();
    const res = makeResponse();
    await h.handle(input("GET", "bogus", res) as any);
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain("doc");
    expect(res.body).toContain("fused");
    expect(res.body).toContain("graph");
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

  it("PUT → 405 read-only, Allow header, body names the document view + stripped url", async () => {
    const h = build();
    const res = makeResponse();
    await h.handle(input("PUT", "doc", res) as any);
    expect(res.statusCode).toBe(405);
    expect(res.headers["allow"]).toBe("GET, HEAD, OPTIONS");
    expect(res.body).toContain("document view");
    expect(res.body).toContain(RES);
    expect(res.body).not.toContain("_profile");
  });
});
