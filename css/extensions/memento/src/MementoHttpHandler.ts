import { access } from "node:fs/promises";
import { join } from "node:path";
import { getLoggerFor } from "global-logger-factory";
import {
  HttpHandler,
  type HttpHandlerInput,
  NotImplementedHttpError,
} from "@solid/community-server";
import { decide, type MementoDecision } from "./router";
import { toMementoString, fromMementoString, toRFC7231 } from "./datetime";
import { gitLogBefore, gitShow, gitLogForPath, gitLatestOpForPath } from "./git";
import { serializeTimemap } from "./timemap";
import {
  withVersion,
  buildAbsoluteUrl,
  isUnderBaseUrl,
  fsPathFromUrl,
  getMementoStringFromUri,
  isTimemapRequest,
} from "./uri";

export class MementoHttpHandler extends HttpHandler {
  private readonly logger = getLoggerFor(this);
  private readonly gitDir: string;
  private readonly baseUrl: string;

  public constructor(gitDir: string, baseUrl: string) {
    super();
    this.gitDir = gitDir;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  public async canHandle(input: HttpHandlerInput): Promise<void> {
    const d = await this.decideFor(input);
    if (d.kind === "passthrough") {
      throw new NotImplementedHttpError("not a memento request");
    }
  }

  public async handle(input: HttpHandlerInput): Promise<void> {
    const d = await this.decideFor(input);
    switch (d.kind) {
      case "passthrough": throw new NotImplementedHttpError();
      case "timegate":   return this.handleTimegate(input, d.location, d.datetime);
      case "memento":    return this.handleMemento(input, d.version, d.path);
      case "timemap":    return this.handleTimemap(input, d.path);
      case "tombstone":  return this.handleTombstone(input, d.path);
    }
  }

  private async decideFor(input: HttpHandlerInput): Promise<MementoDecision> {
    const url = buildAbsoluteUrl(input.request.url, this.baseUrl);
    if (!isUnderBaseUrl(url, this.baseUrl)) return { kind: "passthrough" };
    const h = input.request.headers["accept-datetime"];
    const acceptDatetime = typeof h === "string" ? h : null;
    const method = input.request.method ?? "GET";

    // Cheap tombstone probe: only needed for plain GETs (no Memento signals)
    // on resource (non-container) URLs that are CURRENTLY absent from disk.
    // Worktree-first check avoids two failure modes:
    //   1) Container URLs (end with `/`) — child deletions would falsely flag the parent.
    //   2) Listener-lag races — a recreated file is on disk before the listener has
    //      committed; git history still shows the prior delete as the latest op.
    // If the file exists in the worktree, it cannot be tombstoned, period.
    let isTombstoned = false;
    const isContainerUrl = url.endsWith("/");
    const hasMementoSignal =
      getMementoStringFromUri(url) !== null || isTimemapRequest(url);
    if (
      method === "GET" && !isContainerUrl && !acceptDatetime &&
      !hasMementoSignal
    ) {
      try {
        const fsRel = fsPathFromUrl(url, this.baseUrl);
        if (fsRel) {
          const absent = await access(join(this.gitDir, fsRel)).then(() => false).catch(() => true);
          if (absent) {
            const op = await gitLatestOpForPath({ cwd: this.gitDir }, fsRel);
            isTombstoned = op === "delete";
          }
        }
      } catch {
        // If anything fails, don't claim — let LdpHandler take it.
        isTombstoned = false;
      }
    }
    return decide({ method, url, acceptDatetime, isTombstoned });
  }

  private fsPath(originalUrl: string): string {
    return fsPathFromUrl(originalUrl, this.baseUrl);
  }

  private linkHeader(originalUrl: string): string {
    const timemap = `${originalUrl}${originalUrl.includes("?") ? "&" : "?"}ext=timemap`;
    return [
      `<${originalUrl}>; rel="original timegate"`,
      `<${timemap}>; rel="timemap"`,
    ].join(", ");
  }

  private async handleTimegate(input: HttpHandlerInput, originalUrl: string, target: Date): Promise<void> {
    const path = this.fsPath(originalUrl);
    const record = await gitLogBefore({ cwd: this.gitDir }, target, path);
    const { response } = input;
    response.setHeader("Vary", "accept-datetime");
    response.setHeader("Link", this.linkHeader(originalUrl));
    if (!record) {
      response.statusCode = 404;
      response.end();
      return;
    }
    response.statusCode = 302;
    response.setHeader("Location", withVersion(originalUrl, toMementoString(record.datetime)));
    response.end();
  }

  private async handleMemento(input: HttpHandlerInput, version: string, originalUrl: string): Promise<void> {
    const path = this.fsPath(originalUrl);
    const target = fromMementoString(version);
    const record = await gitLogBefore({ cwd: this.gitDir }, target, path);
    const { response } = input;
    if (!record) {
      response.statusCode = 404;
      response.end();
      return;
    }
    response.setHeader("Memento-Datetime", toRFC7231(record.datetime));
    response.setHeader("Link", this.linkHeader(originalUrl));
    response.setHeader("Vary", "accept-datetime");
    // If the closest-prior commit is a deletion, the resource was gone at this datetime
    // (per RFC 7089: a Memento captures state at a time; tombstone state is "gone").
    if (record.op === "delete") {
      response.statusCode = 410;
      response.end();
      return;
    }
    const content = await gitShow({ cwd: this.gitDir }, record.hash, path);
    response.statusCode = 200;
    response.end(content);
  }

  private async handleTombstone(input: HttpHandlerInput, originalUrl: string): Promise<void> {
    const { response } = input;
    response.setHeader("Link", this.linkHeader(originalUrl));
    response.setHeader("Vary", "accept-datetime");
    response.statusCode = 410;
    response.end();
  }

  private async handleTimemap(input: HttpHandlerInput, originalUrl: string): Promise<void> {
    const path = this.fsPath(originalUrl);
    const records = await gitLogForPath({ cwd: this.gitDir }, path);
    const turtle = await serializeTimemap(
      originalUrl,
      records,
      (r) => withVersion(originalUrl, toMementoString(r.datetime)),
    );
    const { response } = input;
    response.setHeader("Content-Type", "text/turtle");
    response.setHeader("Link", this.linkHeader(originalUrl));
    response.statusCode = 200;
    response.end(turtle);
  }
}
