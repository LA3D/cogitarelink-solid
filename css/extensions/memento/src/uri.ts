// Canonical Memento URI toolkit. profile-link carries a trimmed copy of
// `isUnderBaseUrl` only (see profile-link/src/uri.ts header + audit M4).

const MEMENTO_DT_RE = /^\d{14}$/;

function splitQuery(uri: string): { base: string; params: URLSearchParams } {
  const hashIdx = uri.indexOf("#");
  if (hashIdx >= 0) {
    return splitQuery(uri.slice(0, hashIdx));
  }
  const qIdx = uri.indexOf("?");
  if (qIdx < 0) return { base: uri, params: new URLSearchParams() };
  return { base: uri.slice(0, qIdx), params: new URLSearchParams(uri.slice(qIdx + 1)) };
}

function rebuild(base: string, params: URLSearchParams): string {
  const s = params.toString();
  return s ? `${base}?${s}` : base;
}

export function withVersion(original: string, mementoStr: string): string {
  const { base, params } = splitQuery(original);
  params.set("version", mementoStr);
  return rebuild(base, params);
}

export function withTimemap(original: string): string {
  const { base, params } = splitQuery(original);
  params.set("ext", "timemap");
  return rebuild(base, params);
}

export function stripMementoQuery(uri: string): string {
  const { base, params } = splitQuery(uri);
  params.delete("version");
  params.delete("ext");
  return rebuild(base, params);
}

export function getMementoStringFromUri(uri: string): string | null {
  const { params } = splitQuery(uri);
  const v = params.get("version");
  if (v === null) return null;
  return MEMENTO_DT_RE.test(v) ? v : null;
}

export function isTimemapRequest(uri: string): boolean {
  return splitQuery(uri).params.get("ext") === "timemap";
}

function trimSlash(s: string): string {
  return s.replace(/\/$/, "");
}

export function buildAbsoluteUrl(requestUrl: string | undefined, baseUrl: string): string {
  const base = trimSlash(baseUrl);
  if (!requestUrl) return `${base}/`;
  if (/^https?:\/\//i.test(requestUrl)) return requestUrl;
  return `${base}${requestUrl.startsWith("/") ? "" : "/"}${requestUrl}`;
}

export function isUnderBaseUrl(url: string, baseUrl: string): boolean {
  const base = trimSlash(baseUrl);
  return url === base || url === `${base}/` || url.startsWith(`${base}/`);
}

export function fsPathFromUrl(url: string, baseUrl: string): string {
  if (!isUnderBaseUrl(url, baseUrl)) {
    throw new Error(`URL outside pod base: ${url}`);
  }
  const base = trimSlash(baseUrl);
  const stripped = url.slice(base.length).replace(/^\//, "");
  const { base: pathOnly } = splitQuery(stripped);
  return decodeURIComponent(pathOnly);
}
