"use strict";
// MarkdownProjectionListener — CJS wrapper for CSS Components.js (D58/D71/D72).
//
// CSS's Components.js v6 uses ConstructionStrategyCommonJs which calls Node's
// require() directly — the class file MUST be CommonJS-loadable. The projection
// pipeline (projectionPipeline, governedPredicates, detectClass, MetaWriter)
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
exports.MarkdownProjectionListener = void 0;
const Initializer_1 = require("@solid/community-server/dist/init/Initializer");
const Vocabularies_1 = require("@solid/community-server/dist/util/Vocabularies");
const path = __importStar(require("path"));
const fs_1 = require("fs");
// ------------------------------------------------------------------
// Simple stderr logger (same approach as markdown-render/converter.ts)
// ------------------------------------------------------------------
function debug(...args) {
    // eslint-disable-next-line no-console
    console.error("[markdown-projection]", ...args);
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
// Path resolution — mirrors MementoCommitListener's fsPathFromUrl
// ------------------------------------------------------------------
function trimSlash(s) { return s.replace(/\/$/, ""); }
function fsPathFromUrl(url, baseUrl, dataDir) {
    const base = trimSlash(baseUrl);
    if (!url.startsWith(base))
        throw new Error(`URL outside pod base: ${url}`);
    // Strip query string (Memento uses ?version= / ?ext=timemap)
    const noQuery = url.split("?")[0];
    const relative = decodeURIComponent(noQuery.slice(base.length).replace(/^\//, ""));
    return path.join(dataDir, relative);
}
class MarkdownProjectionListener extends Initializer_1.Initializer {
    store;
    baseUrl;
    dataDir;
    // Serialise concurrent writes per the D68 chain pattern
    chain = Promise.resolve();
    constructor(store, baseUrl, dataDir) {
        super();
        this.store = store;
        this.baseUrl = baseUrl.replace(/\/$/, "");
        this.dataDir = dataDir;
    }
    // Initializer.handle() — called once by CSS WorkerParallelInitializer
    async handle() {
        this.store.on("changed", (target, activity, _metadata) => {
            const activityIri = activity.value ?? String(activity);
            this.onChange(target, activityIri);
        });
        debug(`attached to MonitoringStore (baseUrl=${this.baseUrl}, dataDir=${this.dataDir})`);
    }
    // ------------------------------------------------------------------
    isWikiResource(id) {
        const p = id.path;
        // Must contain /wiki/ segment and end with .md (not a .meta sidecar)
        return p.includes("/wiki/") && p.endsWith(".md") && !p.includes("?");
    }
    onChange(target, activityIri) {
        if (!this.isWikiResource(target))
            return;
        // Delete events — CSS + Memento handle .meta cleanup, skip projection
        if (activityIri === String(Vocabularies_1.AS.Delete) ||
            activityIri.endsWith("#Delete") ||
            activityIri.endsWith("/Delete"))
            return;
        this.chain = this.chain
            .then(async () => { await this.project(target); })
            .catch((err) => {
            debug(`projection failed for ${target.path}: ${err.message}`);
        });
    }
    async project(target) {
        debug(`projecting ${target.path}`);
        // Resolve filesystem path — needed for MetaWriter
        let fsPath;
        try {
            fsPath = fsPathFromUrl(target.path, this.baseUrl, this.dataDir);
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
        // Load ESM projection pipeline lazily
        const { projectionPipeline, governedPredicates, detectClass, MetaWriter } = await getPipeline();
        const triples = await projectionPipeline.run(target.path, body);
        const cls = detectClass(triples);
        if (!cls) {
            debug(`no rdf:type projected for ${target.path} — resource may lack type frontmatter`);
            return;
        }
        let governed;
        try {
            governed = governedPredicates(cls);
        }
        catch (err) {
            debug(`unknown class ${cls}: ${err.message}`);
            return;
        }
        const writer = new MetaWriter();
        await writer.replaceGoverned(fsPath, triples, governed);
        debug(`wrote .meta for ${target.path} (class=${cls}, ${triples.length} triples)`);
    }
}
exports.MarkdownProjectionListener = MarkdownProjectionListener;
