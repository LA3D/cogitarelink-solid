// URL-under-base predicate. The full Memento URI toolkit (withVersion,
// timemap helpers, fsPathFromUrl, …) lives in the canonical original at
// `css/extensions/memento/src/uri.ts`; profile-link needs only this one
// function, so it carries a trimmed copy rather than depending on the
// memento package (these CJS extensions have no shared-module path — the
// only `shared/` module in the repo, shared/markdown-parsing, is ESM and
// inlined into ESM consumers via rootDir, which would break these
// CommonJS extensions' Components.js dist wiring). See audit M4.

function trimSlash(s: string): string {
  return s.replace(/\/$/, "");
}

export function isUnderBaseUrl(url: string, baseUrl: string): boolean {
  const base = trimSlash(baseUrl);
  return url === base || url === `${base}/` || url.startsWith(`${base}/`);
}
