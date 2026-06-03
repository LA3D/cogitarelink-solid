// Pathological-construct parity suite (audit R5 / R-T3).
//
// The point of R-T3: projection now parses with the SAME machinery as render, so
// constructs that render inert (code, link destinations, HTML blocks, autolinks)
// must NOT project. This suite asserts the projection extractors return ONLY the
// live tokens for each construct, plus the positive cases that SHOULD project.
//
// These replace the old maskCodeSpans unit tests (fenced + inline) and extend
// coverage to the gaps the mask never closed (indented code, link destinations,
// HTML blocks, autolinks, blockquote-fences).
import { describe, it, expect } from "vitest";
import { extractWikilinks } from "./wikilinks.js";
import { parseSpanLiterals } from "./spanLiterals.js";

const wikis = (body: string) => extractWikilinks(body).map((r) => r.title);
const spans = (body: string) => parseSpanLiterals(body).map((s) => s.text);

describe("wikilink extraction excludes structurally-inert constructs", () => {
  it("indented (4-space) code block does NOT project", () => {
    const body = "para [[Live]]{.broader}\n\n    [[Z]]{.broader}\n\nafter";
    expect(wikis(body)).toEqual(["Live"]);
  });

  it("fenced code block does NOT project (old codeSpans case)", () => {
    const body = "a\n```\n[[Z]]{.broader}\n```\nb [[W]]{.broader}";
    expect(wikis(body)).toEqual(["W"]);
  });

  it("fenced block with CRLF line endings does NOT project (old codeSpans case)", () => {
    const body = "a\r\n```\r\n[[Z]]{.broader}\r\n```\r\nb [[W]]{.broader}";
    expect(wikis(body)).toEqual(["W"]);
  });

  it("fenced block ending the file with no trailing newline does NOT project (old codeSpans case)", () => {
    const body = "intro [[W]]{.broader}\n\n```\n[[Z]]{.broader}\n```";
    expect(wikis(body)).toEqual(["W"]);
  });

  it("inline code does NOT project (old codeSpans case)", () => {
    const body = "real [[A]]{.broader} but `code [[B]]{.broader}`";
    expect(wikis(body)).toEqual(["A"]);
  });

  it("a fence INSIDE a blockquote does NOT project, but quoted prose does", () => {
    const body = "> ```\n> [[Z]]{.broader}\n> ```\n>\n> quoted [[W]]{.related} prose";
    expect(wikis(body)).toEqual(["W"]);
  });

  it("a 4+ backtick fence does NOT project", () => {
    const body = "a [[W]]{.broader}\n\n````\n[[Z]]{.broader} ```\n````";
    expect(wikis(body)).toEqual(["W"]);
  });

  it("a wikilink in a link DESTINATION does NOT project; the outside one does", () => {
    const body = "[t](http://x/[[N]]) and [[M]]{.broader}";
    expect(wikis(body)).toEqual(["M"]);
  });

  it("a wikilink inside an HTML block does NOT project; outside it does", () => {
    const body = "<div>\n[[Z]]{.broader}\n</div>\n\n[[W]]{.broader}";
    expect(wikis(body)).toEqual(["W"]);
  });
});

describe("wikilink extraction keeps live tokens in real text contexts", () => {
  it("plain paragraph", () => {
    expect(wikis("see [[Context Graphs]] for details")).toEqual(["Context Graphs"]);
  });

  it("list items", () => {
    const body = "- [[Alpha]]{.broader}\n- [[Beta]]{.related}";
    expect(wikis(body)).toEqual(["Alpha", "Beta"]);
  });

  it("blockquote PROSE (only its code children are excluded — matches render)", () => {
    expect(wikis("> quoted [[W]]{.related} prose")).toEqual(["W"]);
  });

  it("alias form preserves the target, not the display label", () => {
    expect(wikis("[[Context Graphs|context graph theory]]{.related}")).toEqual(["Context Graphs"]);
  });
});

describe("span-literal extraction excludes structurally-inert constructs", () => {
  it("inline code does NOT project (old codeSpans case)", () => {
    expect(spans("[live]{.prefLabel} `[ex]{.prefLabel}`")).toEqual(["live"]);
  });

  it("fenced code block does NOT project", () => {
    const body = "[live]{.prefLabel}\n\n```\n[ex]{.prefLabel}\n```";
    expect(spans(body)).toEqual(["live"]);
  });

  it("indented (4-space) code block does NOT project", () => {
    const body = "[live]{.prefLabel}\n\n    [ex]{.prefLabel}\n\nafter";
    expect(spans(body)).toEqual(["live"]);
  });

  it("a fence inside a blockquote does NOT project, but quoted prose does", () => {
    const body = "> ```\n> [ex]{.prefLabel}\n> ```\n>\n> [quoted]{.altLabel} prose";
    expect(spans(body)).toEqual(["quoted"]);
  });

  it("an HTML block does NOT project; outside it does", () => {
    const body = "<div>\n[ex]{.prefLabel}\n</div>\n\n[live]{.altLabel}";
    expect(spans(body)).toEqual(["live"]);
  });
});

describe("span-literal extraction keeps live tokens + grammar features", () => {
  it("plain predicate hint", () => {
    expect(parseSpanLiterals("The term is [Photosynthesis]{.prefLabel}."))
      .toEqual([{ text: "Photosynthesis", pred: "prefLabel", lang: undefined, datatype: undefined }]);
  });

  it("language tag", () => {
    expect(parseSpanLiterals("[Photosynthèse]{.altLabel@fr}"))
      .toEqual([{ text: "Photosynthèse", pred: "altLabel", lang: "fr", datatype: undefined }]);
  });

  it("datatype CURIE", () => {
    expect(parseSpanLiterals("[2026-06-02]{.startDate^^xsd:date}"))
      .toEqual([{ text: "2026-06-02", pred: "startDate", lang: undefined, datatype: "xsd:date" }]);
  });

  it("does NOT match a wikilink [[X]]{.pred}", () => {
    expect(parseSpanLiterals("See [[Photosynthesis]]{.broader}.")).toEqual([]);
  });

  it("does NOT match a markdown link or ref link", () => {
    expect(parseSpanLiterals("[label](http://x) and [label][ref]")).toEqual([]);
  });
});

describe("frontmatter guard", () => {
  // The projection pipeline hands these extractors the POST-frontmatter body
  // (splitFrontmatter). But the parser registers remark-frontmatter so that even
  // a body that still carries a leading `---` YAML block parses cleanly (the YAML
  // becomes a frontmatter node, not a thematic-break/heading mess) and the tokens
  // in the real body are still found.
  it("a leading YAML frontmatter block is ignored; body tokens still project", () => {
    const body = "---\ntype: concept-note\ntitle: [bracketed, in, yaml]\n---\n\n# Heading\n\n[[Live]]{.broader} and [Photosynthesis]{.prefLabel}";
    expect(wikis(body)).toEqual(["Live"]);
    expect(spans(body)).toEqual(["Photosynthesis"]);
  });

  it("a bare fragment with no block context still parses (sub-string callers)", () => {
    expect(spans("[x]{.prefLabel}")).toEqual(["x"]);
    expect(wikis("[[X]]{.broader}")).toEqual(["X"]);
  });
});
