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
import type { Quad } from "n3";
import * as path from "path";
import { fsPathFromUrl } from "./fsPaths";

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

export class MarkdownBodyProjector {
    private readonly baseUrl: string;
    // Filesystem root the Pod stores resources under; used by materialize() to
    // resolve the on-disk path of a resource so MetaWriter can write its .meta.
    private readonly dataDir: string;
    // Pod storage root path under baseUrl, injected via Components.js (default "/vault").
    private readonly storagePath: string;
    private routingMap: Record<string, string> | null = null;
    // Typed as any — TypeIndexLoader is loaded from ESM at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private typeIndexLoader: any = null;

    public constructor(
        baseUrl: string,
        dataDir: string,
        storagePath = "/vault",
    ) {
        this.baseUrl = baseUrl.replace(/\/$/, "");
        this.dataDir = dataDir;
        // Normalise: leading "/", no trailing "/" — mirrors listener.ts constructor
        // (lines 176-177) so storageBase = baseUrl + storagePath joins cleanly.
        const sp = storagePath.startsWith("/") ? storagePath : `/${storagePath}`;
        this.storagePath = sp.replace(/\/$/, "");
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

    public async project(
        identifier: ResourceIdentifier,
        body: string,
    ): Promise<{ quads: Quad[]; governed: string[] } | null> {
        const {
            projectionPipeline,
            TypeIndexLoader,
            BOOTSTRAP_PREDICATE_TO_CLASS,
            loadRoutingMap,
            resolveGovernedFromQuads,
        } = await getPipeline();

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

        const quads: Quad[] = await projectionPipeline.run(
            identifier.path,
            body,
            typeIndex,
            this.routingMap ?? undefined,
            undefined,
            storageBase,
        );

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

    // Write `quads` to the resource's .meta sidecar, replacing only `governed`
    // predicates (D81 Model A — agent-owned triples outside the governed set are
    // preserved). The floor delegates here because MetaWriter is ESM-only (loaded
    // via the runtime pipeline import) and the floor must stay profile-agnostic.
    public async materialize(
        identifier: ResourceIdentifier,
        quads: Quad[],
        governed: string[],
    ): Promise<void> {
        const { MetaWriter } = await getPipeline();
        const fsPath = fsPathFromUrl(identifier.path, this.baseUrl, this.dataDir);
        await new MetaWriter().replaceGoverned(fsPath, quads, governed, identifier.path);
    }
}
