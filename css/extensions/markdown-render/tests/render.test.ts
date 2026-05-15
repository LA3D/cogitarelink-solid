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

  it("renders untyped wikilinks with class=wikilink only (D75: no RDFa)", async () => {
    const md = "See [[Context Graphs]] for background.";
    const html = await renderMarkdown(md);
    expect(html).toContain("class=\"wikilink\"");
    // D75: no RDFa properties in rendered HTML
    expect(html).not.toContain("property=");
    expect(html).toContain("href=\"http://pod.vardeman.me:3000/vault/resources/concepts/context-graphs.md\"");
    expect(html).toContain(">Context Graphs</a>");
  });

  it("renders typed wikilinks with semantic CSS classes (D75)", async () => {
    const md = [
      "Based on [[Zhang 2025 RLM]]{.source}, RLM agents benefit.",
      "This contradicts [[RAG as default]]{.criticizes}.",
      "It extends [[Progressive Disclosure]]{.extends}.",
    ].join("\n\n");
    const html = await renderMarkdown(md);
    expect(html).toContain("class=\"wikilink wikilink-source\"");
    expect(html).toContain("class=\"wikilink wikilink-criticizes\"");
    expect(html).toContain("class=\"wikilink wikilink-extends\"");
    // D75: no RDFa properties in rendered HTML
    expect(html).not.toContain("property=");
  });

  it("does not attach RDFa prefix on html element (D75)", async () => {
    const html = await renderMarkdown("Body");
    expect(html).not.toMatch(/prefix="/);
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
    expect(html).toContain("class=\"wikilink wikilink-criticizes\"");
    expect(html).toContain("class=\"wikilink wikilink-extends\"");
    // D75: no RDFa properties in rendered HTML
    expect(html).not.toContain("property=");
  });

  it("does not break on text without any wikilinks", async () => {
    const html = await renderMarkdown("Just regular markdown with **bold** text.");
    expect(html).toContain("<strong>bold</strong>");
    // No wikilink <a> elements in the body (stylesheet link in <head> is expected)
    expect(html).not.toContain("class=\"wikilink\"");
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
