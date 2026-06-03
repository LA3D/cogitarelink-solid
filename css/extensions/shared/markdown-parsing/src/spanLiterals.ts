import { collectTokens } from "./textNodes.js";

export interface SpanLiteral { text: string; pred: string; lang?: string; datatype?: string; }

// [text]{.pred} | [text]{.pred@lang} | [text]{.pred^^prefix:local}
// Guards: leading "[" must NOT be preceded by "[" (so [[…]] wikilinks are excluded); and the "]"
// must be followed directly by "{." — NOT "](" (md link) or "][" (ref link).
const RE = /(?<!\[)\[([^\[\]]+?)\]\{\.([a-zA-Z][\w-]*)(?:@([a-zA-Z-]+)|\^\^([a-zA-Z][\w-]*:[a-zA-Z][\w-]*))?\}/g;

// Parse with the SAME remark stack the render path uses and walk `text` nodes
// (audit R5 / R-T3): code, link destinations, HTML blocks, and autolinks are
// structurally excluded by the AST. The span grammar is regular, so the regex is
// applied per text node — the AST, not a length-preserving mask, does the
// exclusion. (A bare `[x]{.pred}` fragment with no block context parses to a
// paragraph whose text node holds the token, so sub-string callers still work.)
export function parseSpanLiterals(text: string): SpanLiteral[] {
  const out: SpanLiteral[] = [];
  for (const { match } of collectTokens(text, RE)) {
    out.push({ text: match[1], pred: match[2], lang: match[3], datatype: match[4] });
  }
  return out;
}
