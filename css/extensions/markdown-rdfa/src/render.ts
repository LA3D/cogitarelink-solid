// Main render pipeline. Composes the unified processor:
//
//   text/markdown
//     → remark-parse
//     → remark-frontmatter (strip YAML)
//     → remark-typed-wikilinks (parse [[...]]{.class})
//     → remark-rehype
//     → rehype-document (wrap in <html>)
//     → rehype-prefix-decl (add CURIE prefixes)
//     → rehype-rdfa (add property/typeof/resource on <a>)
//     → rehype-format
//     → rehype-stringify
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
import { remarkTypedWikilinks } from "./wikilinks.js";
import { rehypeRdfa } from "./rdfa.js";
import { rehypePrefixDecl } from "./prefix-decl.js";
import { HardcodedResolver, type WikilinkResolver } from "./resolver.js";

export interface RenderOptions {
  resolver?: WikilinkResolver;
  title?: string;
  podBase?: string;
}

export async function renderMarkdown(
  source: string,
  opts: RenderOptions = {},
): Promise<string> {
  const resolver = opts.resolver ?? new HardcodedResolver(opts.podBase);
  const title = opts.title ?? "Pod Resource";

  const file = await unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkGfm)
    .use(remarkTypedWikilinks, { resolver })
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeDocument, {
      title,
      css: [],
      meta: [{ name: "generator", content: "markdown-rdfa (cogitarelink-solid)" }],
    })
    .use(rehypePrefixDecl)
    .use(rehypeRdfa)
    .use(rehypeFormat)
    .use(rehypeStringify)
    .process(source);

  return String(file);
}
