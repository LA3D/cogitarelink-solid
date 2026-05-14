import { describe, it, expect } from "vitest";
import {
  withVersion,
  withTimemap,
  stripMementoQuery,
  getMementoStringFromUri,
  isTimemapRequest,
  buildAbsoluteUrl,
  isUnderBaseUrl,
  fsPathFromUrl,
} from "../src/uri";

describe("withVersion", () => {
  it("appends ?version= to a query-less URI", () => {
    expect(withVersion("http://pod/note.md", "20260415120000"))
      .toBe("http://pod/note.md?version=20260415120000");
  });

  it("appends &version= when other query params already exist", () => {
    expect(withVersion("http://pod/note.md?lang=en", "20260415120000"))
      .toBe("http://pod/note.md?lang=en&version=20260415120000");
  });

  it("preserves path-only URIs", () => {
    expect(withVersion("/vault/note.md", "20260415120000"))
      .toBe("/vault/note.md?version=20260415120000");
  });
});

describe("withTimemap", () => {
  it("appends ?ext=timemap", () => {
    expect(withTimemap("http://pod/note.md"))
      .toBe("http://pod/note.md?ext=timemap");
  });

  it("uses & for existing query strings", () => {
    expect(withTimemap("http://pod/note.md?x=1"))
      .toBe("http://pod/note.md?x=1&ext=timemap");
  });
});

describe("stripMementoQuery", () => {
  it("removes ?version=...", () => {
    expect(stripMementoQuery("http://pod/note.md?version=20260415120000"))
      .toBe("http://pod/note.md");
  });

  it("removes ?ext=timemap", () => {
    expect(stripMementoQuery("http://pod/note.md?ext=timemap"))
      .toBe("http://pod/note.md");
  });

  it("preserves other query params", () => {
    expect(stripMementoQuery("http://pod/note.md?lang=en&version=20260415120000"))
      .toBe("http://pod/note.md?lang=en");
  });

  it("is a no-op on URIs without Memento params", () => {
    expect(stripMementoQuery("http://pod/note.md")).toBe("http://pod/note.md");
    expect(stripMementoQuery("http://pod/note.md?lang=en")).toBe("http://pod/note.md?lang=en");
  });
});

describe("getMementoStringFromUri", () => {
  it("extracts the 14-digit datetime from ?version=", () => {
    expect(getMementoStringFromUri("http://pod/note.md?version=20260415120000"))
      .toBe("20260415120000");
  });

  it("returns null when absent", () => {
    expect(getMementoStringFromUri("http://pod/note.md")).toBeNull();
    expect(getMementoStringFromUri("http://pod/note.md?ext=timemap")).toBeNull();
  });

  it("returns null on malformed datetime values", () => {
    expect(getMementoStringFromUri("http://pod/note.md?version=notadate")).toBeNull();
    expect(getMementoStringFromUri("http://pod/note.md?version=2026041512000")).toBeNull();
  });
});

describe("isTimemapRequest", () => {
  it("recognizes ?ext=timemap", () => {
    expect(isTimemapRequest("http://pod/note.md?ext=timemap")).toBe(true);
  });

  it("returns false for non-timemap URIs", () => {
    expect(isTimemapRequest("http://pod/note.md")).toBe(false);
    expect(isTimemapRequest("http://pod/note.md?version=20260415120000")).toBe(false);
  });

  it("recognizes ext=timemap when combined with other params", () => {
    expect(isTimemapRequest("http://pod/note.md?lang=en&ext=timemap")).toBe(true);
  });
});

describe("buildAbsoluteUrl", () => {
  const base = "http://pod.example:3000";

  it("joins path-form request URL with baseUrl", () => {
    expect(buildAbsoluteUrl("/note.md", base)).toBe("http://pod.example:3000/note.md");
  });

  it("joins query strings cleanly", () => {
    expect(buildAbsoluteUrl("/note.md?version=20260101000000", base))
      .toBe("http://pod.example:3000/note.md?version=20260101000000");
  });

  it("returns absolute-form request URL unchanged (proxy/CONNECT form)", () => {
    expect(buildAbsoluteUrl("http://other.example/x", base))
      .toBe("http://other.example/x");
  });

  it("handles trailing slash on baseUrl", () => {
    expect(buildAbsoluteUrl("/note.md", "http://pod.example:3000/"))
      .toBe("http://pod.example:3000/note.md");
  });

  it("treats undefined or empty request url as root", () => {
    expect(buildAbsoluteUrl(undefined, base)).toBe("http://pod.example:3000/");
    expect(buildAbsoluteUrl("", base)).toBe("http://pod.example:3000/");
  });
});

describe("isUnderBaseUrl", () => {
  const base = "http://pod.example:3000";

  it("accepts URLs at and under the baseUrl", () => {
    expect(isUnderBaseUrl("http://pod.example:3000/", base)).toBe(true);
    expect(isUnderBaseUrl("http://pod.example:3000/note.md", base)).toBe(true);
    expect(isUnderBaseUrl("http://pod.example:3000/a/b/c", base)).toBe(true);
  });

  it("rejects URLs on a different host", () => {
    expect(isUnderBaseUrl("http://other.example/", base)).toBe(false);
    expect(isUnderBaseUrl("http://pod.example:3001/note.md", base)).toBe(false);
  });

  it("rejects baseUrl-prefix string matches that are not actually under base", () => {
    expect(isUnderBaseUrl("http://pod.example:3000.evil.com/x", base)).toBe(false);
  });

  it("handles trailing slash on baseUrl", () => {
    expect(isUnderBaseUrl("http://pod.example:3000/x", "http://pod.example:3000/")).toBe(true);
  });
});

describe("fsPathFromUrl", () => {
  const base = "http://pod.example:3000";

  it("strips baseUrl + leading slash to give a filesystem-relative path", () => {
    expect(fsPathFromUrl("http://pod.example:3000/vault/note.md", base))
      .toBe("vault/note.md");
  });

  it("returns empty string for the baseUrl root", () => {
    expect(fsPathFromUrl("http://pod.example:3000/", base)).toBe("");
  });

  it("drops query strings", () => {
    expect(fsPathFromUrl("http://pod.example:3000/note.md?ext=timemap", base))
      .toBe("note.md");
  });

  it("URL-decodes percent-encoded characters (spaces, colons)", () => {
    expect(fsPathFromUrl("http://pod.example:3000/has%20space.md", base))
      .toBe("has space.md");
    expect(fsPathFromUrl("http://pod.example:3000/x%3Ay.md", base))
      .toBe("x:y.md");
  });

  it("throws when URL is not under baseUrl (caller validates with isUnderBaseUrl first)", () => {
    expect(() => fsPathFromUrl("http://other.example/x", base)).toThrow();
  });
});
