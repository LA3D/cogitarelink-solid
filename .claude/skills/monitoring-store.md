# /monitoring-store

How to subscribe to resource-write events via CSS's `MonitoringStore` and build change-data-capture (CDC) handlers without forking CSS. This is D17's internal CDC; D56 will eventually expose it externally via Solid Notifications.

## When to invoke

You want to react to every write on the Pod — log it, mirror it, version it, validate it post-hoc, propagate to a search index, etc. — without modifying CSS itself.

## The event surface

`urn:solid-server:default:ResourceStore` is the `MonitoringStore` singleton (defined in `config/storage/middleware/stores/monitoring.json`). It extends `BaseActivityEmitter` from `@solid/community-server` and emits:

- `'changed'` — every resource change. Arguments: `(target: ResourceIdentifier, activity: VocabularyTerm<typeof AS>, metadata: RepresentationMetadata)`.
- Specific AS events: `'http://www.w3.org/ns/activitystreams#Create'`, `'Update'`, `'Delete'`, `'Add'`, `'Remove'`. Each fires with `(target, metadata)`.

`target.path` is the absolute URL of the affected resource. `activity.value` (or `String(activity)`) gives the AS IRI; map to a `"create" | "update" | "delete"` via:

```ts
import { AS } from "@solid/community-server";
function activityToOp(iri: string) {
  if (iri === AS.Create) return "create";
  if (iri === AS.Update) return "update";
  if (iri === AS.Delete) return "delete";
  return null;
}
```

## Subscribing — the Initializer pattern

Define a class that extends `Initializer` and subscribes in `handle()`. CSS calls `handle()` once at startup (via the init sequence):

```ts
import { Initializer, type MonitoringStore } from "@solid/community-server";

export class MyListener extends Initializer {
  public constructor(
    private readonly store: MonitoringStore,
    private readonly otherArg: string,
  ) { super(); }

  public async handle(): Promise<void> {
    this.store.on("changed", (target, activity, metadata) => {
      const iri = (activity as unknown as { value?: string }).value ?? String(activity);
      this.onChange(target, iri, metadata);
    });
  }

  private onChange(target, iri, metadata) {
    // your CDC logic
  }
}
```

Wire via Components.js (see `/components-override`) into `urn:solid-server:default:WorkerParallelInitializer`. The listener instance needs `urn:solid-server:default:ResourceStore` as its `store` constructor arg.

## Three patterns we use in `MementoCommitListener` (D65)

### 1. Attach BEFORE bootstrap, not after

If your `handle()` does any awaited work (like initializing storage or doing a bootstrap pass) before attaching the event handler, events fired during that window are lost:

```ts
// BAD — events during init() are dropped
public async handle(): Promise<void> {
  await this.init();                  // takes some ms
  this.store.on("changed", ...);
}
```

```ts
// GOOD — attach first, then enqueue init at the head of the same processing chain
public async handle(): Promise<void> {
  this.store.on("changed", (...args) => this.onChange(...args));
  this.chain = this.chain.then(() => this.init());
}
```

In practice CSS's `Initializer` chain runs before HTTP server starts, so the window is tiny — but seeded-account creation and similar startup-time writes go through the store. Don't lose them.

### 2. In-process serialization via a Promise chain

Multiple events can fire in rapid succession. Serialize the processing so each event's side-effects complete before the next runs:

```ts
private chain: Promise<void> = Promise.resolve();

private onChange(target, iri, metadata) {
  const op = activityToOp(iri);
  if (!op) return;
  this.chain = this.chain
    .then(async () => {
      await this.process(target, op, metadata);
    })
    .catch((err) => { this.logger.warn(`Failed: ${err.message}`); });
}
```

The `.catch` keeps the chain alive after errors — without it, one failed callback would freeze all subsequent processing.

### 3. Cross-process file lock for multi-worker safety (D68)

The per-instance `chain` only serializes WITHIN a single CSS worker. If you run multiple workers (CSS clustering), each gets its own MonitoringStore subscription and they race on shared resources. Take a filesystem lock around critical sections:

```ts
const LOCK_FILE = ".git/memento.lock";   // outside the worktree
const LOCK_STALE_MS = 30_000;

async function withLock<T>(cwd: string, fn: () => Promise<T>): Promise<T> {
  const lockPath = join(cwd, LOCK_FILE);
  for (;;) {
    try {
      const fh = await open(lockPath, "wx");   // O_CREAT | O_EXCL
      await fh.close();
      try { return await fn(); }
      finally { await unlink(lockPath).catch(() => {}); }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      const age = await stat(lockPath).then((s) => Date.now() - s.mtimeMs).catch(() => 0);
      if (age > LOCK_STALE_MS) { await unlink(lockPath).catch(() => {}); continue; }
      await new Promise((r) => setTimeout(r, 25));
    }
  }
}
```

Pattern source: `css/extensions/memento/src/git.ts:withLock`. Stale-lock recovery via mtime check handles crashed-worker scenarios. The lock file lives inside `.git/` (or another excluded location) so it doesn't get staged by `git add -A`.

## What the listener does NOT see

- **`describedby` auxiliary writes** flow through the same store but as separate events. A PUT on `/x` may produce one `'changed'` event for `/x` and another for `/x.meta`.
- **Server-internal updates** (cookie store, account store) may go through different stores. If your listener targets resource paths, filter on `target.path.startsWith(baseUrl)` or similar.
- **Failed writes** don't emit `'changed'`. The event only fires after the underlying store accepts the change.

## Filter on baseUrl

Always filter incoming events to URLs under your Pod's baseUrl:

```ts
import { isUnderBaseUrl } from "./uri";

private onChange(target, iri, metadata) {
  if (!isUnderBaseUrl(target.path, this.baseUrl)) return;
  // ...
}
```

CSS may emit changed events for resources outside the Pod (account internals, OIDC state) depending on configuration. Without the filter, your CDC pipeline processes them too.

## Performance notes

- Each event handler runs synchronously in the emit chain. Don't do heavy work in the listener callback — push it into your own queue (the `chain` pattern above).
- `RepresentationMetadata` is mutable. Don't hold references to it past the event handler return; clone what you need.

## Reference implementation

`css/extensions/memento/src/MementoCommitListener.ts` — full pattern with attach-before-bootstrap, in-process chain, baseUrl filtering, per-path commit semantics, and cross-worker file lock. The hardening pass (W2.1–W2.3) on Rung 1.1 + the worktree-first tombstone check on Rung 1.2 are documented in commits `f94228c` and `741e9b8`.

## Related decisions

- D17 — TRS / internal CDC architecture
- D65 — MonitoringStore over fswatch
- D66 — per-path staging
- D68 — filesystem lock pattern

## Related skills

- `/css-extension` — scaffolding the extension that hosts the listener
- `/components-override` — wiring the listener into `WorkerParallelInitializer`
- `/comunica-sources` — if you're consuming the resulting CDC data via SPARQL
