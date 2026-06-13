"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarkdownProjectionListener = exports.fsPathFromUrl = exports.trimSlash = exports.DEFAULT_STAMP_PRED = exports.MarkdownBodyProjector = exports.NoOpPostProjectionHook = void 0;
exports.shouldReproject = shouldReproject;
const Initializer_1 = require("@solid/community-server/dist/init/Initializer");
const Vocabularies_1 = require("@solid/community-server/dist/util/Vocabularies");
const path = __importStar(require("path"));
const fs_1 = require("fs");
const crypto_1 = require("crypto");
const crypto_2 = require("crypto");
const n3_1 = require("n3");
const BasicRepresentation_1 = require("@solid/community-server/dist/http/representation/BasicRepresentation");
const NoOpPostProjectionHook_1 = require("./NoOpPostProjectionHook");
Object.defineProperty(exports, "NoOpPostProjectionHook", { enumerable: true, get: function () { return NoOpPostProjectionHook_1.NoOpPostProjectionHook; } });
const markdownBodyProjector_1 = require("./markdownBodyProjector");
Object.defineProperty(exports, "MarkdownBodyProjector", { enumerable: true, get: function () { return markdownBodyProjector_1.MarkdownBodyProjector; } });
const gitRead_1 = require("./gitRead");
const stampPredicates_1 = require("./stampPredicates");
const curationSignal_1 = require("./curationSignal");
// ------------------------------------------------------------------
// Simple stderr logger (same approach as markdown-render/converter.ts)
// ------------------------------------------------------------------
function debug(...args) {
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
//
// Single-sourced from stampPredicates.STAMP_PRED (the same CJS mirror the floor's
// exact-subtraction path reads) instead of re-declaring the literal — its three
// siblings (shape-validator StampPredicate, src-cjs/stampPredicates, src/maps) are
// drift-pinned, and this re-export keeps the public DEFAULT_STAMP_PRED name the
// constructor default + tests use.
exports.DEFAULT_STAMP_PRED = stampPredicates_1.STAMP_PRED;
/**
 * Returns false (skip) when existingMetaTtl already contains a stamp on stampPred
 * that matches sha256(body). Returns true (re-project) in all other cases:
 * absent .meta, missing stamp, stale stamp, or parse error.
 */
function shouldReproject(body, existingMetaTtl, stampPred = exports.DEFAULT_STAMP_PRED) {
    if (!existingMetaTtl)
        return true;
    const want = (0, crypto_1.createHash)("sha256").update(body).digest("hex");
    try {
        const quads = new n3_1.Parser().parse(existingMetaTtl);
        const stamp = quads.find((q) => q.predicate.value === stampPred);
        return !stamp || stamp.object.value !== want;
    }
    catch {
        return true;
    }
}
// ------------------------------------------------------------------
// ESM pipeline loader
// ------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runtimeImport = new Function("specifier", "return import(specifier)");
let pipelineCache = null;
function getPipeline() {
    if (pipelineCache === null) {
        // At runtime this file is at dist-cjs/listener.js.
        // tsconfig.json rootDir=../.. puts ESM output under
        // dist/extensions/markdown-projection/src/index.js.
        const esmPath = path.resolve(__dirname, "..", "dist", "extensions", "markdown-projection", "src", "index.js");
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
function frontmatterTypeIRI(fmType) {
    if (typeof fmType !== "string")
        return undefined;
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
function couldBeL4Container(url, storageBase) {
    return !url.startsWith(`${storageBase}/${WIKI_SEGMENT}/`);
}
// ------------------------------------------------------------------
// Path resolution — hoisted to fsPaths.ts (R-T2 / FOLLOWUPS item 8) to break the
// listener ↔ markdownBodyProjector circular import. Re-exported here so existing
// `import { fsPathFromUrl } from "./listener"` callers keep working.
// ------------------------------------------------------------------
var fsPaths_1 = require("./fsPaths");
Object.defineProperty(exports, "trimSlash", { enumerable: true, get: function () { return fsPaths_1.trimSlash; } });
Object.defineProperty(exports, "fsPathFromUrl", { enumerable: true, get: function () { return fsPaths_1.fsPathFromUrl; } });
const fsPaths_2 = require("./fsPaths");
class MarkdownProjectionListener extends Initializer_1.Initializer {
    store;
    baseUrl;
    dataDir;
    // Pod storage root path under baseUrl, injected via Components.js
    // (markdown-projection.json), default "/vault". Was a hardcoded literal in
    // project() before RQ-Substrate-4 Phase 3 (FOLLOWUPS contamination item 1).
    storagePath;
    // Body-hash stamp predicate, injected via Components.js (default
    // DEFAULT_STAMP_PRED). Must equal the AdmissionFloorStore's stampPredicate so
    // the backstop's stamp-match skip recognises floor-written .meta.
    stampPredicate;
    // Memento git repo root (= rootFilePath), injected via Components.js — mirrors
    // memento.json's MementoCommitListener.gitDir wiring (same variable). The backstop
    // reads the resource's prior committed body from here for exact subtraction (PSP T5,
    // spec §5). Empty string disables the git path → degraded pairShadow (the unit-test
    // store-stub case + any deploy that opts out of Memento).
    gitDir;
    // Projector version this listener stamps into .meta — must equal the floor
    // projector's version so a floor-then-listener write recognises its own stamp on
    // the next subtraction. Single-sourced via pkgVersion() (same package.json the
    // MarkdownBodyProjector reads), pinned to the ESM mirror by versionAgreement.test.ts.
    version = (0, markdownBodyProjector_1.pkgVersion)();
    postProjectionHook;
    // Serialise concurrent writes per the D68 chain pattern
    chain = Promise.resolve();
    // Live Type Index loader — instanced on first project() call once pipeline is loaded.
    // Typed as any because the class is loaded from the ESM module at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeIndexLoader = null;
    // Cached routing map (predicate IRI → class IRI) loaded from /meta/routing.jsonld.
    // Null until first project() call; falls back to BOOTSTRAP_PREDICATE_TO_CLASS on error.
    routingMap = null;
    constructor(store, baseUrl, dataDir, postProjectionHook, storagePath = "/vault", stampPredicate = exports.DEFAULT_STAMP_PRED, gitDir = "") {
        super();
        this.store = store;
        this.baseUrl = baseUrl.replace(/\/$/, "");
        this.dataDir = dataDir;
        // Normalise: leading "/", no trailing "/" — baseUrl is already right-
        // trimmed, so storageBase = baseUrl + storagePath joins cleanly.
        const sp = storagePath.startsWith("/") ? storagePath : `/${storagePath}`;
        this.storagePath = sp.replace(/\/$/, "");
        this.stampPredicate = stampPredicate;
        this.gitDir = gitDir;
        this.postProjectionHook = postProjectionHook ?? new NoOpPostProjectionHook_1.NoOpPostProjectionHook();
    }
    // Storage root URL = baseUrl + injected storagePath. The live Type Index
    // (<storageBase>/settings/publicTypeIndex) and routing.jsonld
    // (<storageBase>/meta/routing.jsonld) hang off this base. Exposed for tests
    // so the derived base is asserted from the injected storagePath, not a
    // hardcoded /vault literal (RQ-Substrate-4 Phase 3 / D107 §4.4).
    get storageBase() {
        return `${this.baseUrl}${this.storagePath}`;
    }
    // Initializer.handle() — called once by CSS WorkerParallelInitializer
    async handle() {
        this.store.on("changed", (target, activity, _metadata) => {
            const activityIri = activity.value ?? String(activity);
            this.onChange(target, activityIri);
        });
        // Drain any signals the floor projector queued before handle() ran (mirrors
        // MemTriggerListener.handle's startup drainPendingEvents).
        void this.drainCurationSignals().catch((err) => debug(`startup drainCurationSignals error: ${err.message}`));
        debug(`attached to MonitoringStore (baseUrl=${this.baseUrl}, dataDir=${this.dataDir}, gitDir=${this.gitDir || "(disabled)"})`);
    }
    // ------------------------------------------------------------------
    isProjectableResource(id) {
        const p = id.path;
        // Must end with .md and not be a .meta sidecar or have a query string.
        // The /wiki/ prefix filter was removed in Bug G — class-based dispatch
        // via the live Type Index is now the "do I govern this?" oracle (D78).
        return p.endsWith(".md") && !p.includes("?");
    }
    onChange(target, activityIri) {
        if (!this.isProjectableResource(target))
            return;
        // Delete events — CSS + Memento handle .meta cleanup, skip projection
        if (activityIri === String(Vocabularies_1.AS.Delete) ||
            activityIri.endsWith("#Delete") ||
            activityIri.endsWith("/Delete"))
            return;
        this.chain = this.chain
            .then(async () => { await this.project(target); })
            .then(async () => { await this.drainCurationSignals(); })
            .catch((err) => {
            debug(`projection failed for ${target.path}: ${err.message}`);
        });
    }
    /**
     * Drain pendingCurationSignals into <storageBase>/wiki/.events/, one timestamped
     * .ttl per signal, via store.setRepresentation — MIRRORS mem-trigger's EventEmitter.emit
     * (timestampSlug + randomUUID filename, text/turtle, in-process store write). The
     * MarkdownBodyProjector floor path queues onto the SAME buffer (it holds no store +
     * runs in-band inside setRepresentation); this listener, an Initializer with store
     * access, is the single drainer. Emit failures drop the signal without throwing —
     * substrate event archival must not block .meta writes (same stance as MemTrigger).
     */
    async drainCurationSignals() {
        while (curationSignal_1.pendingCurationSignals.length > 0) {
            const ttl = curationSignal_1.pendingCurationSignals.shift();
            if (ttl === undefined)
                break;
            // Recover the events container from the signal's as:target so the filename
            // lands beside the record (the buffer carries only Turtle strings).
            const match = ttl.match(/<([^>]*\/\.events\/)>/);
            const container = match ? match[1] : (0, curationSignal_1.eventsContainerFor)(this.storageBase);
            const path = `${container}${(0, curationSignal_1.timestampSlug)(new Date())}-${(0, crypto_2.randomUUID)()}.ttl`;
            try {
                await this.store.setRepresentation({ path }, new BasicRepresentation_1.BasicRepresentation(ttl, "text/turtle"));
            }
            catch (err) {
                // eslint-disable-next-line no-console
                console.error(`[markdown-projection] drainCurationSignals: emit failed (signal dropped): ${err.message}`);
            }
        }
    }
    async project(target) {
        debug(`projecting ${target.path}`);
        // Resolve filesystem path — needed for MetaWriter
        let fsPath;
        try {
            fsPath = (0, fsPaths_2.fsPathFromUrl)(target.path, this.baseUrl, this.dataDir);
        }
        catch (err) {
            debug(`path resolution failed: ${err.message}`);
            return;
        }
        // Read body from filesystem (avoids re-entering the store's HTTP stack)
        if (!(0, fs_1.existsSync)(fsPath)) {
            debug(`fsPath not found on disk, skipping: ${fsPath}`);
            return;
        }
        let body;
        try {
            body = (0, fs_1.readFileSync)(fsPath, "utf8");
        }
        catch (err) {
            debug(`read failed: ${err.message}`);
            return;
        }
        // Backstop: skip if the in-band floor already wrote a current .meta (stamp matches body).
        const metaPath = `${fsPath}.meta`;
        let existingMeta = "";
        try {
            if ((0, fs_1.existsSync)(metaPath))
                existingMeta = (0, fs_1.readFileSync)(metaPath, "utf8");
        }
        catch { /* treat as absent */ }
        if (!shouldReproject(body, existingMeta, this.stampPredicate)) {
            debug(`backstop: stamp current for ${target.path}, skipping re-projection`);
            return;
        }
        // Load ESM projection pipeline lazily
        const mod = await getPipeline();
        const { resolveGovernedFromQuads, detectClass, MetaWriter, resolveThingClass, TypeIndexLoader, BOOTSTRAP_PREDICATE_TO_CLASS, loadRoutingMap, splitFrontmatter } = mod;
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
        let thingClass = resolveThingClass(new URL(target.path).pathname, typeIndex, fmType);
        if (thingClass === undefined) {
            // Refresh-on-miss: the resource may belong to a freshly-installed L4
            // overlay whose Type Index entry isn't in the cache yet. Try once.
            if (fmType !== undefined || couldBeL4Container(target.path, storageBase)) {
                typeIndex = await this.typeIndexLoader.refresh();
                thingClass = resolveThingClass(new URL(target.path).pathname, typeIndex, fmType);
            }
            if (thingClass === undefined) {
                debug(`no governed class for ${target.path} — not a substrate-governed path`);
                return;
            }
        }
        // ONE pipeline-invocation path shared with the floor projector + the old-body
        // recompute below (PSP T3 rule — positional arg wiring lives in invokeProjection).
        const triples = await (0, markdownBodyProjector_1.invokeProjection)(mod, target.path, body, typeIndex, this.routingMap, storageBase);
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
        // Stamp this write: bodyHash + projectorVersion on the <> page subject —
        // mirrors AdmissionFloorStore.stampQuad/versionQuad so the NEXT write (floor or
        // listener) recognises its own projection for exact subtraction (spec §6). These
        // are projection-owned, so they go into `triples`; the PRIOR stamp quads go into
        // oldProjected (recovered below) and are thus replaced, never accumulated.
        const newBodyHash = (0, crypto_1.createHash)("sha256").update(body).digest("hex");
        const stamped = [
            ...triples,
            n3_1.DataFactory.quad(n3_1.DataFactory.namedNode(target.path), n3_1.DataFactory.namedNode(this.stampPredicate), n3_1.DataFactory.literal(newBodyHash)),
            n3_1.DataFactory.quad(n3_1.DataFactory.namedNode(target.path), n3_1.DataFactory.namedNode(stampPredicates_1.VERSION_PRED), n3_1.DataFactory.literal(this.version)),
        ];
        // Backstop exact subtraction (spec §5): recover the body whose projection the
        // CURRENT on-disk .meta carries — its sub:bodyHash stamp is the recovery target —
        // from the Memento git history, and require BOTH (a) the old body is recoverable
        // AND (b) the .meta's projector-version stamp == this projector's version. f(old)
        // through the SAME pipeline path = exactly the projection sitting in .meta, so
        // subtracting it can never strand an agent triple or leave a wrong residue. If
        // either condition fails AND a prior .meta exists, degrade to pairShadow + queue a
        // curation signal (first writes — no prior .meta — stay silent). PREFER degraded
        // over a wrong subtraction (recoverPriorBody returns null on any ambiguity).
        let oldProjected = null;
        const priorMeta = existingMeta
            ? new n3_1.Parser({ baseIRI: `${target.path}.meta` }).parse(existingMeta)
            : [];
        const stampHash = priorMeta.find((q) => q.subject.value === target.path && q.predicate.value === this.stampPredicate)?.object.value;
        const versionMatches = priorMeta.some((q) => q.subject.value === target.path
            && q.predicate.value === stampPredicates_1.VERSION_PRED
            && q.object.value === this.version);
        if (existingMeta && stampHash !== undefined && versionMatches && this.gitDir) {
            const rel = path.relative(this.dataDir, fsPath);
            const oldBody = await (0, gitRead_1.recoverPriorBody)(this.gitDir, rel, newBodyHash, stampHash);
            if (oldBody !== null) {
                const oldQuads = await (0, markdownBodyProjector_1.invokeProjection)(mod, target.path, oldBody, typeIndex, this.routingMap, storageBase);
                // Prior stamp quads are projection-owned → include them so they are
                // replaced, not accumulated (same logic as markdownBodyProjector.materialize).
                oldProjected = [...oldQuads, ...(0, stampPredicates_1.projectedStampQuads)(priorMeta, target.path)];
            }
        }
        if (oldProjected === null && existingMeta) {
            // A prior .meta exists but exact recompute was impossible (old body
            // unrecoverable / no git history / projector-version mismatch) → degraded
            // pairShadow; residue possible. Flag the resource for the D112 curation lane.
            (0, curationSignal_1.signalDegraded)(target.path, (0, curationSignal_1.eventsContainerFor)(storageBase));
            debug(`degraded pairShadow for ${target.path}: prior .meta exists but exact recompute impossible; curation signal queued`);
        }
        const writer = new MetaWriter();
        await writer.replaceProjected(fsPath, stamped, oldProjected, { resourceUrl: target.path });
        debug(`wrote .meta for ${target.path} (${stamped.length} triples, ${governed.length} governed predicates, exact=${oldProjected !== null})`);
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
        }
        catch (hookErr) {
            debug(`postProjectionHook error (substrate event archival failed; .meta still written): ${hookErr.message}`);
        }
    }
}
exports.MarkdownProjectionListener = MarkdownProjectionListener;
