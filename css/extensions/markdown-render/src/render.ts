// Main render pipeline. Composes the unified processor:
//
//   text/markdown
//     → remark-parse
//     → remark-frontmatter (strip YAML)
//     → remark-typed-wikilinks (parse [[...]]{.class})
//     → remark-rehype
//     → rehype-document (wrap in <html>)
//     → rehype-wikilink-classes (add class="wikilink wikilink-{type}" on <a>)
//     → rehype-format
//     → rehype-stringify
//
// D75: rendered HTML carries semantic CSS classes only — no RDFa. The data
// layer lives exclusively in .meta Turtle projected by MarkdownProjectionListener.
//
// Returns a complete HTML document as a string.

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeDocument from "rehype-document";
import rehypeFormat from "rehype-format";
import rehypeStringify from "rehype-stringify";
import { remarkTypedWikilinks } from "../../shared/markdown-parsing/src/wikilinks.js";
import { rehypeWikilinkClasses } from "./rehype-wikilink-classes.js";
import { HardcodedResolver, type WikilinkResolver } from "../../shared/markdown-parsing/src/resolver.js";

export interface RenderOptions {
  resolver?: WikilinkResolver;
  title?: string;
  podBase?: string;
  // Storage root path under podBase (default "/vault"). The wikilink resolver
  // mints hrefs under podBase + storagePath + "/wiki/..." so the rendered href
  // identifies the same resource as the projected .meta edge (dual-view R1.1).
  storagePath?: string;
}

export async function renderMarkdown(
  source: string,
  opts: RenderOptions = {},
): Promise<string> {
  const resolver = opts.resolver ?? new HardcodedResolver(opts.podBase, opts.storagePath);
  const title = opts.title ?? "Pod Resource";

  const file = await unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkGfm)
    .use(remarkTypedWikilinks, { resolver })
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeDocument, {
      title,
      css: ["/static/wikilinks.css"],
      meta: [{ name: "generator", content: "markdown-render (cogitarelink-solid)" }],
    })
    .use(rehypeWikilinkClasses)
    .use(rehypeFormat)
    .use(rehypeStringify)
    .process(source);

  return String(file);
}
