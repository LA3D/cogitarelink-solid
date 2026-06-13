// MarkdownBodyProjector — CJS wrapper implementing the BodyProjector interface
// for text/markdown resources (D108 Front-2 §5.2).
//
// Mirrors listener.ts's getPipeline() runtime-import pattern EXACTLY:
//   - Same eval-wrapped runtimeImport to avoid TS CJS→ESM transpilation of import()
//   - Same __dirname-relative ESM path resolution (this file compiles to dist-cjs/)
//   - Same lazy pipelineCache singleton
//   - Same TypeIndexLoader + loadRoutingMap call shapes (confirmed from listener.ts lines 275-283)
//
// TypeIndexLoader: new TypeIndexLoader(storageBase) → .getTypeIndex()
// loadRoutingMap:  loadRoutingMap(storageBase, fetch, BOOTSTRAP_PREDICATE_TO_CLASS)
//   (three-arg form — fetchFn is the global fetch, bootstrap is BOOTSTRAP_PREDICATE_TO_CLASS)
//
// Governed-predicate resolution: uses getThingGovernedPredicates(thingClass) and
// PAGE_GOVERNED_PREDICATES directly, because after the Bug-F filter the wiki: class
// is not present in the quad array when invariants are emitted — only the page
// (wiki:Page) and thing (skos:Concept / schema:Person …) rdf:type triples remain.
// resolveGovernedForWikiClass expects a wiki: class IRI, which is no longer in the
// projected quad set; direct resolution via the thing class is correct.

import type { Representation } from "@solid/community-server/dist/http/representation/Representation";
import type { ResourceIdentifier } from "@solid/community-server/dist/http/representation/ResourceIdentifier";
import { Parser } from "n3";
import type { Quad } from "n3";
import * as path from "path";
import { readFileSync } from "fs";
import { fsPathFromUrl } from "./fsPaths";
import { NoOpPostProjectionHook } from "./NoOpPostProjectionHook";
import { projectedStampQuads, VERSION_PRED } from "./stampPredicates";
import { signalDegraded as queueDegradedSignal, eventsContainerFor } from "./curationSignal";

// Pre-commit snapshot handed in by the admission floor (it is the only component that
// sees body/.meta before CSS's writeMetadataFile clobbers .meta — the D82 root cause).
// oldBody === null && oldMetaTtl === null is the first-write signature.
export interface ProjectionSnapshot {
    oldBody: string | null;
    oldMetaTtl: string | null;
}

// Hook contract — structurally compatible with mem-trigger's IPostProjectionHook.
// Inline type avoids cross-package import (same approach as listener.ts).
interface IPostProjectionHook {
    onEdgesWritten(input: {
        subject: string;
        edges: Array<{ predicate: string; object: string }>;
        timestamp: Date;
    }): Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debug(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.error("[markdown-body-projector]", ...args);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runtimeImport = new Function("specifier", "return import(specifier)") as (s: string) => Promise<any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipelineCache: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPipeline(): Promise<any> {
    if (pipelineCache === null) {
        // At runtime this file is at dist-cjs/markdownBodyProjector.js.
        // tsconfig.json rootDir=../.. puts ESM output under
        // dist/extensions/markdown-projection/src/index.js.
        // Path mirrors listener.ts getPipeline() exactly (same __dirname depth).
        const esmPath = path.resolve(
            __dirname,
            "..",
            "dist",
            "extensions",
            "markdown-projection",
            "src",
            "index.js",
        );
        pipelineCache = runtimeImport("file://" + esmPath);
    }
    return pipelineCache;
}

// fsPathFromUrl is imported from fsPaths.ts (same package) — hoisted there from
// listener.ts to break the listener↔projector circular import (R-T2). One
// definition for the URL→fs-path mapping.

// Version stamped into .meta as sub:projectorVersion. Source of truth = this package's
// version: __dirname is src-cjs (vitest) or dist-cjs (runtime), each one level under the
// extension root, so "../package.json" resolves in both. The hand-maintained ESM mirror
// PROJECTOR_VERSION (projectionPipeline.ts) is pinned equal by versionAgreement.test.ts.
export function pkgVersion(): string {
    try {
        return JSON.parse(readFileSync(path.resolve(__dirname, "..", "package.json"), "utf8")).version as string;
    } catch {
        return "0.0.0";
    }
}

/**
 * ONE pipeline-invocation expression shared by the floor projector (runPipelineFor)
 * and the listener backstop's two runs (f(body_new) + the Memento-recovered
 * f(body_old), PSP T5). The positional arg wiring of projectionPipeline.run is the
 * thing that silently drifts between callers — keep it in exactly one place (the
 * T3 one-invocation-path rule).
 */
export async function invokeProjection(
    pipelineModule: { projectionPipeline: { run(uri: string, body: string, typeIndex?: Record<string, string>, predicateToClass?: Record<string, string>, literalBinding?: Record<string, string>, storageBase?: string): Promise<Quad[]> } },
    resourcePath: string,
    body: string,
    typeIndex: Record<string, string> | undefined,
    routingMap: Record<string, string> | null,
    storageBase: string,
): Promise<Quad[]> {
    return pipelineModule.projectionPipeline.run(
        resourcePath,
        body,
        typeIndex,
        routingMap ?? undefined,
        undefined,
        storageBase,
    );
}

export class MarkdownBodyProjector {
    // Projector implementation version (BodyProjector contract): the floor stamps this
    // into .meta beside the body hash; materialize() compares the PRIOR .meta's stamp
    // against it to decide exact-vs-degraded subtraction (spec §6).
    public readonly version: string = pkgVersion();
    private readonly baseUrl: string;
    // Filesystem root the Pod stores resources under; used by materialize() to
    // resolve the on-disk path of a resource so MetaWriter can write its .meta.
    private readonly dataDir: string;
    // Pod storage root path under baseUrl, injected via Components.js (default "/vault").
    private readonly storagePath: string;
    // Post-projection hook — optional, wildcard range to accept any structurally-compatible
    // class from any extension (NoOpPostProjectionHook by default, MemTriggerPostProjectionHook
    // when mem-trigger overrides). Mirrors listener.ts's hook param EXACTLY.
    private readonly postProjectionHook: IPostProjectionHook;
    private routingMap: Record<string, string> | null = null;
    // Typed as any — TypeIndexLoader is loaded from ESM at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private typeIndexLoader: any = null;

    public constructor(
        baseUrl: string,
        dataDir: string,
        storagePath = "/vault",
        postProjectionHook?: IPostProjectionHook,
    ) {
        this.baseUrl = baseUrl.replace(/\/$/, "");
        this.dataDir = dataDir;
        // Normalise: leading "/", no trailing "/" — mirrors listener.ts constructor
        // (lines 176-177) so storageBase = baseUrl + storagePath joins cleanly.
        const sp = storagePath.startsWith("/") ? storagePath : `/${storagePath}`;
        this.storagePath = sp.replace(/\/$/, "");
        this.postProjectionHook = postProjectionHook ?? new NoOpPostProjectionHook();
    }

    // Storage root URL = baseUrl + storagePath. TypeIndexLoader and loadRoutingMap
    // both require this base (not the server root) to find publicTypeIndex and
    // meta/routing.jsonld. Mirrors listener.ts's storageBase getter exactly.
    private get storageBase(): string {
        return `${this.baseUrl}${this.storagePath}`;
    }

    public canProject(representation: Representation): boolean {
        return representation.metadata.contentType === "text/markdown";
    }

    // ONE pipeline-invocation path shared by project() and the old-body recompute in
    // materialize() — f(body_old) must run with the SAME typeIndex/routing/storageBase
    // wiring as f(body_new) or the subtraction drifts. (Type-Index drift between the two
    // writes is the accepted caveat from the spec.)
    private async runPipelineFor(identifier: ResourceIdentifier, body: string): Promise<Quad[]> {
        const mod = await getPipeline();
        const { TypeIndexLoader, BOOTSTRAP_PREDICATE_TO_CLASS, loadRoutingMap } = mod;

        const storageBase = this.storageBase;

        // Lazy-init TypeIndexLoader (mirrors listener.ts lines 275-277)
        if (this.typeIndexLoader === null) {
            this.typeIndexLoader = new TypeIndexLoader(storageBase);
        }

        // Lazy-load routing map (mirrors listener.ts lines 280-283).
        // Falls back to BOOTSTRAP_PREDICATE_TO_CLASS on any error (404 / pre-deploy / parse).
        if (this.routingMap === null) {
            this.routingMap = await loadRoutingMap(storageBase, fetch, BOOTSTRAP_PREDICATE_TO_CLASS);
        }

        const typeIndex = await this.typeIndexLoader.getTypeIndex();

        return await invokeProjection(mod, identifier.path, body, typeIndex, this.routingMap, storageBase);
    }

    public async project(
        identifier: ResourceIdentifier,
        body: string,
    ): Promise<{ quads: Quad[]; governed: string[] } | null> {
        const { resolveGovernedFromQuads } = await getPipeline();

        const quads: Quad[] = await this.runPipelineFor(identifier, body);

        // After Bug-F filtering, the wiki: class is removed from the page resource
        // triples when invariants are emitted. The thing class (skos:Concept,
        // schema:Person, …) is only on <#this>. Governed-predicate resolution
        // (read the <#this> rdf:type → getThingGovernedPredicates + PAGE_GOVERNED)
        // is single-sourced in resolveGovernedFromQuads (the listener calls the
        // SAME helper — R-T2 / audit R1.3). Returns undefined when <#this> has no
        // rdf:type → resource is not substrate-governed.
        const thingIri = identifier.path + "#this";
        const governed: string[] | undefined = resolveGovernedFromQuads(quads, thingIri);
        if (governed === undefined) return null;
        return { quads, governed };
    }

    // Pre-commit snapshot (BodyProjector contract) — the floor calls this BEFORE
    // super.setRepresentation commits (CSS's writeMetadataFile clobbers .meta during
    // commit, the D82 root cause). Reads BOTH files from the FS; absent → null.
    public async snapshot(
        identifier: ResourceIdentifier,
    ): Promise<ProjectionSnapshot> {
        const fsPath = fsPathFromUrl(identifier.path, this.baseUrl, this.dataDir);
        const read = (p: string): string | null => {
            try { return readFileSync(p, "utf8"); } catch { return null; }
        };
        return { oldBody: read(fsPath), oldMetaTtl: read(`${fsPath}.meta`) };
    }

    // Degraded-subtraction signal: a PRIOR .meta exists but exact recompute was
    // impossible (old body missing, or its projector-version stamp absent/mismatched —
    // every pre-migration resource starts there; the migration sweep re-baselines).
    // PSP T5: queues a mem:StalenessDetected/mem:Materialization event record on the
    // shared pending buffer (this projector runs IN-BAND inside the floor's
    // setRepresentation and holds no store, so it cannot write the event itself);
    // MarkdownProjectionListener drains the buffer into /wiki/.events/ on the
    // 'changed' event this very write emits. SHARED with the listener backstop path.
    public signalDegraded(identifier: ResourceIdentifier): void {
        debug(`degraded pairShadow subtraction for ${identifier.path}: prior .meta exists but exact recompute was impossible (missing old body or projector-version mismatch); residue possible until the curation sweep — curation signal queued`);
        queueDegradedSignal(identifier.path, eventsContainerFor(this.storageBase));
    }

    // Parse a snapshot .meta serialization. Base IRI = the .meta document URL, mirroring
    // MetaWriter's read cycle so relative subjects resolve identically.
    private parseSnapshotMeta(ttl: string, resourceUrl: string): Quad[] {
        try {
            return new Parser({ baseIRI: `${resourceUrl}.meta` }).parse(ttl);
        } catch {
            return [];
        }
    }

    // Write `quads` to the resource's .meta sidecar via provenance-scoped
    // replacement (spec 2026-06-12 §4 — agent triples survive by construction;
    // `governed` no longer drives the replacement, it stays the floor's validation
    // dispatch). The floor delegates here because MetaWriter is ESM-only (loaded
    // via the runtime pipeline import) and the floor must stay profile-agnostic.
    //
    // Exact path (spec §5 primary): the snapshot carries the pre-commit body + .meta
    // AND the .meta's projector-version stamp matches the running projector →
    // oldProjected = f(body_old) recomputed through the SAME pipeline path, plus the
    // prior stamp quads. Otherwise degraded pairShadow; if a prior .meta existed,
    // signalDegraded fires (first writes stay silent).
    //
    // After writing .meta, surfaces <#this>-subject edges to postProjectionHook
    // (consumed by mem-trigger's ContradictionDetector). Hook errors are swallowed —
    // substrate event archival must not block .meta writes. Mirrors listener.ts's
    // hook-call block exactly (same edge-extraction + try/catch-swallow pattern).
    public async materialize(
        identifier: ResourceIdentifier,
        quads: Quad[],
        governed: string[],
        snapshot: ProjectionSnapshot,
    ): Promise<void> {
        const { MetaWriter } = await getPipeline();
        const fsPath = fsPathFromUrl(identifier.path, this.baseUrl, this.dataDir);

        let oldProjected: Quad[] | null = null;
        if (snapshot.oldMetaTtl !== null) {
            const snapMeta = this.parseSnapshotMeta(snapshot.oldMetaTtl, identifier.path);
            const versionMatches = snapMeta.some((q) =>
                q.subject.value === identifier.path
                && q.predicate.value === VERSION_PRED
                && q.object.value === this.version);
            if (snapshot.oldBody !== null && versionMatches) {
                const oldQuads = await this.runPipelineFor(identifier, snapshot.oldBody);
                // Stamp quads in the PRIOR .meta are projection-owned: include them in
                // oldProjected so stale stamps are replaced, never accumulated.
                oldProjected = [...oldQuads, ...projectedStampQuads(snapMeta, identifier.path)];
            } else {
                // A prior .meta exists but exactness was impossible → flag for the lane.
                this.signalDegraded(identifier);
            }
        }
        // First write (no prior .meta): degraded branch over an absent/empty .meta is
        // trivially fine — no signal.

        await new MetaWriter().replaceProjected(fsPath, quads, oldProjected, {
            resourceUrl: identifier.path,
            snapshotTtl: snapshot.oldMetaTtl ?? undefined,
        });

        // Surface <#this>-subject edges to the post-projection hook.
        // thisIri matches the convention in listener.ts (resource path + "#this").
        const thisIri = `${identifier.path}#this`;
        const thingEdges = quads
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
