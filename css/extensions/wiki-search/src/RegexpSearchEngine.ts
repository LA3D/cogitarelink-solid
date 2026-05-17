import type { SearchEngine, SearchPattern, Match } from "./SearchEngine";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lineNumberAt(body: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < body.length; i++) {
    if (body.charCodeAt(i) === 10) line++;
  }
  return line;
}

export class RegexpSearchEngine implements SearchEngine {
  public search(body: string, pattern: SearchPattern): Match[] {
    const matches: Match[] = [];
    const flags = pattern.options?.caseSensitive ? "g" : "gi";
    const cap = pattern.options?.maxMatchesPerResource ?? 50;
    for (const term of pattern.terms) {
      const re = new RegExp(escapeRegExp(term), flags);
      let m: RegExpExecArray | null;
      while ((m = re.exec(body)) !== null) {
        matches.push({
          offset: m.index,
          length: m[0].length,
          line: lineNumberAt(body, m.index),
          term,
        });
        if (matches.length >= cap) return matches;
        // Guard against zero-width matches looping forever (defense-in-depth;
        // escapeRegExp prevents this in practice but pattern is paranoia-safe)
        if (m[0].length === 0) re.lastIndex++;
      }
    }
    return matches;
  }
}
