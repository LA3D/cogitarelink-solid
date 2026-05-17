import { readFileSync } from "node:fs";
import { request as undiciRequest, Agent } from "undici";
import { Parser as N3Parser } from "n3";

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

/** Minimal fetch interface — injectable for tests; defaults to undici. */
export interface WalkFetch {
  (url: string, headers: Record<string, string>): Promise<{
    status: number;
    contentType: string;
    text(): Promise<string>;
    dump(): Promise<void>;
  }>;
}

const MARKDOWN_TYPES = new Set(["text/markdown", "text/x-markdown"]);
const LDP_CONTAINS = "http://www.w3.org/ns/ldp#contains";

// Build an undici Agent that trusts the mkcert root CA (or any CA in
// NODE_EXTRA_CA_CERTS) so self-signed dev certs work without disabling verification.
function buildAgent(): Agent | undefined {
  const caPath = process.env.NODE_EXTRA_CA_CERTS;
  if (!caPath) return undefined;
  try {
    const ca = readFileSync(caPath);
    return new Agent({ connect: { ca } });
  } catch {
    return undefined;
  }
}

const AGENT = buildAgent();

/** Default production fetch — undici with mkcert CA trust. */
const defaultFetch: WalkFetch = async (url, headers) => {
  const { statusCode, headers: respHeaders, body } = await undiciRequest(url, {
    headers,
    dispatcher: AGENT,
  });
  const ct = ((respHeaders["content-type"] as string | undefined) ?? "")
    .split(";")[0].trim();
  return {
    status: statusCode,
    contentType: ct,
    text: () => body.text(),
    dump: () => body.dump(),
  };
};

/**
 * Recursive BFS over an LDP container via HTTP. Yields { url, body } for
 * every descendant whose Content-Type is text/markdown AND is read-allowed
 * for the supplied credentials (checked via the CSS PermissionReader).
 *
 * Uses HTTP self-requests rather than ResourceStore.getRepresentation() to
 * avoid acquiring CSS resource locks inside the search request handler. The
 * WAC permission check is still done via PermissionReader so omit-don't-deny
 * semantics (subtree pruning on denied containers) are preserved.
 *
 * The optional `fetch` parameter is an injection seam for unit tests.
 * In production, omit it (or pass undefined) to use the default undici fetch.
 */
export async function* walkContainer(
  startUrl: string,
  store: ResourceStore,
  permissionReader: PermissionReader,
  credentials: Credentials,
  options?: { fetch?: WalkFetch },
): AsyncGenerator<WalkResult> {
  const fetchFn = options?.fetch ?? defaultFetch;
  const queue: string[] = [startUrl];

  while (queue.length > 0) {
    const currentUrl = queue.shift()!;
    const identifier: ResourceIdentifier = { path: currentUrl };

    const allowed = await checkRead(permissionReader, identifier, credentials);
    if (!allowed) continue;

    if (currentUrl.endsWith("/")) {
      const children = await fetchContainerChildren(currentUrl, fetchFn);
      for (const child of children) queue.push(child);
    } else {
      const body = await fetchMarkdownBody(currentUrl, fetchFn);
      if (body !== null) yield { url: currentUrl, body };
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

// CSS AllStaticReader + WAC readers return an IdentifierMap whose values
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
 * Fetch an LDP container via HTTP and parse ldp:contains members from the
 * Turtle body. Returns absolute IRIs for all contained children.
 */
async function fetchContainerChildren(url: string, fetchFn: WalkFetch): Promise<string[]> {
  try {
    const resp = await fetchFn(url, { accept: "text/turtle" });
    if (resp.status !== 200) { await resp.dump(); return []; }
    if (!resp.contentType.startsWith("text/turtle")) { await resp.dump(); return []; }
    const text = await resp.text();
    return parseLdpContains(text, url);
  } catch {
    return [];
  }
}

/**
 * Parse ldp:contains IRI values from a Turtle container listing.
 * Relative IRIs are resolved against the container URL (base).
 */
function parseLdpContains(turtle: string, baseUrl: string): string[] {
  const children: string[] = [];
  try {
    const parser = new N3Parser({ baseIRI: baseUrl });
    const quads = parser.parse(turtle);
    for (const quad of quads) {
      if (
        quad.predicate.value === LDP_CONTAINS &&
        quad.object.termType === "NamedNode"
      ) {
        children.push(quad.object.value);
      }
    }
  } catch { /* skip malformed containers */ }
  return children;
}

/**
 * Fetch a non-container resource via HTTP. Returns the body if the
 * Content-Type is text/markdown, null otherwise.
 */
async function fetchMarkdownBody(url: string, fetchFn: WalkFetch): Promise<string | null> {
  try {
    const resp = await fetchFn(url, { accept: "text/markdown, */*;q=0.1" });
    if (resp.status !== 200) { await resp.dump(); return null; }
    if (!MARKDOWN_TYPES.has(resp.contentType)) { await resp.dump(); return null; }
    return await resp.text();
  } catch {
    return null;
  }
}
