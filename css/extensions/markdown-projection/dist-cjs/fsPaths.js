"use strict";
// fsPaths.ts — URL → on-disk path helpers (R-T2 / FOLLOWUPS item 8).
//
// trimSlash + fsPathFromUrl were exported from listener.ts and imported by
// markdownBodyProjector.ts, which listener.ts re-exports from — a circular
// import (listener → projector → listener). Hoisting them to this small,
// dependency-free module breaks the cycle: both listener.ts and
// markdownBodyProjector.ts import from here, neither from the other for these
// helpers. No behaviour change.
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
exports.trimSlash = trimSlash;
exports.fsPathFromUrl = fsPathFromUrl;
const path = __importStar(require("path"));
function trimSlash(s) { return s.replace(/\/$/, ""); }
// Map an HTTP resource URL to its on-disk path so MetaWriter can write the .meta
// sidecar. Mirrors MementoCommitListener's fsPathFromUrl.
function fsPathFromUrl(url, baseUrl, dataDir) {
    const base = trimSlash(baseUrl);
    if (!url.startsWith(base))
        throw new Error(`URL outside pod base: ${url}`);
    // Strip query string (Memento uses ?version= / ?ext=timemap)
    const noQuery = url.split("?")[0];
    const relative = decodeURIComponent(noQuery.slice(base.length).replace(/^\//, ""));
    return path.join(dataDir, relative);
}
