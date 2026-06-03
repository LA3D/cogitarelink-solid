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
import { createHash } from "crypto";
import { Parser } from "n3";
import { NoOpPostProjectionHook } from "./NoOpPostProjectionHook";
import { MarkdownBodyProjector } from "./markdownBodyProjector";

// Re-export NoOpPostProjectionHook so Components.js can construct it via the
// `@type: "NoOpPostProjectionHook"` declaration in markdown-projection.json.
// Components.js requires the class to be reachable through the package's main
// entry point (dist-cjs/listener.js).
export { NoOpPostProjectionHook };

// Re-export MarkdownBodyProjector for the same reason — the AdmissionFloorStore
// (D108 Front-2) injects it via `@type: "MarkdownBodyProjector"`, and Components.js
// resolves requireElement through this package's main entry (dist-cjs/listener.js).
export { MarkdownBodyProjector };

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
// Backstop: stamp-based skip (D108 Front-2 §5.7)
// ------------------------------------------------------------------
// Default body-hash stamp predicate — must match the AdmissionFloorStore's
// stampPredicate (the in-band floor writes this predicate on success, so the
// listener can skip re-projection when the stamp is current). The deployment
// IRI is wired via config (the stampPredicate constructor param, like
// storagePath); this default keeps the unit tests green. The stampAgreement
// test asserts both config files == the floor's exported default.
export const DEFAULT_STAMP_PRED = "https://pod.vardeman.me/vault/ontology/substrate#bodyHash";

/**
 * Returns false (skip) when existingMetaTtl already contains a stamp on stampPred
 * that matches sha256(body). Returns true (re-project) in all other cases:
 * absent .meta, missing stamp, stale stamp, or parse error.
 */
export function shouldReproject(
    body: string,
    existingMetaTtl: string,
    stampPred: string = DEFAULT_STAMP_PRED,
): boolean {
    if (!existingMetaTtl) return true;
    const want = createHash("sha256").update(body).digest("hex");
    try {
        const quads = new Parser().parse(existingMetaTtl);
        const stamp = quads.find((q) => q.predicate.value === stampPred);
        return !stamp || stamp.object.value !== want;
    } catch {
        return true;
    }
}

// ------------------------------------------------------------------
// ESM pipeline loader
// ------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runtimeImport = new Function("specifier", "return import(specifier)") as (s: string) => Promise<any>;

interface ProjectionModule {
    projectionPipeline: { run(uri: string, body: string, typeIndex?: Record<string, string>, predicateToClass?: Record<string, string>, literalBinding?: Record<string, string>, storageBase?: string): Promise<import("n3").Quad[]> };
    resolveGovernedForWikiClass: (cls: string) => { page: string[]; thing: string[] };
    // Governed-predicate resolution keyed off the <#this> rdf:type (R-T2 / audit
    // R1.3). Returns undefined when the thing subject carries no rdf:type. The
    // MarkdownBodyProjector uses the SAME helper — one definition for both paths.
    resolveGovernedFromQuads: (quads: import("n3").Quad[], thingIri: string) => string[] | undefined;
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
    // Reuse the pipeline's YAML frontmatter splitter so dispatch's type
    // extraction can't disagree with projection on the same body (R-T2 / audit P3).
    splitFrontmatter: (body: string) => { fm: { type?: unknown; [k: string]: unknown }; rest: string };
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
// Frontmatter type extractor — R-T2 / audit P3.
// ------------------------------------------------------------------
// Was a private `^type:` regex over the raw frontmatter block, which DISAGREES
// with the pipeline's YAML.parse on the same body (a `type:` key nested under an
// earlier mapping, multi-line/quoted values, etc.). Now takes the YAML-parsed
// fm.type value from the pipeline's splitFrontmatter so dispatch and projection
// read the SAME field. Returns only absolute-IRI forms; short names (concept,
// person, …) fall through to projectionPipeline's resolveCURIE / TYPE_MAP path.
function frontmatterTypeIRI(fmType: unknown): string | undefined {
    if (typeof fmType !== "string") return undefined;
    const raw = fmType.trim();
    return raw.startsWith("http://") || raw.startsWith("https://") ? raw : undefined;
}

// The wiki-memory L3 layout segment (mirrors typeIndexLookup.WIKI_SEGMENT). The
// segment is the profile's own layout constant; the storage root comes from config.
const WIKI_SEGMENT = "wiki";

// A path is a candidate for a freshly-installed L4 container when it is OUTSIDE
// the wiki-memory layout (<storageBase>/wiki/…), since every wiki container is
// already in the default Type Index. L4 overlays register containers elsewhere
// under the storage root and need a Type-Index refresh-on-miss. Derived from the
// listener's injected storageBase, not a literal /wiki/ substring (R4 / D107).
function couldBeL4Container(url: string, storageBase: string): boolean {
    return !url.startsWith(`${storageBase}/${WIKI_SEGMENT}/`);
}

// ------------------------------------------------------------------
// Path resolution — hoisted to fsPaths.ts (R-T2 / FOLLOWUPS item 8) to break the
// listener ↔ markdownBodyProjector circular import. Re-exported here so existing
// `import { fsPathFromUrl } from "./listener"` callers keep working.
// ------------------------------------------------------------------

export { trimSlash, fsPathFromUrl } from "./fsPaths";
import { fsPathFromUrl } from "./fsPaths";

// ------------------------------------------------------------------
// MarkdownProjectionListener
// ------------------------------------------------------------------

export interface MarkdownProjectionListenerArgs {
    store: MonitoringStore;
    baseUrl: string;
    dataDir: string;
    storagePath?: string;
    stampPredicate?: string;
}

export class MarkdownProjectionListener extends Initializer {
    private readonly store: MonitoringStore;
    private readonly baseUrl: string;
    private readonly dataDir: string;
    // Pod storage root path under baseUrl, injected via Components.js
    // (markdown-projection.json), default "/vault". Was a hardcoded literal in
    // project() before RQ-Substrate-4 Phase 3 (FOLLOWUPS contamination item 1).
    private readonly storagePath: string;
    // Body-hash stamp predicate, injected via Components.js (default
    // DEFAULT_STAMP_PRED). Must equal the AdmissionFloorStore's stampPredicate so
    // the backstop's stamp-match skip recognises floor-written .meta.
    private readonly stampPredicate: string;
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
        storagePath = "/vault",
        stampPredicate: string = DEFAULT_STAMP_PRED,
    ) {
        super();
        this.store = store;
        this.baseUrl = baseUrl.replace(/\/$/, "");
        this.dataDir = dataDir;
        // Normalise: leading "/", no trailing "/" — baseUrl is already right-
        // trimmed, so storageBase = baseUrl + storagePath joins cleanly.
        const sp = storagePath.startsWith("/") ? storagePath : `/${storagePath}`;
        this.storagePath = sp.replace(/\/$/, "");
        this.stampPredicate = stampPredicate;
        this.postProjectionHook = postProjectionHook ?? new NoOpPostProjectionHook();
    }

    // Storage root URL = baseUrl + injected storagePath. The live Type Index
    // (<storageBase>/settings/publicTypeIndex) and routing.jsonld
    // (<storageBase>/meta/routing.jsonld) hang off this base. Exposed for tests
    // so the derived base is asserted from the injected storagePath, not a
    // hardcoded /vault literal (RQ-Substrate-4 Phase 3 / D107 §4.4).
    public get storageBase(): string {
        return `${this.baseUrl}${this.storagePath}`;
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

        // Backstop: skip if the in-band floor already wrote a current .meta (stamp matches body).
        const metaPath = `${fsPath}.meta`;
        let existingMeta = "";
        try { if (existsSync(metaPath)) existingMeta = readFileSync(metaPath, "utf8"); } catch { /* treat as absent */ }
        if (!shouldReproject(body, existingMeta, this.stampPredicate)) {
            debug(`backstop: stamp current for ${target.path}, skipping re-projection`);
            return;
        }

        // Load ESM projection pipeline lazily
        const { projectionPipeline, resolveGovernedFromQuads, detectClass, MetaWriter,
                resolveThingClass, TypeIndexLoader,
                BOOTSTRAP_PREDICATE_TO_CLASS, loadRoutingMap, splitFrontmatter } =
            await getPipeline();

        // Storage root = baseUrl + storagePath (injected via Components.js,
        // default "/vault" — no longer hardcoded; RQ-Substrate-4 Phase 3 / D107 §4.4).
        // Both TypeIndexLoader and loadRoutingMap require the storage-inclusive base —
        // the live Type Index is at <storageBase>/settings/publicTypeIndex, and
        // routing.jsonld is at <storageBase>/meta/routing.jsonld. Using this.baseUrl
        // (server root) would fetch /settings/publicTypeIndex → 404.
        const storageBase = this.storageBase;

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
        // container path). Reuse the pipeline's YAML splitter so dispatch reads
        // the SAME type field projection does (R-T2 / audit P3) — no private regex.
        const fmType = frontmatterTypeIRI(splitFrontmatter(body).fm.type);

        let typeIndex = await this.typeIndexLoader.getTypeIndex();
        let thingClass = resolveThingClass(
            new URL(target.path).pathname,
            typeIndex,
            fmType,
        );

        if (thingClass === undefined) {
            // Refresh-on-miss: the resource may belong to a freshly-installed L4
            // overlay whose Type Index entry isn't in the cache yet. Try once.
            if (fmType !== undefined || couldBeL4Container(target.path, storageBase)) {
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

        const triples = await projectionPipeline.run(target.path, body, typeIndex, this.routingMap ?? undefined, undefined, storageBase);

        if (!detectClass(triples)) {
            debug(`no rdf:type projected for ${target.path} — resource may lack type frontmatter`);
            return;
        }

        // Resolve per-subject governed predicates (D81 Model A + D98 two-subject)
        // by reading the <#this> rdf:type — NOT detectClass's FIRST rdf:type. After
        // the Bug-F filter the first rdf:type is the page's wiki:Page; routing the
        // governed set off THAT dropped the skos/cito axis for concepts (the
        // governed set fell back to COMMON_THING_PREDICATES). resolveGovernedFromQuads
        // keys off <#this> so a concept's skos:prefLabel/broader/… ARE governed
        // (R-T2 / audit R1.3). Same helper the MarkdownBodyProjector uses.
        const thisIri = `${target.path}#this`;
        const governed = resolveGovernedFromQuads(triples, thisIri);
        if (governed === undefined) {
            debug(`no <#this> rdf:type for ${target.path} — not substrate-governed`);
            return;
        }

        const writer = new MetaWriter();
        await writer.replaceGoverned(fsPath, triples, governed, target.path);
        debug(`wrote .meta for ${target.path} (${triples.length} triples, ${governed.length} governed predicates)`);

        // After .meta is written, surface <#this>-subject edges to the
        // post-projection hook (consumed by mem-trigger's ContradictionDetector).
        // No-op default when mem-trigger absent. Hook errors are swallowed —
        // substrate event archival must not block .meta writes. (thisIri computed
        // above for the governed-set resolution.)
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
