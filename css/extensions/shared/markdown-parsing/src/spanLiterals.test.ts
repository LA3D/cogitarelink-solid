import { describe, it, expect } from "vitest";
import { parseSpanLiterals } from "./spanLiterals.js";

describe("parseSpanLiterals", () => {
  it("parses a single-bracket literal span with a predicate hint", () => {
    expect(parseSpanLiterals("The term is [Photosynthesis]{.prefLabel}."))
      .toEqual([{ text: "Photosynthesis", pred: "prefLabel", lang: undefined, datatype: undefined }]);
  });
  it("does NOT match a wikilink [[X]]{.pred}", () => {
    expect(parseSpanLiterals("See [[Photosynthesis]]{.broader}.")).toEqual([]);
  });
  it("does NOT match a markdown link [text](url) or ref link [text][id]", () => {
    expect(parseSpanLiterals("[label](http://x) and [label][ref]")).toEqual([]);
  });
  it("parses a language tag", () => {
    expect(parseSpanLiterals("[Photosynthèse]{.altLabel@fr}"))
      .toEqual([{ text: "Photosynthèse", pred: "altLabel", lang: "fr", datatype: undefined }]);
  });
  it("parses a datatype CURIE", () => {
    expect(parseSpanLiterals("[2026-06-02]{.startDate^^xsd:date}"))
      .toEqual([{ text: "2026-06-02", pred: "startDate", lang: undefined, datatype: "xsd:date" }]);
  });
  it("does not parse span-literals inside code spans", () => {
    const spans = parseSpanLiterals("[live]{.prefLabel} `[ex]{.prefLabel}`");
    expect(spans.map(s => s.text)).toEqual(["live"]);
  });
});
