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

function fetch(url: string, headers: Record<string, string>) {
  return undiciRequest(url, { headers, dispatcher: AGENT });
}

/**
 * Recursive BFS over an LDP container via HTTP. Yields { url, body } for
 * every descendant whose Content-Type is text/markdown AND is read-allowed
 * for the supplied credentials (checked via the CSS PermissionReader).
 *
 * Uses undici HTTP requests rather than ResourceStore.getRepresentation() to
 * avoid acquiring CSS resource locks inside the search request handler. The
 * WAC permission check is still done via PermissionReader so omit-don't-deny
 * semantics (subtree pruning on denied containers) are preserved.
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

    const allowed = await checkRead(permissionReader, identifier, credentials);
    if (!allowed) continue;

    if (currentUrl.endsWith("/")) {
      const children = await fetchContainerChildren(currentUrl);
      for (const child of children) queue.push(child);
    } else {
      const body = await fetchMarkdownBody(currentUrl);
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
async function fetchContainerChildren(url: string): Promise<string[]> {
  try {
    const { statusCode, headers, body } = await fetch(url, {
      accept: "text/turtle",
    });
    if (statusCode !== 200) { await body.dump(); return []; }
    const ct = ((headers["content-type"] as string | undefined) ?? "");
    if (!ct.startsWith("text/turtle")) { await body.dump(); return []; }
    const text = await body.text();
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
async function fetchMarkdownBody(url: string): Promise<string | null> {
  try {
    const { statusCode, headers, body } = await fetch(url, {
      accept: "text/markdown, */*;q=0.1",
    });
    if (statusCode !== 200) { await body.dump(); return null; }
    const ct = ((headers["content-type"] as string | undefined) ?? "")
      .split(";")[0].trim();
    if (!MARKDOWN_TYPES.has(ct)) { await body.dump(); return null; }
    return await body.text();
  } catch {
    return null;
  }
}
