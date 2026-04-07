// Tiny rehype plugin: attach the RDFa CURIE `prefix` attribute to the <html>
// element. Runs after rehype-document so the document wrapper exists.

import type { Plugin } from "unified";
import type { Root, Element } from "hast";
import { visit } from "unist-util-visit";
import { RDFA_PREFIX } from "./predicates.js";

export const rehypePrefixDecl: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "html") return;
      node.properties = { ...(node.properties ?? {}), prefix: RDFA_PREFIX };
    });
  };
};
