// Wikilink → pod URI resolver.
//
// In production, this will hit the pod's Type Index
// (`/vault/settings/publicTypeIndex`) and cache the name → URI mapping. For
// this sample we use a hardcoded resolver so the pipeline can be exercised
// without a live pod. Swap in a live resolver by implementing the same
// interface.

import { targetUrlFor } from "./wikiUrl.js";

// slug lives in wikiUrl.ts (the minting primitives module) so wikiUrl.ts is
// self-contained and resolver.ts depends on it one-way (no import cycle).
// Re-exported here for the existing `import { slug } from "./resolver.js"`
// callers (wikilinkProjection.ts, markdown-render).
export { slug } from "./wikiUrl.js";

export interface WikilinkResolver {
  // classHint (the [[..]]{.hint} class, without the dot) is optional so the
  // resolver can route typed links to the right container — author→people,
  // location→places, etc. — exactly as the projection routes the .meta edge.
  // Passing it is what keeps the rendered <a href> and the projected edge IRI
  // identifying the SAME resource (audit R1.1 dual-view agreement).
  resolve(target: string, classHint?: string): string | null;
}

// Render-path wikilink resolver — a THIN ADAPTER over the single URL minter
// (targetUrlFor, wikiUrl.ts). The rendered <a href> and the projected .meta
// edge object IRI are now minted by ONE function so the document view and the
// graph view identify the SAME resource for a given [[wikilink]] (audit R1.1).
//
// Before R-T2 this minted a stale pre-D98 PARA path
// (/vault/resources/concepts/<slug>.md) — a different resource from the D98
// /<storagePath>/wiki/<container>/<slug>.md the projection minted. That path is
// gone; the resolver delegates default routing to targetUrlFor.
//
// The render path has NO live Type Index, so it always uses the DEFAULT hint→
// container routing (defaultContainerFor): author→people, affiliation→
// organizations, location→places, everything else→concepts. The projection's
// live-index routing only DEVIATES from these defaults when a deployer's
// publicTypeIndex actually registers a different container — which the render
// path (being a pure converter with no Pod fetch) cannot see. Wherever the live
// index is silent the two agree by construction.
export class HardcodedResolver implements WikilinkResolver {
  private readonly wikiRoot: string;

  // base = pod base URL (e.g. "https://pod.vardeman.me"); storagePath = the
  // storage root under it (e.g. "/vault"). wikiRoot = base + storagePath is the
  // root targetUrlFor mints the /<WIKI_SEGMENT>/<container>/ layout under. Both
  // come from config (variable:baseUrl + the storagePath param) — see
  // markdown-projection.json for the D107 wiring pattern this mirrors.
  constructor(
    base: string = "https://pod.vardeman.me",
    storagePath: string = "/vault",
  ) {
    const b = base.replace(/\/$/, "");
    const sp = storagePath.startsWith("/") ? storagePath : `/${storagePath}`;
    this.wikiRoot = `${b}${sp.replace(/\/$/, "")}`;
  }

  // classHint routes the href to the same default container the projection
  // routes the .meta edge to (author→people, affiliation→organizations,
  // location→places, else concepts). With no live Type Index the render path
  // uses the default routing; the projection only deviates when a live
  // publicTypeIndex registration overrides — invisible to the render converter.
  resolve(target: string, classHint?: string): string {
    return targetUrlFor({ title: target, classHint, wikiRoot: this.wikiRoot });
  }
}
