// MarkdownProjectionListener — CJS wrapper for CSS Components.js (D58/D71/D72).
//
// CSS's Components.js v6 uses ConstructionStrategyCommonJs which calls Node's
// require() directly — the class file MUST be CommonJS-loadable. The projection
// pipeline (projectionPipeline, resolveGovernedForWikiClass, detectClass, MetaWriter)
// lives in the ESM dist/ tree; we load it lazily via a runtime dynamic import.
//
// Why eval-wrapped import():
//   With `module: CommonJS`, TypeScript transpiles literal `import()` into a
//   synchronous require() which fails on ESM-only modules. The eval wrapper
//   constructs the function at runtime so TypeScript never rewrites it.
//
// Pattern mirrors markdown-render/src-cjs/converter.ts.

import { Initializer } from "@solid/community-server/dist/init/Initializer";
import { AS } from "@solid/community-server/dist/util/Vocabularies";
import type { MonitoringStore } from "@solid/community-server/dist/storage/MonitoringStore";
import type { ResourceIdentifier } from "@solid/community-server/dist/http/representation/ResourceIdentifier";
import type { RepresentationMetadata } from "@solid/community-server/dist/http/representation/RepresentationMetadata";
import type { VocabularyTerm } from "rdf-vocabulary";
import * as path from "path";
import { readFileSync, existsSync } from "fs";
import { NoOpPostProjectionHook } from "./NoOpPostProjectionHook";

// Re-export NoOpPostProjectionHook so Components.js can construct it via the
// `@type: "NoOpPostProjectionHook"` declaration in markdown-projection.json.
// Components.js requires the class to be reachable through the package's main
// entry point (dist-cjs/listener.js).
export { NoOpPostProjectionHook };

// Hook contract — structurally compatible with mem-trigger's IPostProjectionHook.
// Inline type avoids cross-package import (mem-trigger's dist may not be present
// when markdown-projection compiles).
interface IPostProjectionHook {
    onEdgesWritten(input: {
        subject: string;
        edges: Array<{ predicate: string; object: string }>;
        timestamp: Date;
    }): Promise<void>;
}

// ------------------------------------------------------------------
// Simple stderr logger (same approach as markdown-render/converter.ts)
// ------------------------------------------------------------------
function debug(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.error("[markdown-projection]", ...args);
}

// ------------------------------------------------------------------
// ESM pipeline loader
// ------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runtimeImport = new Function("specifier", "return import(specifier)") as (s: string) => Promise<any>;

interface ProjectionModule {
    projectionPipeline: { run(uri: string, body: string, typeIndex?: Record<string, string>, predicateToClass?: Record<string, string>): Promise<import("n3").Quad[]> };
    resolveGovernedForWikiClass: (cls: string) => { page: string[]; thing: string[] };
    detectClass: (triples: import("n3").Quad[]) => string | undefined;
    MetaWriter: new() => { replaceGoverned(target: string, projected: import("n3").Quad[], governed: string[], resourceUrl?: string): Promise<void> };
    resolveThingClass: (path: string, typeIndex: Record<string, string>, frontmatterType: string | undefined) => string | undefined;
    TypeIndexLoader: new(podBase: string) => {
        getTypeIndex(): Promise<Record<string, string>>;
        refresh(): Promise<Record<string, string>>;
        invalidate(): void;
    };
    BOOTSTRAP_PREDICATE_TO_CLASS: Record<string, string>;
    loadRoutingMap: (podBase: string, fetchFn: typeof fetch, bootstrap: Record<string, string>) => Promise<Record<string, string>>;
}

let pipelineCache: Promise<ProjectionModule> | null = null;

function getPipeline(): Promise<ProjectionModule> {
    if (pipelineCache === null) {
        // At runtime this file is at dist-cjs/listener.js.
        // tsconfig.json rootDir=../.. puts ESM output under
        // dist/extensions/markdown-projection/src/index.js.
        const esmPath = path.resolve(
            __dirname,
            "..",
            "dist",
            "extensions",
            "markdown-projection",
            "src",
            "index.js",
        );
        const fileUrl = "file://" + esmPath;
        pipelineCache = runtimeImport(fileUrl);
    }
    return pipelineCache;
}

// ------------------------------------------------------------------
// Lightweight frontmatter type extractor (no YAML dep needed — just grep)
// ------------------------------------------------------------------

function extractFrontmatterType(body: string): string | undefined {
    if (!body.startsWith("---\n")) return undefined;
    const end = body.indexOf("\n---\n", 4);
    if (end < 0) return undefined;
    const fm = body.slice(4, end);
    const m = fm.match(/^type:\s*(.+)$/m);
    if (!m) return undefined;
    const raw = m[1].trim().replace(/^["']|["']$/g, "");
    // Return only absolute IRI forms; short names (concept, person, etc.) are
    // handled by projectionPipeline's resolveCURIE path.
    return raw.startsWith("http://") || raw.startsWith("https://") ? raw : undefined;
}

// A path is a candidate for a freshly-installed L4 container if it does NOT
// contain /wiki/ (which is always in DEFAULT_WIKI_TYPE_INDEX). This avoids
// refreshing the Type Index on every unknown /wiki/-adjacent path.
function couldBeL4Container(url: string): boolean {
    return !url.includes("/wiki/");
}

// ------------------------------------------------------------------
// Path resolution — mirrors MementoCommitListener's fsPathFromUrl
// ------------------------------------------------------------------

function trimSlash(s: string): string { return s.replace(/\/$/, ""); }

function fsPathFromUrl(url: string, baseUrl: string, dataDir: string): string {
    const base = trimSlash(baseUrl);
    if (!url.startsWith(base)) throw new Error(`URL outside pod base: ${url}`);
    // Strip query string (Memento uses ?version= / ?ext=timemap)
    const noQuery = url.split("?")[0];
    const relative = decodeURIComponent(noQuery.slice(base.length).replace(/^\//, ""));
    return path.join(dataDir, relative);
}

// ------------------------------------------------------------------
// MarkdownProjectionListener
// ------------------------------------------------------------------

export interface MarkdownProjectionListenerArgs {
    store: MonitoringStore;
    baseUrl: string;
    dataDir: string;
}

export class MarkdownProjectionListener extends Initializer {
    private readonly store: MonitoringStore;
    private readonly baseUrl: string;
    private readonly dataDir: string;
    private readonly postProjectionHook: IPostProjectionHook;
    // Serialise concurrent writes per the D68 chain pattern
    private chain: Promise<void> = Promise.resolve();
    // Live Type Index loader — instanced on first project() call once pipeline is loaded.
    // Typed as any because the class is loaded from the ESM module at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private typeIndexLoader: any = null;
    // Cached routing map (predicate IRI → class IRI) loaded from /meta/routing.jsonld.
    // Null until first project() call; falls back to BOOTSTRAP_PREDICATE_TO_CLASS on error.
    private routingMap: Record<string, string> | null = null;

    public constructor(
        store: MonitoringStore,
        baseUrl: string,
        dataDir: string,
        postProjectionHook?: IPostProjectionHook,
    ) {
        super();
        this.store = store;
        this.baseUrl = baseUrl.replace(/\/$/, "");
        this.dataDir = dataDir;
        this.postProjectionHook = postProjectionHook ?? new NoOpPostProjectionHook();
    }

    // Initializer.handle() — called once by CSS WorkerParallelInitializer
    public async handle(): Promise<void> {
        this.store.on(
            "changed",
            (
                target: ResourceIdentifier,
                activity: VocabularyTerm<typeof AS>,
                _metadata: RepresentationMetadata,
            ) => {
                const activityIri =
                    (activity as unknown as { value?: string }).value ?? String(activity);
                this.onChange(target, activityIri);
            },
        );
        debug(`attached to MonitoringStore (baseUrl=${this.baseUrl}, dataDir=${this.dataDir})`);
    }

    // ------------------------------------------------------------------

    private isProjectableResource(id: ResourceIdentifier): boolean {
        const p = id.path;
        // Must end with .md and not be a .meta sidecar or have a query string.
        // The /wiki/ prefix filter was removed in Bug G — class-based dispatch
        // via the live Type Index is now the "do I govern this?" oracle (D78).
        return p.endsWith(".md") && !p.includes("?");
    }

    private onChange(target: ResourceIdentifier, activityIri: string): void {
        if (!this.isProjectableResource(target)) return;
        // Delete events — CSS + Memento handle .meta cleanup, skip projection
        if (
            activityIri === String(AS.Delete) ||
            activityIri.endsWith("#Delete") ||
            activityIri.endsWith("/Delete")
        ) return;

        this.chain = this.chain
            .then(async () => { await this.project(target); })
            .catch((err: Error) => {
                debug(`projection failed for ${target.path}: ${err.message}`);
            });
    }

    private async project(target: ResourceIdentifier): Promise<void> {
        debug(`projecting ${target.path}`);

        // Resolve filesystem path — needed for MetaWriter
        let fsPath: string;
        try {
            fsPath = fsPathFromUrl(target.path, this.baseUrl, this.dataDir);
        } catch (err) {
            debug(`path resolution failed: ${(err as Error).message}`);
            return;
        }

        // Read body from filesystem (avoids re-entering the store's HTTP stack)
        if (!existsSync(fsPath)) {
            debug(`fsPath not found on disk, skipping: ${fsPath}`);
            return;
        }
        let body: string;
        try {
            body = readFileSync(fsPath, "utf8");
        } catch (err) {
            debug(`read failed: ${(err as Error).message}`);
            return;
        }

        // Load ESM projection pipeline lazily
        const { projectionPipeline, resolveGovernedForWikiClass, detectClass, MetaWriter,
                resolveThingClass, TypeIndexLoader,
                BOOTSTRAP_PREDICATE_TO_CLASS, loadRoutingMap } =
            await getPipeline();

        // Storage root is at /vault under the CSS server base.
        // Both TypeIndexLoader and loadRoutingMap require the /vault-inclusive base —
        // the live Type Index is at /vault/settings/publicTypeIndex, and routing.jsonld
        // is at /vault/meta/routing.jsonld. Using this.baseUrl (server root) would fetch
        // /settings/publicTypeIndex → 404 (the showstopper bug fixed here).
        const storageBase = `${this.baseUrl}/vault`;

        // Instance TypeIndexLoader on first use (after pipeline is loaded).
        // The loader caches the live Type Index; refresh-on-miss handles newly-
        // installed L4 overlays whose container registrations aren't cached yet.
        if (this.typeIndexLoader === null) {
            this.typeIndexLoader = new TypeIndexLoader(storageBase);
        }

        // Load routing map on first use alongside the Type Index (same lazy + cached
        // pattern). Uses fetch() — NOT store.getRepresentation — to avoid the re-entrant
        // write-lock crash (D92). Falls back to BOOTSTRAP_PREDICATE_TO_CLASS on any error.
        if (this.routingMap === null) {
            this.routingMap = await loadRoutingMap(storageBase, fetch, BOOTSTRAP_PREDICATE_TO_CLASS);
        }

        // URI-independent dispatch: resolve the Thing class via the live Type
        // Index (D78 class-based dispatch, Bug G fix). Skip resources whose path
        // doesn't map to any known class — substrate doesn't govern them.
        //
        // Parse frontmatter type for the resolver (frontmatter type wins over
        // container path). We do a lightweight YAML parse here rather than
        // re-running the full pipeline just to get the type field.
        const fmType = extractFrontmatterType(body);

        let typeIndex = await this.typeIndexLoader.getTypeIndex();
        let thingClass = resolveThingClass(
            new URL(target.path).pathname,
            typeIndex,
            fmType,
        );

        if (thingClass === undefined) {
            // Refresh-on-miss: the resource may belong to a freshly-installed L4
            // overlay whose Type Index entry isn't in the cache yet. Try once.
            if (fmType !== undefined || couldBeL4Container(target.path)) {
                typeIndex = await this.typeIndexLoader.refresh();
                thingClass = resolveThingClass(
                    new URL(target.path).pathname,
                    typeIndex,
                    fmType,
                );
            }
            if (thingClass === undefined) {
                debug(`no governed class for ${target.path} — not a substrate-governed path`);
                return;
            }
        }

        const triples = await projectionPipeline.run(target.path, body, typeIndex, this.routingMap ?? undefined);

        const cls = detectClass(triples);
        if (!cls) {
            debug(`no rdf:type projected for ${target.path} — resource may lack type frontmatter`);
            return;
        }

        // Resolve per-subject governed predicates (D81 Model A + D98 two-subject).
        // resolveGovernedForWikiClass falls back to COMMON_THING_PREDICATES for
        // unknown classes, so non-wiki: type IRIs are handled safely.
        const { page: pageGoverned, thing: thingGoverned } =
            resolveGovernedForWikiClass(cls);

        // Flatten page + thing for MetaWriter.replaceGoverned, which works
        // across all subjects uniformly (D81 Model A: governed set per resource).
        const governed = [...new Set([...pageGoverned, ...thingGoverned])];

        const writer = new MetaWriter();
        await writer.replaceGoverned(fsPath, triples, governed, target.path);
        debug(`wrote .meta for ${target.path} (class=${cls}, ${triples.length} triples, ${governed.length} governed predicates)`);

        // After .meta is written, surface <#this>-subject edges to the
        // post-projection hook (consumed by mem-trigger's ContradictionDetector).
        // No-op default when mem-trigger absent. Hook errors are swallowed —
        // substrate event archival must not block .meta writes.
        const thisIri = `${target.path}#this`;
        const thingEdges = triples
            .filter((q) => q.subject.value === thisIri)
            .map((q) => ({ predicate: q.predicate.value, object: q.object.value }));
        try {
            await this.postProjectionHook.onEdgesWritten({
                subject: thisIri,
                edges: thingEdges,
                timestamp: new Date(),
            });
        } catch (hookErr) {
            debug(`postProjectionHook error (substrate event archival failed; .meta still written): ${(hookErr as Error).message}`);
        }
    }
}
