import { describe, it, expect, vi } from "vitest";
import { IdentifierMap } from "@solid/community-server";
import { WikiSearchHttpHandler } from "../src/WikiSearchHttpHandler";
import { RegexpSearchEngine } from "../src/RegexpSearchEngine";

// The handler's canHandle is path-only — easy to test without injecting CSS.
// canHandle never touches the engine/store/permissionReader/credentialsExtractor;
// the empty placeholders are safe for these path-only unit tests. Full
// orchestration is exercised by the integration tests in Task 12.
describe("WikiSearchHttpHandler.canHandle", () => {
  const handler = new WikiSearchHttpHandler(
    {} as any,  // engine
    {} as any,  // dataAccessor
    {} as any,  // permissionReader
    {} as any,  // credentialsExtractor
    "https://pod.vardeman.me",
  );

  it("claims GET with ?ext=search-grep on a container URL", async () => {
    const input = {
      request: {
        method: "GET",
        url: "/vault/wiki/?ext=search-grep&oslc.searchTerms=%22x%22",
      } as any,
      response: {} as any,
    };
    await expect(handler.canHandle(input as any)).resolves.toBeUndefined();
  });

  it("rejects GET on resource URL (no trailing slash)", async () => {
    const input = {
      request: {
        method: "GET",
        url: "/vault/wiki/foo.md?ext=search-grep",
      } as any,
      response: {} as any,
    };
    await expect(handler.canHandle(input as any)).rejects.toThrow();
  });

  it("rejects POST", async () => {
    const input = {
      request: {
        method: "POST",
        url: "/vault/wiki/?ext=search-grep",
      } as any,
      response: {} as any,
    };
    await expect(handler.canHandle(input as any)).rejects.toThrow();
  });

  it("rejects when ?ext=search-grep is absent", async () => {
    const input = {
      request: { method: "GET", url: "/vault/wiki/" } as any,
      response: {} as any,
    };
    await expect(handler.canHandle(input as any)).rejects.toThrow();
  });

  it("rejects container outside /vault/wiki/ subtree", async () => {
    const input = {
      request: { method: "GET", url: "/vault/profile/?ext=search-grep" } as any,
      response: {} as any,
    };
    await expect(handler.canHandle(input as any)).rejects.toThrow();
  });
});

// ─── handle() orchestration with the REAL WAC gate (audit H2) ────────────────
// handle() was NEVER exercised before R-T4. This drives the full pipeline —
// seed enumeration → walkContainer → engine.search → Turtle response — through
// a fake DataAccessor + the genuine RegexpSearchEngine, with a real-shape
// PermissionReader that DENIES one leaf, and asserts the denied resource's URL
// is absent from the response body (the data-leak guard, end-to-end). The WAC
// seam (walker.isReadAllowed) is NOT mocked — it consumes the real
// IdentifierMap<PermissionMap> built here.
const BASE = "https://pod.vardeman.me";
const PERMISSIONS_READ_IRI = "urn:report:permissions:Read";

type Node = { contentType: string; body?: string; contains?: string[] };

function makeFakeDataAccessor(layout: Record<string, Node>) {
  return {
    async *getChildren(id: { path: string }) {
      const node = layout[id.path];
      if (!node?.contains) return;
      for (const childUrl of node.contains) yield { identifier: { value: childUrl } };
    },
    async getMetadata(id: { path: string }) {
      const node = layout[id.path];
      if (!node) throw new Error(`Not found: ${id.path}`);
      return { contentType: node.contentType };
    },
    async getData(id: { path: string }) {
      const node = layout[id.path];
      if (!node) throw new Error(`Not found: ${id.path}`);
      return (async function* () {
        if (node.body !== undefined) yield Buffer.from(node.body, "utf-8");
      })();
    },
  };
}

function makeRealPermissionReader(allowed: Set<string>) {
  return {
    async handle({ requestedModes }: { requestedModes: Map<{ path: string }, Set<string>> }) {
      const map = new IdentifierMap<Record<string, boolean>>();
      for (const id of requestedModes.keys()) {
        map.set({ path: id.path }, { [PERMISSIONS_READ_IRI]: allowed.has(id.path) });
      }
      return map;
    },
  };
}

function makeResponse() {
  const headers: Record<string, string | string[]> = {};
  let body = "";
  let statusCode = 0;
  return {
    response: {
      set statusCode(v: number) { statusCode = v; },
      get statusCode() { return statusCode; },
      setHeader(k: string, v: string | string[]) { headers[k.toLowerCase()] = v; },
      end(chunk?: string) { if (chunk) body += chunk; },
    } as any,
    get body() { return body; },
    get statusCode() { return statusCode; },
    headers,
  };
}

describe("WikiSearchHttpHandler.handle (real WAC gate)", () => {
  const container = `${BASE}/vault/wiki/pages/`;
  const publicUrl = `${BASE}/vault/wiki/pages/public.md`;
  const secretUrl = `${BASE}/vault/wiki/pages/secret.md`;

  function buildHandler(allowed: Set<string>) {
    const layout: Record<string, Node> = {
      [container]: { contentType: "text/turtle", contains: [publicUrl, secretUrl] },
      [publicUrl]: { contentType: "text/markdown", body: "the agent memory note" },
      [secretUrl]: { contentType: "text/markdown", body: "the agent secret note" },
    };
    return new WikiSearchHttpHandler(
      new RegexpSearchEngine(),
      makeFakeDataAccessor(layout) as any,
      makeRealPermissionReader(allowed) as any,
      { async handleSafe() { return {}; } } as any, // anonymous credentials
      BASE,
    );
  }

  function input(res: ReturnType<typeof makeResponse>) {
    return {
      request: {
        method: "GET",
        url: "/vault/wiki/pages/?ext=search-grep&oslc.searchTerms=%22agent%22",
      } as any,
      response: res.response,
    };
  }

  it("includes an allowed match and OMITS the WAC-denied resource", async () => {
    const handler = buildHandler(new Set([container, publicUrl])); // secret.md denied
    const res = makeResponse();
    await handler.handle(input(res) as any);

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("text/turtle");
    expect(res.body).toContain(publicUrl);
    expect(res.body).not.toContain(secretUrl);
    // Exactly one member survived the WAC filter.
    expect(res.body).toContain("oslc:totalCount 1");
  });

  it("includes both when WAC allows both", async () => {
    const handler = buildHandler(new Set([container, publicUrl, secretUrl]));
    const res = makeResponse();
    await handler.handle(input(res) as any);

    expect(res.body).toContain(publicUrl);
    expect(res.body).toContain(secretUrl);
    expect(res.body).toContain("oslc:totalCount 2");
  });
});
