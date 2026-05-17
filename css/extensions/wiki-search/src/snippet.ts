/**
 * Halo-bounded snippet around a match offset, with whitespace collapsed
 * and ellipsis marking truncation. Output is one-line, single-spaced —
 * the consumer agent reads it inline in a Turtle response.
 */
export function snippet(
  body: string,
  offset: number,
  length: number,
  halo: number = 80,
): string {
  const start = Math.max(0, offset - halo);
  const end = Math.min(body.length, offset + length + halo);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < body.length ? "…" : "";
  const slice = body.slice(start, end).replace(/\s+/g, " ").trim();
  return prefix + slice + suffix;
}
