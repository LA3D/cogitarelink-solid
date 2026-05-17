import { describe, it, expect, vi } from "vitest";
import { walkContainer } from "../src/walker";

// Minimal fake ResourceStore + PermissionReader matching the shape walkContainer needs.
// Real implementations from CSS plug in at runtime via Components.js.

function makeFakeStore(layout: Record<string, { contentType: string; body?: string; contains?: string[] }>) {
  return {
    async getRepresentation(identifier: { path: string }): Promise<{
      metadata: { contentType: string };
      data: AsyncIterable<Buffer>;
    }> {
      const node = layout[identifier.path];
      if (!node) throw new Error(`not found: ${identifier.path}`);
      const body = node.contains
        ? node.contains.map((c) => `<${c}>`).join(" ldp:contains ") // crude
        : (node.body ?? "");
      const buf = Buffer.from(body);
      return {
        metadata: { contentType: node.contentType },
        data: (async function* () { yield buf; })(),
      };
    },
    // walker uses getChildren which we'll define on the store contract
    async getChildren(identifier: { path: string }): Promise<{ path: string }[]> {
      const node = layout[identifier.path];
      return (node?.contains ?? []).map((p) => ({ path: p }));
    },
  };
}

function makePermissionReader(allowed: Set<string>) {
  return {
    async handle({ resource }: { resource: { path: string } }): Promise<{ read: boolean }> {
      return { read: allowed.has(resource.path) };
    },
  };
}

describe("walkContainer", () => {
  it("yields all readable markdown descendants in a single-level container", async () => {
    const store = makeFakeStore({
      "https://pod.vardeman.me/vault/wiki/": {
        contentType: "text/turtle",
        contains: [
          "https://pod.vardeman.me/vault/wiki/a.md",
          "https://pod.vardeman.me/vault/wiki/b.md",
        ],
      },
      "https://pod.vardeman.me/vault/wiki/a.md": { contentType: "text/markdown", body: "alpha" },
      "https://pod.vardeman.me/vault/wiki/b.md": { contentType: "text/markdown", body: "beta" },
    });
    const perms = makePermissionReader(new Set([
      "https://pod.vardeman.me/vault/wiki/",
      "https://pod.vardeman.me/vault/wiki/a.md",
      "https://pod.vardeman.me/vault/wiki/b.md",
    ]));
    const found: string[] = [];
    for await (const { url, body } of walkContainer(
      "https://pod.vardeman.me/vault/wiki/",
      store as any,
      perms as any,
      { read: true } as any,
    )) {
      found.push(url);
      expect(typeof body).toBe("string");
    }
    expect(found.sort()).toEqual([
      "https://pod.vardeman.me/vault/wiki/a.md",
      "https://pod.vardeman.me/vault/wiki/b.md",
    ]);
  });

  it("recurses into subcontainers", async () => {
    const store = makeFakeStore({
      "https://pod.vardeman.me/vault/wiki/": {
        contentType: "text/turtle",
        contains: ["https://pod.vardeman.me/vault/wiki/pages/"],
      },
      "https://pod.vardeman.me/vault/wiki/pages/": {
        contentType: "text/turtle",
        contains: ["https://pod.vardeman.me/vault/wiki/pages/foo.md"],
      },
      "https://pod.vardeman.me/vault/wiki/pages/foo.md": { contentType: "text/markdown", body: "x" },
    });
    const perms = makePermissionReader(new Set([
      "https://pod.vardeman.me/vault/wiki/",
      "https://pod.vardeman.me/vault/wiki/pages/",
      "https://pod.vardeman.me/vault/wiki/pages/foo.md",
    ]));
    const found: string[] = [];
    for await (const r of walkContainer(
      "https://pod.vardeman.me/vault/wiki/",
      store as any,
      perms as any,
      { read: true } as any,
    )) {
      found.push(r.url);
    }
    expect(found).toEqual(["https://pod.vardeman.me/vault/wiki/pages/foo.md"]);
  });

  it("omits entire subtree when WAC denies subcontainer", async () => {
    const store = makeFakeStore({
      "https://pod.vardeman.me/vault/wiki/": {
        contentType: "text/turtle",
        contains: [
          "https://pod.vardeman.me/vault/wiki/public/",
          "https://pod.vardeman.me/vault/wiki/private/",
        ],
      },
      "https://pod.vardeman.me/vault/wiki/public/": {
        contentType: "text/turtle",
        contains: ["https://pod.vardeman.me/vault/wiki/public/a.md"],
      },
      "https://pod.vardeman.me/vault/wiki/private/": {
        contentType: "text/turtle",
        contains: ["https://pod.vardeman.me/vault/wiki/private/secret.md"],
      },
      "https://pod.vardeman.me/vault/wiki/public/a.md": { contentType: "text/markdown", body: "ok" },
      "https://pod.vardeman.me/vault/wiki/private/secret.md": { contentType: "text/markdown", body: "no" },
    });
    const perms = makePermissionReader(new Set([
      "https://pod.vardeman.me/vault/wiki/",
      "https://pod.vardeman.me/vault/wiki/public/",
      "https://pod.vardeman.me/vault/wiki/public/a.md",
      // private/ denied — descent never happens
    ]));
    const found: string[] = [];
    for await (const r of walkContainer(
      "https://pod.vardeman.me/vault/wiki/",
      store as any,
      perms as any,
      { read: true } as any,
    )) {
      found.push(r.url);
    }
    expect(found).toEqual(["https://pod.vardeman.me/vault/wiki/public/a.md"]);
  });

  it("skips non-markdown resources", async () => {
    const store = makeFakeStore({
      "https://pod.vardeman.me/vault/wiki/": {
        contentType: "text/turtle",
        contains: [
          "https://pod.vardeman.me/vault/wiki/style.css",
          "https://pod.vardeman.me/vault/wiki/note.md",
        ],
      },
      "https://pod.vardeman.me/vault/wiki/style.css": { contentType: "text/css", body: "css" },
      "https://pod.vardeman.me/vault/wiki/note.md": { contentType: "text/markdown", body: "md" },
    });
    const perms = makePermissionReader(new Set([
      "https://pod.vardeman.me/vault/wiki/",
      "https://pod.vardeman.me/vault/wiki/style.css",
      "https://pod.vardeman.me/vault/wiki/note.md",
    ]));
    const found: string[] = [];
    for await (const r of walkContainer(
      "https://pod.vardeman.me/vault/wiki/",
      store as any,
      perms as any,
      { read: true } as any,
    )) {
      found.push(r.url);
    }
    expect(found).toEqual(["https://pod.vardeman.me/vault/wiki/note.md"]);
  });
});
