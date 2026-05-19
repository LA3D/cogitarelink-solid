import { describe, it, expect } from "vitest";
import { resolveThingClass } from "../src/typeIndexLookup.js";

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
