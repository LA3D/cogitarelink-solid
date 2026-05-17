import type {
  ResourceStore,
  PermissionReader,
  Credentials,
  ResourceIdentifier,
} from "@solid/community-server";

export interface WalkResult {
  url: string;
  body: string;
}

const MARKDOWN_TYPES = new Set(["text/markdown", "text/x-markdown"]);

async function readBody(data: AsyncIterable<Buffer>): Promise<string> {
  let out = "";
  for await (const chunk of data) {
    out += chunk.toString("utf-8");
  }
  return out;
}

/**
 * Recursive BFS over an LDP container. Yields { url, body } for every
 * descendant whose representation is text/markdown AND is read-allowed
 * for the supplied credentials. If WAC denies read on a subcontainer,
 * the entire subtree is omitted (no descent) — substrate-level omit-
 * don't-deny extending to structure.
 *
 * NOTE: CSS exposes container children via `ResourceStore.getRepresentation`
 * returning an LDP container with ldp:contains triples in its metadata.
 * The handler enumerates by re-parsing those triples; in this walker we
 * model the same shape as an async iterator for test isolation.
 *
 * Real implementations of CSS's ResourceStore return container listings
 * via the representation's metadata. The handler's wiring layer (Task 9)
 * extracts ldp:contains members from the metadata of a fetched container.
 */
export async function* walkContainer(
  startUrl: string,
  store: ResourceStore,
  permissionReader: PermissionReader,
  credentials: Credentials,
): AsyncGenerator<WalkResult> {
  const queue: string[] = [startUrl];

  while (queue.length > 0) {
    const currentUrl = queue.shift()!;
    const identifier: ResourceIdentifier = { path: currentUrl };

    // Check read permission on the current node (container or resource).
    // If denied, skip — and for containers, the omission prunes the subtree.
    // Mocks use { resource } shape; real CSS PermissionReader uses { credentials, requestedModes }.
    // We call with { resource } shape (as any) — isReadAllowed handles both return shapes.
    const permission = await (permissionReader as any).handle({
      resource: identifier,
      credentials,
      requestedModes: new Map([[identifier, new Set(["read"])]]),
    });
    const allowed = isReadAllowed(permission, currentUrl);
    if (!allowed) continue;

    const isContainer = currentUrl.endsWith("/");

    let rep: any;
    try {
      rep = await store.getRepresentation(identifier, {});
    } catch {
      continue;
    }

    if (isContainer) {
      // Enumerate ldp:contains members. CSS exposes them via rep.metadata.getAll(LDP_CONTAINS).
      // Fallback: some store implementations expose getChildren() directly (used in tests).
      let children = extractContainerChildren(rep);
      if (children.length === 0 && typeof (store as any).getChildren === "function") {
        const childIdentifiers: { path: string }[] = await (store as any).getChildren(identifier);
        children = childIdentifiers.map((ci) => ci.path);
      }
      for (const child of children) queue.push(child);
      // Drain the data stream to release the resource.
      for await (const _ of rep.data) { /* discard */ }
    } else {
      const ct = rep.metadata?.contentType ?? "";
      if (!MARKDOWN_TYPES.has(ct.split(";")[0].trim())) {
        for await (const _ of rep.data) { /* discard */ }
        continue;
      }
      const body = await readBody(rep.data);
      yield { url: currentUrl, body };
    }
  }
}

const LDP_CONTAINS = "http://www.w3.org/ns/ldp#contains";

function extractContainerChildren(rep: any): string[] {
  // CSS's container representations carry ldp:contains in their metadata.
  // metadata.getAll(namedNode(LDP_CONTAINS)) returns Term[]; .value is the IRI.
  try {
    if (typeof rep.metadata?.getAll === "function") {
      const terms = rep.metadata.getAll(LDP_CONTAINS);
      return terms.map((t: any) => t.value);
    }
  } catch { /* fall through */ }
  return [];
}

function isReadAllowed(permission: any, url: string): boolean {
  // CSS's PermissionReader returns a PermissionMap keyed by identifier.
  // Handle both the structured map and a simpler { read: true } shape used by mocks.
  if (permission?.read === true) return true;
  if (permission?.read === false) return false;
  try {
    if (typeof permission?.get === "function") {
      const p = permission.get({ path: url });
      return p?.read === true;
    }
  } catch { /* fall through */ }
  return false;
}
