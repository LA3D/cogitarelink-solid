import type {
  DataAccessor,
  PermissionReader,
  Credentials,
  ResourceIdentifier,
} from "@solid/community-server";

export interface WalkResult {
  url: string;
  body: string;
}

const MARKDOWN_TYPES = new Set(["text/markdown", "text/x-markdown"]);
const RDF_CONTENT_TYPE_PREDICATE = "urn:npm:solid:community-server:internal:contentType";

/**
 * Recursive BFS over an LDP container's descendants. Yields { url, body } for
 * every descendant whose Content-Type is text/markdown AND is read-allowed
 * for the supplied credentials.
 *
 * Architecture: everything goes through DataAccessor (the lowest layer,
 * below `LockingResourceStore` and below `RepresentationConvertingStore`).
 * Containers are enumerated via `getChildren()`; document content types
 * come from `getMetadata()`; document bodies come from `getData()`. No
 * `store.getRepresentation()` calls anywhere in the walker.
 *
 * Why not ResourceStore: integration testing showed that consuming any
 * store-returned stream from inside the handler reliably hits an
 * N3StreamWriter `callback is not a function` uncaught exception that
 * crashes the CSS process. This affects both containers (lazy Turtle
 * body serialization) and documents (the readable-stream lifecycle
 * wrapping that CSS layers on top of the raw file stream). DataAccessor
 * returns a simple Readable directly from the file system, bypassing
 * the layered stream wrapping that triggers the bug.
 *
 * Security model: identical to what was originally planned for Path 1a.
 * The `PermissionReader` gate is the only thing protecting unauthorized
 * callers — CSS v8 has no permission-aware store wrapper, so
 * `dataAccessor.*` and `store.getRepresentation` are both
 * privileged-by-design at the data layer. Using DataAccessor here makes
 * the privileged-deputy pattern explicit rather than implicit.
 *
 * See docs/plans/2026-05-18-wiki-search-walker-redesign.md.
 */
export async function* walkContainer(
  seedUrls: string[],
  dataAccessor: DataAccessor,
  permissionReader: PermissionReader,
  credentials: Credentials,
): AsyncGenerator<WalkResult> {
  const queue: string[] = [...seedUrls];

  while (queue.length > 0) {
    const currentUrl = queue.shift()!;
    const identifier: ResourceIdentifier = { path: currentUrl };

    // ─── SECURITY BOUNDARY ─────────────────────────────────────────────
    // This PermissionReader check is the ONLY thing protecting unauthorized
    // callers from reading resources the requester isn't entitled to.
    // CSS v8 has no permission-aware store wrapper; DataAccessor is
    // privileged-by-design (it's the file-system layer). A bug here is a
    // data leak. Do not remove this check on the grounds that "we'll add
    // store-layer auth later" — that infrastructure does not exist.
    //
    // Omit-don't-deny: a denied descendant is silently skipped. For
    // containers, this prunes the entire subtree.
    // ─────────────────────────────────────────────────────────────────
    const allowed = await checkRead(permissionReader, identifier, credentials);
    if (!allowed) continue;

    if (currentUrl.endsWith("/")) {
      // Container: enumerate children, no stream involved.
      try {
        for await (const childMeta of dataAccessor.getChildren(identifier)) {
          const childIri = (childMeta as any).identifier?.value;
          if (typeof childIri === "string" && childIri.length > 0) {
            queue.push(childIri);
          }
        }
      } catch {
        // Container missing or read failed; skip subtree.
      }
    } else {
      // Document: check content type via metadata, then read body via getData.
      let ct = "";
      try {
        const meta: any = await dataAccessor.getMetadata(identifier);
        ct = extractContentType(meta);
      } catch {
        continue;
      }
      if (!MARKDOWN_TYPES.has(ct)) continue;
      try {
        const stream = await dataAccessor.getData(identifier);
        const body = await readBody(stream);
        yield { url: currentUrl, body };
      } catch {
        continue;
      }
    }
  }
}

async function checkRead(
  permissionReader: PermissionReader,
  identifier: ResourceIdentifier,
  credentials: Credentials,
): Promise<boolean> {
  try {
    const permission = await (permissionReader as any).handle({
      resource: identifier,
      credentials,
      requestedModes: new Map([[identifier, new Set(["read"])]]),
    });
    return isReadAllowed(permission, identifier.path);
  } catch {
    return false;
  }
}

// CSS v8 AllStaticReader + WAC readers return an IdentifierMap whose values
// are keyed by the PERMISSIONS IRI from @solidlab/policy-engine.
const PERMISSIONS_READ_IRI = "urn:report:permissions:Read";

function isReadAllowed(permission: any, url: string): boolean {
  // Mock shape (unit tests): { read: true }
  if (permission?.read === true) return true;
  if (permission?.read === false) return false;
  try {
    if (typeof permission?.get === "function") {
      const p = permission.get({ path: url });
      // CSS v8 AllStaticReader + WAC: { "urn:report:permissions:Read": true, ... }
      if (p?.[PERMISSIONS_READ_IRI] === true) return true;
      if (p?.[PERMISSIONS_READ_IRI] === false) return false;
      if (p?.read === true) return true;
    }
  } catch { /* fall through */ }
  return false;
}

/**
 * Extract contentType from a RepresentationMetadata. The metadata object
 * has a `contentType` accessor in CSS, but in tests we also accept the
 * raw predicate-keyed shape.
 */
function extractContentType(meta: any): string {
  if (typeof meta?.contentType === "string") {
    return meta.contentType.split(";")[0].trim();
  }
  try {
    if (typeof meta?.get === "function") {
      const term = meta.get(RDF_CONTENT_TYPE_PREDICATE);
      if (term?.value) return String(term.value).split(";")[0].trim();
    }
  } catch { /* fall through */ }
  return "";
}

async function readBody(data: AsyncIterable<any>): Promise<string> {
  let out = "";
  for await (const chunk of data) {
    out += typeof chunk === "string" ? chunk : Buffer.isBuffer(chunk)
      ? chunk.toString("utf-8")
      : String(chunk);
  }
  return out;
}
