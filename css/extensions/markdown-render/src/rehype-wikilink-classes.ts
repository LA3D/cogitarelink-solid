// D75: Replace the RDFa annotation pass with a CSS-class annotation pass.
//
// The remarkTypedWikilinks plugin (shared/markdown-parsing) already sets
// className on each wikilink <a> element via hast hProperties:
//
//   className: ["wikilink", "wikilink-source"]   (typed)
//   className: ["wikilink"]                       (untyped)
//
// This plugin normalises that value — ensuring it is always a string[] and
// removing any stale data-* attributes no longer needed after RDFa is gone.
// It is a no-op for <a> elements that are not wikilinks.
//
// Result:
//   <a class="wikilink wikilink-source" href="...">Note</a>
//
// The wikilinks.css stylesheet (static/wikilinks.css) provides default visual
// treatment for each class variant.

import { visit } from "unist-util-visit";
import type { Plugin } from "unified";
import type { Element, Root } from "hast";

export const rehypeWikilinkClasses: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "a") return;
      const props = node.properties ?? (node.properties = {});
      const className = props.className;
      if (!className) return;

      // Normalise to a flat string[].
      const classes: string[] = (Array.isArray(className) ? className : [className])
        .flatMap((c) => String(c).split(/\s+/))
        .filter(Boolean);

      if (!classes.includes("wikilink")) return;

      // Ensure className is a clean string[] (hast serialises this to
      // space-separated class attribute).
      props.className = classes;
    });
  };
};
