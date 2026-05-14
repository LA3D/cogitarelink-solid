import { getLoggerFor } from "global-logger-factory";
import {
  AS,
  Initializer,
  type MonitoringStore,
  type ResourceIdentifier,
  type RepresentationMetadata,
} from "@solid/community-server";
import { gitInit, gitCommit, gitCommitPath } from "./git";
import { formatCommitMessage, type ChangeOp } from "./commit-msg";
import { fsPathFromUrl, isUnderBaseUrl } from "./uri";

function activityToOp(activityIri: string): ChangeOp | null {
  if (activityIri === AS.Create) return "create";
  if (activityIri === AS.Update) return "update";
  if (activityIri === AS.Delete) return "delete";
  return null;
}

export class MementoCommitListener extends Initializer {
  private readonly logger = getLoggerFor(this);
  private readonly store: MonitoringStore;
  private readonly gitDir: string;
  private readonly baseUrl: string;
  private chain: Promise<void> = Promise.resolve();

  public constructor(store: MonitoringStore, gitDir: string, baseUrl: string) {
    super();
    this.store = store;
    this.gitDir = gitDir;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  public async handle(): Promise<void> {
    this.store.on("changed", (target, activity, metadata) => {
      const iri = (activity as unknown as { value?: string }).value ?? String(activity);
      this.onChange(target, iri, metadata);
    });
    this.chain = this.chain.then(async () => {
      await gitInit({ cwd: this.gitDir });
      const hash = await gitCommit({ cwd: this.gitDir }, "bootstrap: pod state at memento init");
      if (hash) this.logger.info(`Memento bootstrap commit ${hash.slice(0, 7)}`);
    });
    this.logger.info(`MementoCommitListener attached to ${this.gitDir}`);
  }

  private onChange(target: ResourceIdentifier, activityIri: string, _metadata: RepresentationMetadata): void {
    const op = activityToOp(activityIri);
    if (!op) return;
    if (!isUnderBaseUrl(target.path, this.baseUrl)) return;
    const fsPath = fsPathFromUrl(target.path, this.baseUrl);
    if (!fsPath || fsPath.startsWith(".git/")) return;
    const message = formatCommitMessage({ op, identifier: target.path });
    this.chain = this.chain
      .then(async () => {
        const hash = await gitCommitPath({ cwd: this.gitDir }, fsPath, message);
        if (hash) this.logger.debug(`Memento commit ${hash.slice(0, 7)} for ${op} ${target.path}`);
      })
      .catch((err) => { this.logger.warn(`Memento commit failed: ${err.message}`); });
  }
}
