// Custom remark plugin that recognises Obsidian-style wikilinks with optional
// Pandoc attribute classes:
//
//   [[Context Graphs]]              → default class (none)
//   [[Context Graphs]]{.related}    → class = related
//   [[@zhang-2025-rlm]]{.source}    → class = source
//   [[Note Title|display label]]    → display label, target = "Note Title"
//   [[Note Title|display]]{.source} → display label + source class
//
// The plugin walks text nodes, finds the patterns, and splices in mdast `link`
// nodes whose `data` carries the relationship class for the downstream rehype
// pass to translate into RDFa attributes.

import type { Plugin } from "unified";
import type { Root, Text, Link, PhrasingContent } from "mdast";
import { visit, SKIP } from "unist-util-visit";
import type { WikilinkResolver } from "./resolver.js";
import { collectTokens } from "./textNodes.js";

// Pattern: [[target]] or [[target|alias]] optionally followed by {.class}
const WIKILINK_RE =
  /\[\[([^\]\|]+?)(?:\|([^\]]+?))?\]\](?:\{\.([a-zA-Z][\w-]*)\})?/g;

// ---------------------------------------------------------------------------
// Light-weight extraction — used by MarkdownProjectionListener (D58/D71) to
// pull wikilink targets + class hints from a markdown body. Parses with the
// SAME remark stack the render path uses and walks `text` nodes (audit R5 /
// R-T3) so the projection and the render document view recognise EXACTLY the
// same live tokens: code, link destinations, HTML blocks, and autolinks are
// structurally excluded by the AST, not by a length-preserving mask. No resolver
// is needed; the caller (wikilinkProjection.ts) applies the slug algorithm and
// container routing.
// ---------------------------------------------------------------------------
export interface WikilinkRef {
  /** Raw wikilink target text, e.g. "Agentic Memory Systems MOC" or "@zhang-2025-rlm" */
  title: string;
  /** Optional Pandoc class hint, e.g. "broader" | "source" | "author" | undefined */
  classHint?: string;
}

/**
 * Extract all wikilink references from a markdown body string.
 * Does not resolve URIs — returns title + optional class hint only.
 */
export function extractWikilinks(body: string): WikilinkRef[] {
  const out: WikilinkRef[] = [];
  for (const { match } of collectTokens(body, WIKILINK_RE)) {
    const [, target, , klass] = match;
    out.push({ title: target.trim(), classHint: klass ?? undefined });
  }
  return out;
}

export interface WikilinkOptions {
  resolver: WikilinkResolver;
}

export const remarkTypedWikilinks: Plugin<[WikilinkOptions], Root> = (
  options,
) => {
  const { resolver } = options;

  return (tree) => {
    visit(tree, "text", (node: Text, index, parent) => {
      if (!parent || index === undefined) return;
      if (!node.value.includes("[[")) return;

      const matches = [...node.value.matchAll(WIKILINK_RE)];
      if (matches.length === 0) return;

      const out: PhrasingContent[] = [];
      let cursor = 0;

      for (const m of matches) {
        const [full, target, alias, klass] = m;
        const start = m.index ?? 0;

        // Preserve any text before this match.
        if (start > cursor) {
          out.push({ type: "text", value: node.value.slice(cursor, start) });
        }

        // Pass the class hint so the href routes to the same container the
        // projection routes the .meta edge to (dual-view agreement, R1.1).
        const url = resolver.resolve(target, klass ?? undefined);
        const label = (alias ?? target).trim();
        const link: Link = {
          type: "link",
          url: url ?? "#unresolved",
          children: [{ type: "text", value: label }],
          data: {
            hProperties: {
              className: klass ? ["wikilink", `wikilink-${klass}`] : ["wikilink"],
              "data-target": target,
              "data-wikilink-class": klass ?? "",
              "data-resolved": url ? "true" : "false",
            },
          },
        };
        out.push(link);

        cursor = start + full.length;
      }

      // Preserve trailing text.
      if (cursor < node.value.length) {
        out.push({ type: "text", value: node.value.slice(cursor) });
      }

      // Splice the new nodes in place of the original text node.
      parent.children.splice(index, 1, ...out);
      return [SKIP, index + out.length];
    });
  };
};
