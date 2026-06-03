import { describe, it, expect } from "vitest";
import { IdentifierMap } from "@solid/community-server";
import { walkContainer } from "../src/walker";

// The REAL CSS v8 permission shape — the data-leak guard the walker's own
// comment says "a bug here is a data leak", with ZERO coverage before R-T4
// (audit H2). PermissionReader.handle() returns a MultiPermissionMap =
// IdentifierMap<PermissionMap> keyed by ResourceIdentifier (hashed on .path);
// PermissionMap = Record<string, boolean> keyed by the policy-engine
// permission IRI. The Read key is "urn:report:permissions:Read" (PERMISSIONS
// vocab in @solidlab/policy-engine). isReadAllowed() consumes exactly
// permission.get({ path }) → p["urn:report:permissions:Read"]. We build the
// REAL IdentifierMap here — do NOT mock isReadAllowed (the seam under test).
const PERMISSIONS_READ_IRI = "urn:report:permissions:Read";

// PermissionReader returning the genuine IdentifierMap<PermissionMap>. `allowed`
// is the set of read-allowed paths; everything else is explicitly denied
// (Read:false), and unknown paths resolve to an absent entry (get → undefined),
// which the omit-don't-deny branch also treats as denied.
function makeRealPermissionReader(allowed: Set<string>, known: Iterable<string>) {
  return {
    async handle({ requestedModes }: { requestedModes: Map<{ path: string }, Set<string>> }) {
      const map = new IdentifierMap<Record<string, boolean>>();
      // CSS passes the per-resource requestedModes; key the result map on the
      // SAME identifiers the reader was asked about, plus any pre-seeded known
      // paths, so the walker's permission.get({ path }) finds a real entry.
      const paths = new Set<string>(known);
      for (const id of requestedModes.keys()) paths.add(id.path);
      for (const path of paths) {
        map.set({ path }, { [PERMISSIONS_READ_IRI]: allowed.has(path) });
      }
      return map;
    },
  };
}

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

  // ─── REAL CSS-v8 permission shape (audit H2) ─────────────────────────────
  describe("with the REAL IdentifierMap<PermissionMap> permission shape", () => {
    it("yields an allowed markdown leaf", async () => {
      const layout: Layout = {
        "https://pod.vardeman.me/vault/wiki/a.md": { contentType: "text/markdown", body: "alpha" },
      };
      const dataAccessor = makeFakeDataAccessor(layout);
      const perms = makeRealPermissionReader(
        new Set(["https://pod.vardeman.me/vault/wiki/a.md"]),
        Object.keys(layout),
      );
      const found: string[] = [];
      for await (const { url } of walkContainer(
        ["https://pod.vardeman.me/vault/wiki/a.md"],
        dataAccessor as any,
        perms as any,
        { read: true } as any,
      )) {
        found.push(url);
      }
      expect(found).toEqual(["https://pod.vardeman.me/vault/wiki/a.md"]);
    });

    it("EXCLUDES a denied markdown leaf (urn:report:permissions:Read=false)", async () => {
      const layout: Layout = {
        "https://pod.vardeman.me/vault/wiki/public.md": { contentType: "text/markdown", body: "ok" },
        "https://pod.vardeman.me/vault/wiki/secret.md": { contentType: "text/markdown", body: "leak" },
      };
      const dataAccessor = makeFakeDataAccessor(layout);
      // Only public.md is Read-allowed; secret.md → Read:false.
      const perms = makeRealPermissionReader(
        new Set(["https://pod.vardeman.me/vault/wiki/public.md"]),
        Object.keys(layout),
      );
      const found: string[] = [];
      for await (const { url } of walkContainer(
        [
          "https://pod.vardeman.me/vault/wiki/public.md",
          "https://pod.vardeman.me/vault/wiki/secret.md",
        ],
        dataAccessor as any,
        perms as any,
        { read: true } as any,
      )) {
        found.push(url);
      }
      expect(found).toEqual(["https://pod.vardeman.me/vault/wiki/public.md"]);
      expect(found).not.toContain("https://pod.vardeman.me/vault/wiki/secret.md");
    });

    it("prunes a whole subtree when a subcontainer is denied (real shape)", async () => {
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
        "https://pod.vardeman.me/vault/wiki/private/secret.md": { contentType: "text/markdown", body: "leak" },
      };
      const dataAccessor = makeFakeDataAccessor(layout);
      // private/ container denied → its descendants are never enumerated.
      const perms = makeRealPermissionReader(
        new Set([
          "https://pod.vardeman.me/vault/wiki/public/",
          "https://pod.vardeman.me/vault/wiki/public/a.md",
        ]),
        Object.keys(layout),
      );
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
      expect(found).not.toContain("https://pod.vardeman.me/vault/wiki/private/secret.md");
    });
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
