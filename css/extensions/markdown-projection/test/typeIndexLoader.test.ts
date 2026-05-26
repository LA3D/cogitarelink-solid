import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TypeIndexLoader } from "../src/typeIndexLoader.js";
import { DEFAULT_WIKI_TYPE_INDEX } from "../src/typeIndexLookup.js";

describe("TypeIndexLoader", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ------------------------------------------------------------------
  // Fix 1 regression guard — URL construction must include caller-supplied
  // /vault base (the showstopper bug was TypeIndexLoader("serverBase") which
  // fetched /settings/publicTypeIndex with no /vault prefix → 404).
  // ------------------------------------------------------------------
  it("Fix1: fetches <podBase>/settings/publicTypeIndex (caller passes /vault-inclusive base)", async () => {
    let capturedUrl = "";
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      capturedUrl = url;
      return Promise.resolve({ ok: false, status: 404 } as any);
    }));
    const loader = new TypeIndexLoader("https://pod.example/vault");
    await loader.getTypeIndex();
    expect(capturedUrl).toBe("https://pod.example/vault/settings/publicTypeIndex");
  });

  // ------------------------------------------------------------------
  // Fix 2a — live Type Index IS consulted: a new container registered only
  // in the live doc (not in DEFAULT_WIKI_TYPE_INDEX) should appear in the
  // merged result, proving the live doc was actually read.
  // ------------------------------------------------------------------
  it("Fix2a: live Type Index is actually read — new container in live doc appears in result", async () => {
    const liveTTL = `
      @prefix solid: <http://www.w3.org/ns/solid/terms#> .
      <#r1> a solid:TypeRegistration ;
        solid:forClass <https://example.org/Widget> ;
        solid:instanceContainer </vault/wiki/widgets/> .
    `;
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve(liveTTL) } as any),
    ));
    const loader = new TypeIndexLoader("https://pod.example/vault");
    const ti = await loader.getTypeIndex();
    expect(ti["/vault/wiki/widgets/"]).toBe("https://example.org/Widget");
  });

  // ------------------------------------------------------------------
  // Fix 2b (dup-container guard) — when the live Type Index maps the same
  // container to TWO classes (skos:Concept AND wiki:Source, as the live Pod
  // had), the DEFAULT/kernel class must win (concepts/ stays skos:Concept).
  // N3 quad iteration is not document-ordered, so live-wins is non-deterministic;
  // default-wins (Fix 2) makes it stable.
  // ------------------------------------------------------------------
  it("Fix2b: default-wins merge — canonical container keeps kernel class when live has ambiguous dup", async () => {
    const WIKI_SOURCE = "https://pod.vardeman.me/vault/ontology/wiki#Source";
    const liveTTL = `
      @prefix solid: <http://www.w3.org/ns/solid/terms#> .
      @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
      @prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .
      <#r1> a solid:TypeRegistration ;
        solid:forClass skos:Concept ;
        solid:instanceContainer </vault/wiki/concepts/> .
      <#r2> a solid:TypeRegistration ;
        solid:forClass wiki:Source ;
        solid:instanceContainer </vault/wiki/concepts/> .
    `;
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve(liveTTL) } as any),
    ));
    const loader = new TypeIndexLoader("https://pod.example/vault");
    const ti = await loader.getTypeIndex();
    // Kernel default must win — concepts/ stays skos:Concept regardless of
    // which N3 quad lands last during iteration.
    expect(ti["/vault/wiki/concepts/"]).toBe("http://www.w3.org/2004/02/skos/core#Concept");
    expect(ti["/vault/wiki/concepts/"]).not.toBe(WIKI_SOURCE);
  });

  // ------------------------------------------------------------------
  // Fix 3 — loud fallback: on non-OK HTTP, console.error must be called
  // (the silent swallow was the observability bug).
  // ------------------------------------------------------------------
  it("Fix3: fallback on 404 returns DEFAULT and calls console.error (loud fallback)", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({ ok: false, status: 404 } as any),
    ));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const loader = new TypeIndexLoader("https://pod.example/vault");
    const ti = await loader.getTypeIndex();
    expect(ti).toEqual(DEFAULT_WIKI_TYPE_INDEX);
    expect(errSpy).toHaveBeenCalled();
  });

  it("returns DEFAULT_WIKI_TYPE_INDEX when fetch fails (graceful fallback)", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("connect EHOSTUNREACH")));
    const loader = new TypeIndexLoader("https://pod.example/vault");
    const ti = await loader.getTypeIndex();
    expect(ti).toEqual(DEFAULT_WIKI_TYPE_INDEX);
  });

  it("merges live Type Index with defaults", async () => {
    const liveTTL = `
      @prefix solid: <http://www.w3.org/ns/solid/terms#> .
      @prefix biz: <https://chuck.example/biz/> .
      <#biz-equipment> a solid:TypeRegistration ;
        solid:forClass biz:Equipment ;
        solid:instanceContainer <https://pod.example/biz/equipment/> .
    `;
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(liveTTL),
      } as any),
    );
    const loader = new TypeIndexLoader("https://pod.example/vault");
    const ti = await loader.getTypeIndex();
    expect(ti["/biz/equipment/"]).toBe("https://chuck.example/biz/Equipment");
    // Defaults preserved
    expect(ti["/vault/wiki/concepts/"]).toBe("http://www.w3.org/2004/02/skos/core#Concept");
  });

  it("caches the result; second call doesn't refetch", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve("") } as any),
    );
    global.fetch = fetchMock;
    const loader = new TypeIndexLoader("https://pod.example/vault");
    await loader.getTypeIndex();
    await loader.getTypeIndex();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refresh() forces a re-fetch", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve("") } as any),
    );
    global.fetch = fetchMock;
    const loader = new TypeIndexLoader("https://pod.example/vault");
    await loader.getTypeIndex();
    await loader.refresh();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back gracefully when HTTP returns non-OK status", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("Not found") } as any),
    );
    const loader = new TypeIndexLoader("https://pod.example/vault");
    const ti = await loader.getTypeIndex();
    expect(ti).toEqual(DEFAULT_WIKI_TYPE_INDEX);
  });

  it("correctly resolves relative container IRIs using pod base", async () => {
    // CSS stores instanceContainer as relative IRIs like </biz/equipment/>
    // which the N3 parser resolves against the base IRI
    const liveTTL = `
      @prefix solid: <http://www.w3.org/ns/solid/terms#> .
      @prefix biz: <https://chuck.example/biz/> .
      <#r1> a solid:TypeRegistration ;
        solid:forClass biz:Widget ;
        solid:instanceContainer </vault/biz/widgets/> .
    `;
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve(liveTTL) } as any),
    );
    const loader = new TypeIndexLoader("https://pod.example/vault");
    const ti = await loader.getTypeIndex();
    expect(ti["/vault/biz/widgets/"]).toBe("https://chuck.example/biz/Widget");
  });
});
