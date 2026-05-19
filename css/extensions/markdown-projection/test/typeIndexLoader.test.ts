import { describe, it, expect, vi, beforeEach } from "vitest";
import { TypeIndexLoader } from "../src/typeIndexLoader.js";
import { DEFAULT_WIKI_TYPE_INDEX } from "../src/typeIndexLookup.js";

describe("TypeIndexLoader", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
