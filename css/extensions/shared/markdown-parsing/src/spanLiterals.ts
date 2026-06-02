export interface SpanLiteral { text: string; pred: string; lang?: string; datatype?: string; }

// [text]{.pred} | [text]{.pred@lang} | [text]{.pred^^prefix:local}
// Guards: leading "[" must NOT be preceded by "[" (so [[…]] wikilinks are excluded); and the "]"
// must be followed directly by "{." — NOT "](" (md link) or "][" (ref link).
const RE = /(?<!\[)\[([^\[\]]+?)\]\{\.([a-zA-Z][\w-]*)(?:@([a-zA-Z-]+)|\^\^([a-zA-Z][\w-]*:[a-zA-Z][\w-]*))?\}/g;

export function parseSpanLiterals(text: string): SpanLiteral[] {
  const out: SpanLiteral[] = [];
  for (const m of text.matchAll(RE)) {
    out.push({ text: m[1], pred: m[2], lang: m[3], datatype: m[4] });
  }
  return out;
}
