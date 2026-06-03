// Mask markdown code regions so downstream token parsers (wikilinks, span-literals)
// don't project example syntax shown inside `inline code` or fenced ``` blocks.
// Replaces code-region characters with spaces — preserves total length AND every
// non-code offset, so callers can keep using the same indices.
// CRLF-tolerant: \r?\n matches both LF-only (Unix) and CRLF (Windows) line endings.
// blank() keeps \n but replaces \r (a non-\n char) with a space, so length is unchanged.
const FENCE = /(^|\n)(```|~~~)[^\n]*\r?\n[\s\S]*?\r?\n\2[ \t]*(?=\r?\n|$)/g;
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
