import { describe, it, expect } from "vitest";
import { walkContainer } from "../src/walker";
import type { WalkFetch } from "../src/walker";

// Layout shape for the fake HTTP fetch seam.
// Containers have `contains` (list of child URLs); leaf resources have `contentType` + `body`.
type Layout = Record<
  string,
  { contentType: string; body?: string; contains?: string[] }
>;

/**
 * Build a WalkFetch stub backed by a static layout map.
 * - Container URLs (ending "/") return a text/turtle body with ldp:contains triples.
 * - Leaf URLs return their contentType and body.
 * - Unknown URLs return 404.
 */
function makeFakeFetch(layout: Layout): WalkFetch {
  return async (url, _headers) => {
    const node = layout[url];
    if (!node) {
      return {
        status: 404,
        contentType: "text/plain",
        text: async () => "not found",
        dump: async () => {},
      };
    }
    if (node.contains !== undefined) {
      // Build a minimal Turtle container listing with ldp:contains triples.
      const contains = node.contains;
      const turtle = [
        `@prefix ldp: <http://www.w3.org/ns/ldp#> .`,
        `<${url}> a ldp:BasicContainer ;`,
        contains.map((c) => `  ldp:contains <${c}>`).join(" ;\n") + " .",
      ].join("\n");
      return {
        status: 200,
        contentType: "text/turtle",
        text: async () => turtle,
        dump: async () => {},
      };
    }
    return {
      status: 200,
      contentType: node.contentType,
      text: async () => node.body ?? "",
      dump: async () => {},
    };
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
    const layout: Layout = {
      "https://pod.vardeman.me/vault/wiki/": {
        contentType: "text/turtle",
        contains: [
          "https://pod.vardeman.me/vault/wiki/a.md",
          "https://pod.vardeman.me/vault/wiki/b.md",
        ],
      },
      "https://pod.vardeman.me/vault/wiki/a.md": { contentType: "text/markdown", body: "alpha" },
      "https://pod.vardeman.me/vault/wiki/b.md": { contentType: "text/markdown", body: "beta" },
    };
    const fakeFetch = makeFakeFetch(layout);
    const perms = makePermissionReader(new Set([
      "https://pod.vardeman.me/vault/wiki/",
      "https://pod.vardeman.me/vault/wiki/a.md",
      "https://pod.vardeman.me/vault/wiki/b.md",
    ]));
    const found: string[] = [];
    for await (const { url, body } of walkContainer(
      "https://pod.vardeman.me/vault/wiki/",
      {} as any,
      perms as any,
      { read: true } as any,
      { fetch: fakeFetch },
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
    const layout: Layout = {
      "https://pod.vardeman.me/vault/wiki/": {
        contentType: "text/turtle",
        contains: ["https://pod.vardeman.me/vault/wiki/pages/"],
      },
      "https://pod.vardeman.me/vault/wiki/pages/": {
        contentType: "text/turtle",
        contains: ["https://pod.vardeman.me/vault/wiki/pages/foo.md"],
      },
      "https://pod.vardeman.me/vault/wiki/pages/foo.md": { contentType: "text/markdown", body: "x" },
    };
    const fakeFetch = makeFakeFetch(layout);
    const perms = makePermissionReader(new Set([
      "https://pod.vardeman.me/vault/wiki/",
      "https://pod.vardeman.me/vault/wiki/pages/",
      "https://pod.vardeman.me/vault/wiki/pages/foo.md",
    ]));
    const found: string[] = [];
    for await (const r of walkContainer(
      "https://pod.vardeman.me/vault/wiki/",
      {} as any,
      perms as any,
      { read: true } as any,
      { fetch: fakeFetch },
    )) {
      found.push(r.url);
    }
    expect(found).toEqual(["https://pod.vardeman.me/vault/wiki/pages/foo.md"]);
  });

  it("omits entire subtree when WAC denies subcontainer", async () => {
    const layout: Layout = {
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
    };
    const fakeFetch = makeFakeFetch(layout);
    const perms = makePermissionReader(new Set([
      "https://pod.vardeman.me/vault/wiki/",
      "https://pod.vardeman.me/vault/wiki/public/",
      "https://pod.vardeman.me/vault/wiki/public/a.md",
      // private/ denied — descent never happens
    ]));
    const found: string[] = [];
    for await (const r of walkContainer(
      "https://pod.vardeman.me/vault/wiki/",
      {} as any,
      perms as any,
      { read: true } as any,
      { fetch: fakeFetch },
    )) {
      found.push(r.url);
    }
    expect(found).toEqual(["https://pod.vardeman.me/vault/wiki/public/a.md"]);
  });

  it("skips non-markdown resources", async () => {
    const layout: Layout = {
      "https://pod.vardeman.me/vault/wiki/": {
        contentType: "text/turtle",
        contains: [
          "https://pod.vardeman.me/vault/wiki/style.css",
          "https://pod.vardeman.me/vault/wiki/note.md",
        ],
      },
      "https://pod.vardeman.me/vault/wiki/style.css": { contentType: "text/css", body: "css" },
      "https://pod.vardeman.me/vault/wiki/note.md": { contentType: "text/markdown", body: "md" },
    };
    const fakeFetch = makeFakeFetch(layout);
    const perms = makePermissionReader(new Set([
      "https://pod.vardeman.me/vault/wiki/",
      "https://pod.vardeman.me/vault/wiki/style.css",
      "https://pod.vardeman.me/vault/wiki/note.md",
    ]));
    const found: string[] = [];
    for await (const r of walkContainer(
      "https://pod.vardeman.me/vault/wiki/",
      {} as any,
      perms as any,
      { read: true } as any,
      { fetch: fakeFetch },
    )) {
      found.push(r.url);
    }
    expect(found).toEqual(["https://pod.vardeman.me/vault/wiki/note.md"]);
  });
});
