"use strict";
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
exports.MarkdownBodyProjector = void 0;
const path = __importStar(require("path"));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runtimeImport = new Function("specifier", "return import(specifier)");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipelineCache = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPipeline() {
    if (pipelineCache === null) {
        // At runtime this file is at dist-cjs/markdownBodyProjector.js.
        // tsconfig.json rootDir=../.. puts ESM output under
        // dist/extensions/markdown-projection/src/index.js.
        // Path mirrors listener.ts getPipeline() exactly (same __dirname depth).
        const esmPath = path.resolve(__dirname, "..", "dist", "extensions", "markdown-projection", "src", "index.js");
        pipelineCache = runtimeImport("file://" + esmPath);
    }
    return pipelineCache;
}
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
class MarkdownBodyProjector {
    baseUrl;
    dataDir;
    storagePath;
    routingMap = null;
    // Typed as any — TypeIndexLoader is loaded from ESM at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeIndexLoader = null;
    constructor(baseUrl, dataDir, storagePath = "/vault") {
        this.baseUrl = baseUrl;
        this.dataDir = dataDir;
        this.storagePath = storagePath;
        this.baseUrl = baseUrl.replace(/\/$/, "");
    }
    // Storage root URL = baseUrl + storagePath. TypeIndexLoader and loadRoutingMap
    // both require this base (not the server root) to find publicTypeIndex and
    // meta/routing.jsonld. Mirrors listener.ts's storageBase getter.
    get storageBase() {
        const sp = this.storagePath.startsWith("/") ? this.storagePath : `/${this.storagePath}`;
        return `${this.baseUrl}${sp.replace(/\/$/, "")}`;
    }
    canProject(representation) {
        return representation.metadata.contentType === "text/markdown";
    }
    async project(identifier, body) {
        const { projectionPipeline, TypeIndexLoader, BOOTSTRAP_PREDICATE_TO_CLASS, loadRoutingMap, PAGE_GOVERNED_PREDICATES, getThingGovernedPredicates, } = await getPipeline();
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
        const quads = await projectionPipeline.run(identifier.path, body, typeIndex, this.routingMap ?? undefined);
        // After Bug-F filtering, the wiki: class is removed from the page resource
        // triples when invariants are emitted. The thing class (skos:Concept,
        // schema:Person, …) is only on <#this>. We resolve governed predicates using
        // the thing class directly rather than going through resolveGovernedForWikiClass,
        // which expects the wiki: class IRI. Both PAGE_GOVERNED_PREDICATES and
        // getThingGovernedPredicates are exported from the ESM module.
        const thingIri = identifier.path + "#this";
        const thingTypeQuad = quads.find(q => q.predicate.value === RDF_TYPE && q.subject.value === thingIri);
        // No thing class in quads → resource is not substrate-governed
        if (!thingTypeQuad)
            return null;
        const thingClass = thingTypeQuad.object.value;
        const thingGoverned = getThingGovernedPredicates(thingClass)
            .map(n => n.value);
        const pageGoverned = PAGE_GOVERNED_PREDICATES
            .map(n => n.value);
        return {
            quads,
            governed: [...new Set([...pageGoverned, ...thingGoverned])],
        };
    }
}
exports.MarkdownBodyProjector = MarkdownBodyProjector;
