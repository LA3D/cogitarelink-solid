import { describe, it, expect } from "vitest";
import { parseMeta } from "../src/parse.js";
import { renderCard } from "../src/render.js";

const SAMPLE_TTL = `
@prefix dct: <http://purl.org/dc/terms/> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix vault: <https://pod.vardeman.me/vault/ontology#> .

<http://pod.vardeman.me:3000/vault/resources/concepts/context-graphs.md>
  a vault:ConceptNote ;
  dct:title "Context Graphs" ;
  dct:description "Semantic context layers for AI agents" ;
  dct:format "text/markdown" ;
  skos:related <http://pod.vardeman.me:3000/vault/resources/concepts/progressive-disclosure.md> ;
  vault:extends <http://pod.vardeman.me:3000/vault/resources/concepts/structure-first-memory-architecture.md> .
`;

const PDF_TTL = `
@prefix dct: <http://purl.org/dc/terms/> .

<http://pod.vardeman.me:3000/vault/uploads/thesis.pdf>
  dct:title "PhD Thesis Draft" ;
  dct:format "application/pdf" ;
  dct:created "2026-04-01"^^<http://www.w3.org/2001/XMLSchema#date> .
`;

describe("renderCard", () => {
  it("includes the resource title in the document", () => {
    const html = renderCard(parseMeta(SAMPLE_TTL));
    expect(html).toContain("<title>Context Graphs</title>");
    expect(html).toContain("<h1>Context Graphs</h1>");
  });

  it("renders the description", () => {
    const html = renderCard(parseMeta(SAMPLE_TTL));
    expect(html).toContain("Semantic context layers for AI agents");
  });

  it("shows the format as a metadata field", () => {
    const html = renderCard(parseMeta(SAMPLE_TTL));
    expect(html).toContain("text/markdown");
  });

  it("renders typed relationships grouped by label", () => {
    const html = renderCard(parseMeta(SAMPLE_TTL));
    expect(html).toContain("Related");
    expect(html).toContain("Extends");
    expect(html).toContain("progressive-disclosure.md");
    expect(html).toContain("structure-first-memory-architecture.md");
  });

  it("includes a link to the underlying resource", () => {
    const html = renderCard(parseMeta(SAMPLE_TTL));
    expect(html).toContain("Open underlying resource");
    expect(html).toContain('href="http://pod.vardeman.me:3000/vault/resources/concepts/context-graphs.md"');
  });

  it("works for non-markdown content (PDF) — proves the fallback role", () => {
    const html = renderCard(parseMeta(PDF_TTL));
    expect(html).toContain("PhD Thesis Draft");
    expect(html).toContain("application/pdf");
    expect(html).toContain("2026-04-01");
    expect(html).toContain("Open underlying resource");
  });

  it("escapes HTML in title to prevent injection", () => {
    const ttl = `
      @prefix dct: <http://purl.org/dc/terms/> .
      <http://example/x> dct:title "Hello <script>alert(1)</script>" .
    `;
    const html = renderCard(parseMeta(ttl));
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("emits a complete HTML document", () => {
    const html = renderCard(parseMeta(SAMPLE_TTL));
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("</html>");
    expect(html.indexOf("<style>")).toBeGreaterThan(-1);
  });

  it("respects color-scheme dark/light via CSS custom properties", () => {
    const html = renderCard(parseMeta(SAMPLE_TTL));
    expect(html).toContain("color-scheme: light dark");
  });
});
