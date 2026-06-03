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
  // Fix2b (dup-container determinism) — when the live Type Index maps the same
  // container to TWO classes (skos:Concept AND wiki:Source, as the live Pod had),
  // the result must be DETERMINISTIC regardless of N3 quad iteration order. After
  // the R1.2 live-wins flip, the default no longer overrides; parseTypeIndex sorts
  // the (container,class) pairs and keeps the first per container — here skos:Concept
  // (http: sorts before https:wiki#Source), so concepts/ stays skos:Concept stably.
  // (Was "default-wins" before R1.2; the assertion still holds, the mechanism changed.)
  // ------------------------------------------------------------------
  it("Fix2b: dup-container resolves deterministically (live-parse, not default-override)", async () => {
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
    // Deterministic — concepts/ stays skos:Concept regardless of quad order.
    expect(ti["/vault/wiki/concepts/"]).toBe("http://www.w3.org/2004/02/skos/core#Concept");
    expect(ti["/vault/wiki/concepts/"]).not.toBe(WIKI_SOURCE);
  });

  // ------------------------------------------------------------------
  // R1.2 — live wins over the baked-in default. A live registration for a path
  // that ALSO exists in the default (e.g. /vault/wiki/concepts/ → a deployer's
  // custom class) must override the default; the Pod's data model is authoritative.
  // ------------------------------------------------------------------
  it("R1.2: a live registration for a DEFAULT path overrides the default (live wins)", async () => {
    const CUSTOM = "https://deployer.example/ontology#CustomConcept";
    const liveTTL = `
      @prefix solid: <http://www.w3.org/ns/solid/terms#> .
      <#r1> a solid:TypeRegistration ;
        solid:forClass <${CUSTOM}> ;
        solid:instanceContainer </vault/wiki/concepts/> .
    `;
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve(liveTTL) } as any),
    ));
    const loader = new TypeIndexLoader("https://pod.example/vault");
    const ti = await loader.getTypeIndex();
    // Live registration wins over the default skos:Concept for this container.
    expect(ti["/vault/wiki/concepts/"]).toBe(CUSTOM);
  });

  // ------------------------------------------------------------------
  // R1.2 — a DEFAULT path absent from the live index falls back to the default.
  // The default still fills gaps when live is partial (the bootstrap role).
  // ------------------------------------------------------------------
  it("R1.2: a DEFAULT path absent from live falls back to the default", async () => {
    // Live registers only people/ (with a custom class); concepts/ is absent.
    const liveTTL = `
      @prefix solid: <http://www.w3.org/ns/solid/terms#> .
      <#r1> a solid:TypeRegistration ;
        solid:forClass <https://deployer.example/ontology#Staff> ;
        solid:instanceContainer </vault/wiki/people/> .
    `;
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve(liveTTL) } as any),
    ));
    const loader = new TypeIndexLoader("https://pod.example/vault");
    const ti = await loader.getTypeIndex();
    // people/ overridden by live …
    expect(ti["/vault/wiki/people/"]).toBe("https://deployer.example/ontology#Staff");
    // … but concepts/ (absent from live) falls back to the default.
    expect(ti["/vault/wiki/concepts/"]).toBe("http://www.w3.org/2004/02/skos/core#Concept");
  });

  // ------------------------------------------------------------------
  // R4 — the loader's default map tracks the injected storage base, not a baked
  // /vault literal. A non-/vault storage root yields default keys under that root.
  // ------------------------------------------------------------------
  it("R4: default fallback keys derive from the injected storage base (not hardcoded /vault)", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({ ok: false, status: 404 } as any),
    ));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const loader = new TypeIndexLoader("https://pod.example/store");
    const ti = await loader.getTypeIndex();
    expect(ti["/store/wiki/concepts/"]).toBe("http://www.w3.org/2004/02/skos/core#Concept");
    expect(ti["/vault/wiki/concepts/"]).toBeUndefined();
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
