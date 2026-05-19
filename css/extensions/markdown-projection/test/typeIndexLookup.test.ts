import { describe, it, expect } from "vitest";
import { resolveThingClass, DEFAULT_WIKI_TYPE_INDEX } from "../src/typeIndexLookup.js";

describe("resolveThingClass", () => {
  const typeIndex = {
    "/vault/wiki/concepts/": "http://www.w3.org/2004/02/skos/core#Concept",
    "/vault/wiki/people/": "https://schema.org/Person",
    "/vault/wiki/places/": "https://schema.org/Place",
    "/vault/wiki/events/": "https://schema.org/Event",
    "/vault/wiki/organizations/": "https://schema.org/Organization",
    "/vault/wiki/procedures/": "https://schema.org/HowTo",
    "/vault/wiki/working/": "https://pod.vardeman.me/vault/ontology/wiki#WorkingNote",
  };

  it("resolves Thing class from container path", () => {
    const cls = resolveThingClass(
      "/vault/wiki/concepts/foo.md",
      typeIndex,
      undefined,
    );
    expect(cls).toBe("http://www.w3.org/2004/02/skos/core#Concept");
  });

  it("prefers frontmatter type over container", () => {
    const cls = resolveThingClass(
      "/vault/wiki/concepts/foo.md",
      typeIndex,
      "https://chuck.example/biz/Equipment",
    );
    expect(cls).toBe("https://chuck.example/biz/Equipment");
  });

  it("returns undefined for unknown container without frontmatter", () => {
    const cls = resolveThingClass(
      "/vault/some-other-place/foo.md",
      typeIndex,
      undefined,
    );
    expect(cls).toBeUndefined();
  });

  it("matches longest container prefix", () => {
    const cls = resolveThingClass(
      "/vault/wiki/concepts/subtopic/foo.md",
      typeIndex,
      undefined,
    );
    expect(cls).toBe("http://www.w3.org/2004/02/skos/core#Concept");
  });
});

// A.2: DEFAULT_WIKI_TYPE_INDEX tests
describe("DEFAULT_WIKI_TYPE_INDEX", () => {
  it("maps /vault/wiki/concepts/ to skos:Concept", () => {
    const cls = resolveThingClass(
      "/vault/wiki/concepts/foo.md",
      DEFAULT_WIKI_TYPE_INDEX,
      undefined,
    );
    expect(cls).toBe("http://www.w3.org/2004/02/skos/core#Concept");
  });

  it("maps /vault/wiki/people/ to schema:Person", () => {
    const cls = resolveThingClass(
      "/vault/wiki/people/jane.md",
      DEFAULT_WIKI_TYPE_INDEX,
      undefined,
    );
    expect(cls).toBe("https://schema.org/Person");
  });

  it("maps /vault/wiki/places/ to schema:Place", () => {
    expect(resolveThingClass("/vault/wiki/places/nd.md", DEFAULT_WIKI_TYPE_INDEX, undefined))
      .toBe("https://schema.org/Place");
  });

  it("maps /vault/wiki/events/ to schema:Event", () => {
    expect(resolveThingClass("/vault/wiki/events/conf.md", DEFAULT_WIKI_TYPE_INDEX, undefined))
      .toBe("https://schema.org/Event");
  });

  it("maps /vault/wiki/organizations/ to schema:Organization", () => {
    expect(resolveThingClass("/vault/wiki/organizations/nd.md", DEFAULT_WIKI_TYPE_INDEX, undefined))
      .toBe("https://schema.org/Organization");
  });

  it("maps /vault/wiki/procedures/ to schema:HowTo", () => {
    expect(resolveThingClass("/vault/wiki/procedures/how.md", DEFAULT_WIKI_TYPE_INDEX, undefined))
      .toBe("https://schema.org/HowTo");
  });

  it("maps /vault/wiki/working/ to wiki:WorkingNote", () => {
    expect(resolveThingClass("/vault/wiki/working/scratch.md", DEFAULT_WIKI_TYPE_INDEX, undefined))
      .toBe("https://pod.vardeman.me/vault/ontology/wiki#WorkingNote");
  });

  it("returns undefined for unknown paths", () => {
    expect(resolveThingClass("/vault/some-other/foo.md", DEFAULT_WIKI_TYPE_INDEX, undefined))
      .toBeUndefined();
  });

  it("frontmatter type overrides DEFAULT_WIKI_TYPE_INDEX container lookup", () => {
    const cls = resolveThingClass(
      "/vault/wiki/concepts/foo.md",
      DEFAULT_WIKI_TYPE_INDEX,
      "https://chuck.example/biz/Equipment",
    );
    expect(cls).toBe("https://chuck.example/biz/Equipment");
  });
});
