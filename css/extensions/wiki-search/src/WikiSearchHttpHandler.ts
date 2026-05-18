import {
  HttpHandler,
  type HttpHandlerInput,
  NotImplementedHttpError,
  type PermissionReader,
  type CredentialsExtractor,
  type DataAccessor,
  type ResourceIdentifier,
} from "@solid/community-server";
import { getLoggerFor } from "global-logger-factory";

import type { SearchEngine, Match } from "./SearchEngine";
import { parseQuery, MalformedQueryError } from "./parseQuery";
import { walkContainer } from "./walker";
import { computeScore } from "./score";
import { snippet } from "./snippet";
import { buildTurtleResponse, type ScoredResult } from "./ResponseBuilder";
import { isInWikiSubtree } from "./uri";

interface PerResource {
  url: string;
  body: string;
  matches: Match[];
}

export class WikiSearchHttpHandler extends HttpHandler {
  private readonly logger = getLoggerFor(this);
  private readonly engine: SearchEngine;
  private readonly dataAccessor: DataAccessor;
  private readonly permissionReader: PermissionReader;
  private readonly credentialsExtractor: CredentialsExtractor;
  private readonly baseUrl: string;

  // DataAccessor is the only storage dependency: it sits below
  // LockingResourceStore in the CSS chain, so reads are lockless. The
  // walker uses it for both container enumeration (getChildren) and
  // document reads (getMetadata + getData). Going through ResourceStore
  // instead reliably deadlocks on the outer request's target lock and
  // crashes N3StreamWriter when the 6s expiry fires; even for descendants,
  // consuming store-returned streams from inside a handler triggers a
  // stream-lifecycle bug in CSS's readable-stream wrapping. See
  // docs/plans/2026-05-18-wiki-search-walker-redesign.md for the full
  // analysis. Security: the PermissionReader gate is the boundary; CSS v8
  // has no permission-aware store wrapper, so DataAccessor is
  // privileged-by-design exactly as store.getRepresentation would have been.
  public constructor(
    engine: SearchEngine,
    dataAccessor: DataAccessor,
    permissionReader: PermissionReader,
    credentialsExtractor: CredentialsExtractor,
    baseUrl: string,
  ) {
    super();
    this.engine = engine;
    this.dataAccessor = dataAccessor;
    this.permissionReader = permissionReader;
    this.credentialsExtractor = credentialsExtractor;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  public async canHandle(input: HttpHandlerInput): Promise<void> {
    const url = input.request.url ?? "";
    const method = input.request.method ?? "GET";
    if (method !== "GET") {
      throw new NotImplementedHttpError("not a search-grep GET");
    }
    if (!url.includes("?ext=search-grep") && !url.includes("&ext=search-grep")) {
      throw new NotImplementedHttpError("not search-grep");
    }
    const fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
    const pathOnly = fullUrl.split("?")[0];
    if (!pathOnly.endsWith("/")) {
      throw new NotImplementedHttpError("search-grep targets containers");
    }
    if (!isInWikiSubtree(fullUrl)) {
      throw new NotImplementedHttpError("search-grep is /vault/wiki/-scoped");
    }
  }

  public async handle(input: HttpHandlerInput): Promise<void> {
    const { request, response } = input;
    const requestUrl = (request.url ?? "").startsWith("http")
      ? (request.url ?? "")
      : this.baseUrl + (request.url ?? "");
    const queryString = "?" + (requestUrl.split("?")[1] ?? "");

    // Parse query (strict OSLC).
    let parsed;
    try {
      parsed = parseQuery(queryString);
    } catch (e) {
      if (e instanceof MalformedQueryError) {
        this.writeProblemJson(response, 400, e.detail, e.example);
        return;
      }
      throw e;
    }
    if (parsed.unsupported.length > 0) {
      this.writeProblemJson(
        response,
        501,
        `Unsupported parameters: ${parsed.unsupported.join(", ")}`,
        "Use only oslc.searchTerms, oslc.pageSize, oslc.startIndex in Phase 7a.",
      );
      return;
    }

    // Resolve requester credentials. Anonymous if none.
    const credentials = await this.credentialsExtractor.handleSafe(request as any);

    // Enumerate the search target's children via DataAccessor (lockless —
    // sits below LockingResourceStore). Authorization was already done at
    // the request level by AuthorizingHttpHandler; this read is safe.
    const targetPath = requestUrl.split("?")[0];
    const targetId: ResourceIdentifier = { path: targetPath };
    const seedUrls: string[] = [];
    try {
      for await (const childMeta of this.dataAccessor.getChildren(targetId)) {
        const childIri = childMeta.identifier?.value;
        if (typeof childIri === "string" && childIri.length > 0) {
          seedUrls.push(childIri);
        }
      }
    } catch (e: any) {
      this.logger.warn(`Failed to enumerate seed children for ${targetPath}: ${e?.message ?? e}`);
    }

    // Walk + match + AND filter (single pass, retains body for snippet rendering).
    const perResource: PerResource[] = [];
    for await (const { url, body } of walkContainer(
      seedUrls,
      this.dataAccessor,
      this.permissionReader,
      credentials,
    )) {
      const matches = this.engine.search(body, parsed.pattern);
      const distinct = new Set(matches.map((m) => m.term));
      if (distinct.size < parsed.pattern.terms.length) continue;
      perResource.push({ url, body, matches });
    }

    // Score using body length retained from the walk.
    const scored: ScoredResult[] = perResource.map((r) => {
      const first = r.matches[0];
      return {
        url: r.url,
        score: computeScore(r.matches.length, r.body.length),
        line: first?.line ?? 1,
        snippet: snippet(r.body, first?.offset ?? 0, first?.length ?? 0),
      };
    });

    // Sort globally then paginate (so score ordering is stable across pages).
    const totalCount = scored.length;
    const sorted = [...scored].sort((a, b) => b.score - a.score);
    const page = sorted.slice(parsed.startIndex, parsed.startIndex + parsed.pageSize);

    const ttl = buildTurtleResponse(
      requestUrl,
      page,
      totalCount,
      parsed.startIndex,
      parsed.pageSize,
      parsed.pattern.terms.join(", "),
    );

    response.statusCode = 200;
    response.setHeader("Content-Type", "text/turtle");
    response.setHeader(
      "Link",
      '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type", ' +
        '<http://open-services.net/ns/core#ResponseInfo>; rel="type"',
    );
    response.end(ttl);
  }

  private writeProblemJson(
    response: any,
    status: number,
    detail: string,
    example?: string,
  ): void {
    response.statusCode = status;
    response.setHeader("Content-Type", "application/problem+json");
    response.end(
      JSON.stringify({
        type: "https://pod.vardeman.me/vault/ontology/errors#malformed-search-terms",
        title: status === 400 ? "Malformed search request" : "Unsupported parameter",
        status,
        detail,
        ...(example ? { example } : {}),
      }),
    );
  }
}
