import {
  HttpHandler,
  type HttpHandlerInput,
  NotImplementedHttpError,
  type ResourceStore,
  type PermissionReader,
  type CredentialsExtractor,
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
  private readonly store: ResourceStore;
  private readonly permissionReader: PermissionReader;
  private readonly credentialsExtractor: CredentialsExtractor;
  private readonly baseUrl: string;

  public constructor(
    engine: SearchEngine,
    store: ResourceStore,
    permissionReader: PermissionReader,
    credentialsExtractor: CredentialsExtractor,
    baseUrl: string,
  ) {
    super();
    this.engine = engine;
    this.store = store;
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

    // Walk + match + AND filter (single pass, retains body for snippet rendering).
    const perResource: PerResource[] = [];
    for await (const { url, body } of walkContainer(
      requestUrl.split("?")[0],
      this.store,
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
