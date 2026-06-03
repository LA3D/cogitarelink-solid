import { describe, it, expect } from "vitest";
import { extractWikilinks } from "./wikilinks.js";

describe("extractWikilinks", () => {
  it("extracts a plain wikilink", () => {
    const refs = extractWikilinks("see [[Context Graphs]] for details");
    expect(refs.map(r => r.title)).toEqual(["Context Graphs"]);
  });
  it("extracts a wikilink with a class hint", () => {
    const refs = extractWikilinks("[[Photosynthesis]]{.broader}");
    expect(refs).toEqual([{ title: "Photosynthesis", classHint: "broader" }]);
  });
  it("does not extract wikilinks inside code spans", () => {
    const refs = extractWikilinks("real [[A]]{.broader} but `code [[B]]{.broader}`");
    expect(refs.map(r => r.title)).toEqual(["A"]);
  });
});
