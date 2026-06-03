// Shared markdown parse + text-node traversal (audit R5 / R-T3).
//
// The render path (remarkTypedWikilinks) applies the token regexes ONLY inside
// mdast `text` nodes, so the AST structurally excludes fenced/indented code,
// inline code, link destinations, HTML blocks, and autolinks. The projection
// extractors (extractWikilinks, parseSpanLiterals) used to regex the FLAT body
// string guarded only by maskCodeSpans (fenced+inline only), so those other
// constructs silently projected while rendering inert — a dual-view divergence
// (audit P5 "parse split").
//
// This module is the single parse-and-walk machinery both views share: parse the
// body with the SAME remark stack the render path uses (remark-parse + GFM +
// frontmatter), then collect token matches by applying the per-token regex to
// each `text` node's value. The token grammar itself is regular, so regex PER
// TEXT NODE is correct — the AST does the structural exclusion the mask never
// could.

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { visit } from "unist-util-visit";
import type { Root, Text } from "mdast";

// One processor, reused. remark-frontmatter is registered so a leading `---`
// YAML block parses as a frontmatter node (not a thematic-break/heading mess) on
// the off chance a caller hands us a body that still carries frontmatter; in the
// projection pipeline the body is already post-frontmatter (splitFrontmatter),
// but parsing must stay robust to a raw fragment either way. remark-gfm matches
// the render stack so autolink literals / tables parse identically across views.
const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkGfm);

/** Parse a markdown body to an mdast tree using the shared render-aligned stack. */
export function parseMarkdown(body: string): Root {
  return processor.parse(body) as Root;
}

/**
 * Walk every `text` node of an mdast tree and collect all matches of `regex`
 * (which MUST be a global regex). Each yielded item carries the regex match plus
 * the text node it was found in. Code (fenced/indented/inline), link
 * destinations, HTML blocks, and autolinks never appear as `text` nodes, so they
 * are excluded by construction — render≡projection structural parity.
 *
 * The regex's lastIndex is reset per node (matchAll handles this internally).
 */
export function collectFromTextNodes(
  tree: Root,
  regex: RegExp,
): Array<{ match: RegExpMatchArray; node: Text }> {
  const out: Array<{ match: RegExpMatchArray; node: Text }> = [];
  visit(tree, "text", (node: Text) => {
    for (const m of node.value.matchAll(regex)) {
      out.push({ match: m, node });
    }
  });
  return out;
}

/** Convenience: parse `body` then collect `regex` matches across its text nodes. */
export function collectTokens(
  body: string,
  regex: RegExp,
): Array<{ match: RegExpMatchArray; node: Text }> {
  return collectFromTextNodes(parseMarkdown(body), regex);
}
