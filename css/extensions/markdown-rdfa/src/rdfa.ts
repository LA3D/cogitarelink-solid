// Custom rehype plugin that adds RDFa attributes to <a> elements emitted by
// the typed-wikilinks remark plugin. After this pass:
//
//   <a class="wikilink wikilink-related"
//      href=".../context-graphs.md"
//      data-target="Context Graphs"
//      data-wikilink-class="related"
//      data-resolved="true">Context Graphs</a>
//
// becomes:
//
//   <a class="wikilink wikilink-related"
//      href=".../context-graphs.md"
//      property="skos:related"
//      typeof="skos:Concept"
//      resource=".../context-graphs.md">Context Graphs</a>
//
// The downstream prefix-decl plugin attaches the CURIE prefixes on <html>.

import type { Plugin } from "unified";
import type { Root, Element } from "hast";
import { visit } from "unist-util-visit";
import { PREDICATE_MAP, DEFAULT_PREDICATE } from "./predicates.js";

export const rehypeRdfa: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "a") return;
      const props = node.properties ?? (node.properties = {});
      const className = props.className;
      if (!className) return;

      // Normalise to a flat list of class tokens regardless of whether hast
      // gave us string[] or a single space-separated string.
      const classes: string[] = (Array.isArray(className) ? className : [className])
        .flatMap((c) => String(c).split(/\s+/))
        .filter(Boolean);
      if (!classes.includes("wikilink")) return;

      // Recover the relationship class either from data-wikilink-class or
      // from a wikilink-<klass> token in the className list.
      const dataKlass = (props["dataWikilinkClass"] as string | undefined) ?? "";
      const tokenKlass =
        classes.find((c) => c.startsWith("wikilink-"))?.replace("wikilink-", "") ?? "";
      const klass = dataKlass || tokenKlass;

      const predicate = klass ? (PREDICATE_MAP[klass] ?? DEFAULT_PREDICATE) : DEFAULT_PREDICATE;
      const href = props.href as string | undefined;

      props.property = predicate;
      props.typeof = "skos:Concept";
      if (href) props.resource = href;
    });
  };
};
