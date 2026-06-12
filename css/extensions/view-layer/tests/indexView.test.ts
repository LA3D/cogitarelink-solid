import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it, expect } from "vitest";
import { DataFactory } from "n3";
import { buildIndexMarkdown, INDEX_QUERY, INDEX_FRONTMATTER_TYPE } from "../src/indexView";

const { namedNode, literal, quad } = DataFactory;
const C = "https://pod.example/vault/wiki/concepts/";

function conceptQuads(slug: string, label: string, definition?: string) {
  const thing = namedNode(`${C}${slug}.md#this`);
  const qs = [
    quad(thing, namedNode("http://www.w3.org/2004/02/skos/core#prefLabel"), literal(label)),
  ];
  if (definition) {
    qs.push(quad(thing, namedNode("http://www.w3.org/2004/02/skos/core#definition"), literal(definition)));
  }
  return qs;
}

describe("buildIndexMarkdown", () => {
  it("emits one definition line per member, sorted by label", () => {
    const quads = [
      ...conceptQuads("zzz", "Zebra Topic", "Stripes for memory."),
      ...conceptQuads("aaa", "Aardvark Topic", "Digs for facts."),
    ];
    const md = buildIndexMarkdown(C, quads);
    const lines = md.trim().split("\n").filter((l) => l.startsWith("- "));
    expect(lines).toEqual([
      "- [Aardvark Topic](aaa.md) — Digs for facts.",
      "- [Zebra Topic](zzz.md) — Stripes for memory.",
    ]);
  });

  it("falls back to the bare link with no definition", () => {
    const md = buildIndexMarkdown(C, conceptQuads("bare", "Bare"));
    expect(md).toContain("- [Bare](bare.md)");
    expect(md).not.toContain("— undefined");
  });

  it("uses only the FIRST sentence of a multi-sentence definition", () => {
    const md = buildIndexMarkdown(C, conceptQuads("multi", "Multi", "First sentence. Second sentence."));
    expect(md).toContain("— First sentence.");
    expect(md).not.toContain("Second sentence");
  });

  it("skips the index resource itself", () => {
    const quads = [
      ...conceptQuads("index", "The Index"),
      ...conceptQuads("real", "Real", "A real one."),
    ];
    const md = buildIndexMarkdown(C, quads);
    expect(md).not.toContain("(index.md)");
  });

  it("subjects outside the container are ignored", () => {
    const stray = quad(
      namedNode("https://pod.example/vault/contacts/x.ttl#this"),
      namedNode("https://schema.org/name"), literal("Stray"));
    const md = buildIndexMarkdown(C, [...conceptQuads("real", "Real", "Yes."), stray]);
    expect(md).not.toContain("Stray");
  });

  it("INDEX_QUERY declares the label/definition projection", () => {
    for (const term of ["prefLabel", "definition", "schema.org/", "name", "description", "OPTIONAL"]) {
      expect(INDEX_QUERY).toContain(term);
    }
  });

  it("emits frontmatter typing the index as sub:ContainerIndex (SP2 amendment: honestly-typed substrate document)", () => {
    const md = buildIndexMarkdown(C, conceptQuads("a", "A"));
    // Frontmatter MUST be first so splitFrontmatter recognises it; the sub: CURIE
    // resolves through the projection's existing CURIE_PREFIXES map — frontmatter
    // type WINS over the container's D98 class fallback, so no shape targets it.
    expect(md.startsWith(`---\ntype: ${INDEX_FRONTMATTER_TYPE}\n---\n`)).toBe(true);
    expect(INDEX_FRONTMATTER_TYPE).toBe("sub:ContainerIndex");
  });

  it("the header marks the document as derived with provenance pointer", () => {
    const md = buildIndexMarkdown(C, conceptQuads("a", "A"));
    expect(md.toLowerCase()).toContain("derived");
    expect(md).toContain(".meta");
  });

  it("container's own <container#this> subject (empty doc segment) produces NO index line", () => {
    // Regression: before the !doc guard, <container#this> produced "- [Self]()" with empty href.
    const selfSubject = namedNode(`${C}#this`);
    const selfQuads = [
      quad(selfSubject, namedNode("http://www.w3.org/2004/02/skos/core#prefLabel"), literal("Self")),
    ];
    const md = buildIndexMarkdown(C, [...selfQuads, ...conceptQuads("real", "Real")]);
    const lines = md.trim().split("\n").filter((l) => l.startsWith("- "));
    expect(lines.every((l) => !l.includes("()"))).toBe(true);
    expect(lines.some((l) => l.includes("Self"))).toBe(false);
  });

  it("label containing brackets — pinned current behavior (known limitation: brackets produce malformed markdown links)", () => {
    // known limitation: brackets in labels produce malformed markdown links; pinned, not endorsed
    const quads = [
      quad(
        namedNode(`${C}skos.md#this`),
        namedNode("http://www.w3.org/2004/02/skos/core#prefLabel"),
        literal("SKOS [2004]"),
      ),
    ];
    const md = buildIndexMarkdown(C, quads);
    const line = md.trim().split("\n").find((l) => l.startsWith("- "));
    expect(line).toBe("- [SKOS [2004]](skos.md)");
  });

  it("abbreviation definition — pinned current first-sentence behavior (splits at first dot+space boundary)", () => {
    // known limitation: the lookbehind regex splits at the first dot followed by space,
    // so "e.g. something. Real sentence." yields "e.g." as the first sentence; pinned, not endorsed
    const quads = [
      quad(
        namedNode(`${C}eg.md#this`),
        namedNode("http://www.w3.org/2004/02/skos/core#prefLabel"),
        literal("EG"),
      ),
      quad(
        namedNode(`${C}eg.md#this`),
        namedNode("http://www.w3.org/2004/02/skos/core#definition"),
        literal("e.g. something. Real sentence."),
      ),
    ];
    const md = buildIndexMarkdown(C, quads);
    const line = md.trim().split("\n").find((l) => l.startsWith("- "));
    expect(line).toBe("- [EG](eg.md) — e.g.");
  });

  it("descriptor quotes INDEX_QUERY verbatim (declared-query agreement)", () => {
    const ttl = readFileSync(
      resolve(__dirname, "../../../../overlays/wiki-memory/views/container-index.ttl"), "utf8");
    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
    expect(normalize(ttl)).toContain(normalize(INDEX_QUERY));
  });
});
