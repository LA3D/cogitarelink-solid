// Context-agreement drift guard (audit L2, exemplar:
// shape-validator/test/stampAgreement.test.ts). The injector inlines a compact
// DEFAULT_CONTEXT (so the emitted JSON-LD is self-contained for agents that
// haven't fetched the served context). That inline copy duplicates the D79
// canonical context, which is ASSEMBLED from overlay context fragments — the
// repo source of truth is overlays/wiki-memory/context-fragment.jsonld.
//
// If a prefix in DEFAULT_CONTEXT ever maps to a DIFFERENT IRI than the
// canonical context, the page-served JSON-LD and the .meta-served graph would
// expand the same CURIE to two different IRIs — a dual-view divergence (P5).
// This test asserts ⊆-agreement: every prefix in DEFAULT_CONTEXT that the
// canonical context also declares must map to the SAME IRI. (The injector may
// carry extra prefixes the fragment doesn't yet declare — dct/prof/ldp/rdfs —
// but it must never DISAGREE on a shared one.)
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { DEFAULT_CONTEXT } from "../src-cjs/JsonLdScriptInjector";

const CANONICAL = join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "overlays",
  "wiki-memory",
  "context-fragment.jsonld",
);

// Extract the string-valued prefix → IRI mappings from a JSON-LD @context
// (skip compact-term object defs like { "@id": "schema:about", "@type": "@id" }
// and term aliases whose value is a CURIE, not a namespace IRI).
function prefixMap(ctx: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (typeof v === "string" && (v.endsWith("#") || v.endsWith("/"))) {
      out[k] = v;
    }
  }
  return out;
}

describe("JsonLdScriptInjector DEFAULT_CONTEXT agreement with served context (audit L2)", () => {
  const canonical = JSON.parse(readFileSync(CANONICAL, "utf8"))["@context"] as Record<string, unknown>;
  const canonicalPrefixes = prefixMap(canonical);

  it("the canonical context-fragment.jsonld actually declares prefixes (sanity)", () => {
    expect(Object.keys(canonicalPrefixes).length).toBeGreaterThan(0);
    expect(canonicalPrefixes.wiki).toBe("https://pod.vardeman.me/vault/ontology/wiki#");
  });

  it("every shared prefix maps to the SAME IRI (⊆ no-disagreement)", () => {
    const shared = Object.keys(DEFAULT_CONTEXT).filter((p) => p in canonicalPrefixes);
    // At least the wiki prefix is shared today — guard against a vacuous pass.
    expect(shared).toContain("wiki");
    for (const p of shared) {
      expect(DEFAULT_CONTEXT[p]).toBe(canonicalPrefixes[p]);
    }
  });
});
