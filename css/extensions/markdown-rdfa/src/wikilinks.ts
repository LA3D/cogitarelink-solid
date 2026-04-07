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

// Pattern: [[target]] or [[target|alias]] optionally followed by {.class}
const WIKILINK_RE =
  /\[\[([^\]\|]+?)(?:\|([^\]]+?))?\]\](?:\{\.([a-zA-Z][\w-]*)\})?/g;

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

        const url = resolver.resolve(target);
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
