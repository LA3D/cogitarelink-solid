import { describe, it, expect } from "vitest";
import { walkContainer } from "../src/walker";

// Layout shape for the fake DataAccessor.
// Containers have `contains` (list of child URLs); leaf resources have
// `contentType` + `body`.
type Layout = Record<
  string,
  { contentType: string; body?: string; contains?: string[] }
>;

/**
 * Build a fake DataAccessor matching CSS's interface. Mocks the three
 * methods the walker uses: getChildren, getMetadata, getData.
 */
function makeFakeDataAccessor(layout: Layout) {
  return {
    async *getChildren(id: { path: string }) {
      const node = layout[id.path];
      if (!node || !node.contains) return;
      for (const childUrl of node.contains) {
        yield { identifier: { value: childUrl } };
      }
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
        if (node.body !== undefined) {
          yield Buffer.from(node.body, "utf-8");
        }
      })();
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
  it("yields readable markdown descendants from leaf seed URLs", async () => {
    const layout: Layout = {
      "https://pod.vardeman.me/vault/wiki/a.md": { contentType: "text/markdown", body: "alpha" },
      "https://pod.vardeman.me/vault/wiki/b.md": { contentType: "text/markdown", body: "beta" },
    };
    const dataAccessor = makeFakeDataAccessor(layout);
    const perms = makePermissionReader(new Set([
      "https://pod.vardeman.me/vault/wiki/a.md",
      "https://pod.vardeman.me/vault/wiki/b.md",
    ]));
    const found: string[] = [];
    for await (const { url, body } of walkContainer(
      [
        "https://pod.vardeman.me/vault/wiki/a.md",
        "https://pod.vardeman.me/vault/wiki/b.md",
      ],
      dataAccessor as any,
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

  it("recurses into subcontainers via DataAccessor.getChildren", async () => {
    const layout: Layout = {
      "https://pod.vardeman.me/vault/wiki/pages/": {
        contentType: "text/turtle",
        contains: ["https://pod.vardeman.me/vault/wiki/pages/foo.md"],
      },
      "https://pod.vardeman.me/vault/wiki/pages/foo.md": { contentType: "text/markdown", body: "x" },
    };
    const dataAccessor = makeFakeDataAccessor(layout);
    const perms = makePermissionReader(new Set([
      "https://pod.vardeman.me/vault/wiki/pages/",
      "https://pod.vardeman.me/vault/wiki/pages/foo.md",
    ]));
    const found: string[] = [];
    for await (const r of walkContainer(
      ["https://pod.vardeman.me/vault/wiki/pages/"],
      dataAccessor as any,
      perms as any,
      { read: true } as any,
    )) {
      found.push(r.url);
    }
    expect(found).toEqual(["https://pod.vardeman.me/vault/wiki/pages/foo.md"]);
  });

  it("omits entire subtree when WAC denies subcontainer", async () => {
    const layout: Layout = {
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
    const dataAccessor = makeFakeDataAccessor(layout);
    const perms = makePermissionReader(new Set([
      "https://pod.vardeman.me/vault/wiki/public/",
      "https://pod.vardeman.me/vault/wiki/public/a.md",
      // private/ denied — descent never happens
    ]));
    const found: string[] = [];
    for await (const r of walkContainer(
      [
        "https://pod.vardeman.me/vault/wiki/public/",
        "https://pod.vardeman.me/vault/wiki/private/",
      ],
      dataAccessor as any,
      perms as any,
      { read: true } as any,
    )) {
      found.push(r.url);
    }
    expect(found).toEqual(["https://pod.vardeman.me/vault/wiki/public/a.md"]);
  });

  it("skips non-markdown resources", async () => {
    const layout: Layout = {
      "https://pod.vardeman.me/vault/wiki/style.css": { contentType: "text/css", body: "css" },
      "https://pod.vardeman.me/vault/wiki/note.md": { contentType: "text/markdown", body: "md" },
    };
    const dataAccessor = makeFakeDataAccessor(layout);
    const perms = makePermissionReader(new Set([
      "https://pod.vardeman.me/vault/wiki/style.css",
      "https://pod.vardeman.me/vault/wiki/note.md",
    ]));
    const found: string[] = [];
    for await (const r of walkContainer(
      [
        "https://pod.vardeman.me/vault/wiki/style.css",
        "https://pod.vardeman.me/vault/wiki/note.md",
      ],
      dataAccessor as any,
      perms as any,
      { read: true } as any,
    )) {
      found.push(r.url);
    }
    expect(found).toEqual(["https://pod.vardeman.me/vault/wiki/note.md"]);
  });
});
