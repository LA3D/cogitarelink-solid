/**
 * ViewHttpHandler — `?_profile=` conneg-by-profile routing (view-layer spec §4).
 *
 * Inserted BEFORE LdpHandler via Override (Task 11), so it owns every request
 * carrying `?_profile=`. It reads through the Monitoring-level store (wired in
 * Task 11) so its reads never see the Task-9 trailer.
 *
 * Per-resource view tokens (the contract table):
 *   fused → 200 body ⊕ fenced projection turtle (text/markdown)
 *   alt   → 200 the 2-view catalog (text/turtle, 60s cached)
 *   <other/empty> → 400 listing valid tokens
 * Removed: doc (redundant with default GET), graph (redundant with describedby .meta).
 * Non-GET/HEAD → 405 (lens law: views are read-only; sub:writable false).
 */
import {
  HttpHandler,
  type HttpHandlerInput,
  type ResourceStore,
  NotImplementedHttpError,
  INTERNAL_QUADS,
  readableToString,
  readableToQuads,
} from "@solid/community-server";
import { getLoggerFor } from "global-logger-factory";
import { Store } from "n3";

import { ViewAssembler } from "./ViewAssembler";
import { getProfileToken, stripProfileQuery } from "./uri";

// Per-resource view tokens this handler serves (people is /vault/views/-only,
// served by ViewSpaceHttpHandler — NOT a per-resource view → 400 here).
// doc removed: redundant with default GET. graph removed: redundant with describedby .meta.
const VALID_TOKENS = ["fused", "alt"] as const;
type ViewToken = (typeof VALID_TOKENS)[number];

const CACHE_TTL_MS = 60_000;

// The two view descriptor resources merged for the `alt` catalog.
const DESCRIPTOR_NAMES = ["fused", "people"] as const;

// Derive the .meta path for a resource URL (CSS auxiliary strategy: append
// ".meta"). Mirrors OperationsIndexListener.metaPath.
function metaPath(url: string): string {
  return `${url}.meta`;
}

export class ViewHttpHandler extends HttpHandler {
  private readonly logger = getLoggerFor(this);
  private readonly store: ResourceStore;
  private readonly assembler: ViewAssembler;
  private readonly baseUrl: string;
  private readonly viewsBase: string;

  private altCache?: { body: string; at: number };
  private projectionCache?: { query: string; at: number };

  public constructor(
    store: ResourceStore,
    assembler: ViewAssembler,
    baseUrl: string,
    viewsBase: string,
  ) {
    super();
    this.store = store;
    this.assembler = assembler;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.viewsBase = viewsBase.endsWith("/") ? viewsBase : `${viewsBase}/`;
  }

  private fullUrl(rawUrl: string): string {
    return rawUrl.startsWith("http") ? rawUrl : this.baseUrl + rawUrl;
  }

  public async canHandle(input: HttpHandlerInput): Promise<void> {
    const raw = input.request.url ?? "";
    // getProfileToken returns undefined when ?_profile= is absent, "" when empty.
    if (getProfileToken(this.fullUrl(raw)) === undefined) {
      throw new NotImplementedHttpError("no ?_profile= — not a view request");
    }
    if (!this.fullUrl(raw).startsWith(this.baseUrl)) {
      throw new NotImplementedHttpError("view request outside baseUrl");
    }
  }

  public async handle(input: HttpHandlerInput): Promise<void> {
    const { request, response } = input;
    const method = (request.method ?? "GET").toUpperCase();
    const url = this.fullUrl(request.url ?? "");
    const stripped = stripProfileQuery(url);
    const token = getProfileToken(url) ?? "";

    if (method !== "GET" && method !== "HEAD") {
      this.writeReadOnly(response, stripped);
      return;
    }

    if (!(VALID_TOKENS as readonly string[]).includes(token)) {
      this.writeBadToken(response, token);
      return;
    }

    const head = method === "HEAD";
    switch (token as ViewToken) {
      case "fused":
        return this.serveFused(response, stripped, head);
      case "alt":
        return this.serveAlt(response, head);
    }
  }

  // ─── fused ────────────────────────────────────────────────────────────────
  // Substrate-wide + content-type-agnostic (D114). The fused representation =
  // resource content ⊕ its authoritative governed graph (.meta), rendered per
  // content-type:
  //   markdown → body + fenced turtle of the projected governed graph
  //   RDF      → the record's own triples UNIONED with its .meta as ONE graph
  // Mirrors the CLI's client-side describedby-merge so every tier (curl floor
  // included) gets the same fused read over one HTTP affordance.
  private async serveFused(response: any, target: string, head: boolean): Promise<void> {
    // Read the base resource WITHOUT a restrictive type preference so RDF
    // records don't fail conversion (the markdown-only read threw
    // NotImplementedHttpError on text/turtle). A 404 here propagates by design.
    const rep = await this.store.getRepresentation({ path: target }, {});
    const ct = rep.metadata?.contentType ?? "";

    if (ct === "text/markdown") {
      const body = await readableToString(rep.data);
      const metaStore = await this.readMetaQuads(target);
      const query = await this.readProjectionQuery();
      const fused = await this.assembler.fuse(body, query, [metaStore]);
      this.write(response, 200, "text/markdown", "fused", head ? undefined : fused);
      return;
    }

    // RDF record: union the resource's own triples with its .meta graph and
    // serialize as one turtle graph (no fence).
    const own = await readableToQuads(rep.data);
    const metaStore = await this.readMetaQuads(target);
    const merged = [
      ...own.getQuads(null, null, null, null),
      ...metaStore.getQuads(null, null, null, null),
    ];
    const ttl = await this.assembler.serializeTurtle(merged);
    this.write(response, 200, "text/turtle", "fused", head ? undefined : ttl);
  }

  // ─── alt ──────────────────────────────────────────────────────────────────
  private async serveAlt(response: any, head: boolean): Promise<void> {
    const now = Date.now();
    if (!this.altCache || now - this.altCache.at > CACHE_TTL_MS) {
      const merged = new Store();
      for (const name of DESCRIPTOR_NAMES) {
        try {
          const s = await this.readMetaQuadsAt(`${this.viewsBase}${name}`);
          merged.addQuads(s.getQuads(null, null, null, null));
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          this.logger.warn(`alt: could not read descriptor ${name}: ${msg}`);
        }
      }
      const body = await this.assembler.serializeTurtle(
        merged.getQuads(null, null, null, null),
      );
      this.altCache = { body, at: now };
    }
    this.write(response, 200, "text/turtle", "alt", head ? undefined : this.altCache.body);
  }

  // ─── store reads ────────────────────────────────────────────────────────────
  // .meta quads for a resource (INTERNAL_QUADS preference).
  private async readMetaQuads(target: string): Promise<Store> {
    return this.readMetaQuadsAt(metaPath(target));
  }

  // Quads from an arbitrary resource path (INTERNAL_QUADS preference).
  // Tolerates a missing resource → empty store (used by alt).
  private async readMetaQuadsAt(path: string): Promise<Store> {
    try {
      const rep = await this.store.getRepresentation(
        { path },
        { type: { [INTERNAL_QUADS]: 1 } },
      );
      return readableToQuads(rep.data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.debug(`readMetaQuadsAt: ${path}: ${msg}`);
      return new Store();
    }
  }

  // The fused projection query text, cached 60s alongside the alt catalog.
  private async readProjectionQuery(): Promise<string> {
    const now = Date.now();
    if (!this.projectionCache || now - this.projectionCache.at > CACHE_TTL_MS) {
      const rep = await this.store.getRepresentation(
        { path: `${this.viewsBase}fused-projection` },
        { type: { "text/markdown": 1, "text/plain": 1, "application/sparql-query": 1 } },
      );
      const query = await readableToString(rep.data);
      this.projectionCache = { query, at: now };
    }
    return this.projectionCache.query;
  }

  // ─── response writers ───────────────────────────────────────────────────────
  private profileLink(view: string): string {
    return `<${this.viewsBase}${view}>; rel="profile"`;
  }

  private write(
    response: any,
    status: number,
    contentType: string,
    view: string,
    body?: string,
  ): void {
    response.writeHead(status, {
      "Content-Type": contentType,
      Link: this.profileLink(view),
    });
    response.end(body);
  }

  private writeBadToken(response: any, token: string): void {
    response.writeHead(400, { "Content-Type": "text/plain" });
    response.end(
      `Unknown view profile "${token}". Valid tokens: ${VALID_TOKENS.join(", ")}.`,
    );
  }

  private writeReadOnly(response: any, stripped: string): void {
    response.writeHead(405, {
      "Content-Type": "text/plain",
      Allow: "GET, HEAD, OPTIONS",
    });
    response.end(
      `This is a read-only view. Author via the document view: plain PUT/PATCH on <${stripped}>.`,
    );
  }
}
