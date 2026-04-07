import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../src/render.js";

describe("renderMarkdown", () => {
  it("strips YAML frontmatter from output", async () => {
    const md = [
      "---",
      "type: concept-note",
      "tags: [memory, agents]",
      "---",
      "",
      "# Hello",
      "",
      "Body text.",
    ].join("\n");
    const html = await renderMarkdown(md);
    expect(html).not.toContain("type: concept-note");
    expect(html).not.toContain("tags:");
    expect(html).toContain("<h1>Hello</h1>");
    expect(html).toContain("Body text.");
  });

  it("renders untyped wikilinks with default skos:related predicate", async () => {
    const md = "See [[Context Graphs]] for background.";
    const html = await renderMarkdown(md);
    expect(html).toContain("class=\"wikilink\"");
    expect(html).toContain("property=\"skos:related\"");
    expect(html).toContain("href=\"http://pod.vardeman.me:3000/vault/resources/concepts/context-graphs.md\"");
    expect(html).toContain(">Context Graphs</a>");
  });

  it("renders typed wikilinks with the right predicate", async () => {
    const md = [
      "Based on [[Zhang 2025 RLM]]{.source}, RLM agents benefit.",
      "This contradicts [[RAG as default]]{.criticizes}.",
      "It extends [[Progressive Disclosure]]{.extends}.",
    ].join("\n\n");
    const html = await renderMarkdown(md);
    expect(html).toContain("property=\"dct:source\"");
    expect(html).toContain("property=\"vault:criticizes\"");
    expect(html).toContain("property=\"vault:extends\"");
  });

  it("attaches RDFa CURIE prefixes on the html element", async () => {
    const html = await renderMarkdown("Body");
    expect(html).toMatch(/<html[^>]+prefix="[^"]*skos:[^"]*dct:[^"]*vault:[^"]*"/);
  });

  it("preserves wikilink alias as link text", async () => {
    const md = "See [[Context Graphs|context graph theory]]{.related}.";
    const html = await renderMarkdown(md);
    expect(html).toContain(">context graph theory</a>");
    expect(html).toContain("data-target=\"Context Graphs\"");
  });

  it("handles multiple wikilinks in a single paragraph", async () => {
    const md = "Compare [[Context Graphs]] with [[RLM]]{.criticizes} and [[Progressive Disclosure]]{.extends}.";
    const html = await renderMarkdown(md);
    expect(html).toContain(">Context Graphs</a>");
    expect(html).toContain(">RLM</a>");
    expect(html).toContain(">Progressive Disclosure</a>");
    expect(html).toContain("property=\"vault:criticizes\"");
    expect(html).toContain("property=\"vault:extends\"");
  });

  it("does not break on text without any wikilinks", async () => {
    const html = await renderMarkdown("Just regular markdown with **bold** text.");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).not.toContain("wikilink");
  });

  it("emits a complete HTML document with title", async () => {
    const html = await renderMarkdown("Body", { title: "My Title" });
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>My Title</title>");
    expect(html).toContain("</html>");
  });

  it("renders GFM tables, not literal pipes", async () => {
    const md = [
      "| Aspect | RAG | PD |",
      "|--------|-----|-----|",
      "| Style  | top-k | bounded |",
    ].join("\n");
    const html = await renderMarkdown(md);
    expect(html).toContain("<table>");
    expect(html).toContain("<th>Aspect</th>");
    expect(html).toContain("<td>bounded</td>");
  });
});
