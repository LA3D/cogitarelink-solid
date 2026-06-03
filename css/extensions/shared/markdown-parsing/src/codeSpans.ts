// Mask markdown code regions so downstream token parsers (wikilinks, span-literals)
// don't project example syntax shown inside `inline code` or fenced ``` blocks.
// Replaces code-region characters with spaces — preserves total length AND every
// non-code offset, so callers can keep using the same indices.
const FENCE = /(^|\n)(```|~~~)[^\n]*\n[\s\S]*?\n\2[ \t]*(?=\n|$)/g;
const INLINE = /(`+)(?:(?!\1).)*\1/g;

function blank(match: string): string {
  // keep newlines (so line structure / other regexes stay aligned), blank the rest
  return match.replace(/[^\n]/g, " ");
}

export function maskCodeSpans(body: string): string {
  let out = body.replace(FENCE, (m) => blank(m));
  out = out.replace(INLINE, (m) => blank(m));
  return out;
}
