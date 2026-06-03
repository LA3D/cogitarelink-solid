// fsPaths.ts — URL → on-disk path helpers (R-T2 / FOLLOWUPS item 8).
//
// trimSlash + fsPathFromUrl were exported from listener.ts and imported by
// markdownBodyProjector.ts, which listener.ts re-exports from — a circular
// import (listener → projector → listener). Hoisting them to this small,
// dependency-free module breaks the cycle: both listener.ts and
// markdownBodyProjector.ts import from here, neither from the other for these
// helpers. No behaviour change.

import * as path from "path";

export function trimSlash(s: string): string { return s.replace(/\/$/, ""); }

// Map an HTTP resource URL to its on-disk path so MetaWriter can write the .meta
// sidecar. Mirrors MementoCommitListener's fsPathFromUrl.
export function fsPathFromUrl(url: string, baseUrl: string, dataDir: string): string {
    const base = trimSlash(baseUrl);
    if (!url.startsWith(base)) throw new Error(`URL outside pod base: ${url}`);
    // Strip query string (Memento uses ?version= / ?ext=timemap)
    const noQuery = url.split("?")[0];
    const relative = decodeURIComponent(noQuery.slice(base.length).replace(/^\//, ""));
    return path.join(dataDir, relative);
}
