import { describe, it, expect } from "vitest";
import { slug, HardcodedResolver } from "../../shared/markdown-parsing/src/resolver.js";

describe("slug", () => {
  it("lowercases and hyphenates simple titles", () => {
    expect(slug("Context Graphs")).toBe("context-graphs");
  });

  it("handles multi-word titles with hyphens already present", () => {
    expect(slug("RLM - Recursive Language Models")).toBe("rlm---recursive-language-models");
  });

  it("drops heading anchors", () => {
    expect(slug("Judge Memory#Application Multi-Hop Faithfulness")).toBe("judge-memory");
  });

  it("drops folder prefixes (single-level)", () => {
    expect(slug("External Resources/Husain - Evals-Skills for Coding Agents")).toBe(
      "husain---evals-skills-for-coding-agents",
    );
  });

  it("drops folder prefixes (multi-level)", () => {
    expect(slug("Research & Scholarship/Projects/SOLID Pod Integration")).toBe("solid-pod-integration");
  });

  it("handles folder prefix + heading anchor together", () => {
    expect(slug("Theory/Knowledge Fabrics#Overview")).toBe("knowledge-fabrics");
  });

  it("strips non-alphanumeric characters before collapsing whitespace", () => {
    // The em-dash is removed before the surrounding whitespace is collapsed,
    // so adjacent spaces merge into a single hyphen rather than producing a
    // double hyphen. Must match the Python importer's behaviour exactly.
    expect(slug("Plant vs Animal Purines — Gout Implications")).toBe("plant-vs-animal-purines-gout-implications");
  });

  it("handles titles with ampersands correctly (single hyphen, not double)", () => {
    expect(slug("Research & Scholarship")).toBe("research-scholarship");
  });

  it("trims leading/trailing whitespace", () => {
    expect(slug("  Context Graphs  ")).toBe("context-graphs");
  });
});

// R-T2: the render resolver is now a thin adapter over the single URL minter
// (targetUrlFor). It mints the D98 /<storagePath>/wiki/<container>/ path — NOT
// the stale pre-D98 /vault/resources/concepts/ PARA path it used to (audit R1.1).
// These assertions were updated deliberately to the new (correct) URLs; the
// render href now equals the projected .meta edge IRI (proven by
// markdown-projection/test/renderProjectionAgreement.test.ts).
describe("HardcodedResolver", () => {
  it("resolves bare titles to the wiki concepts container (default routing)", () => {
    const resolver = new HardcodedResolver("https://pod.vardeman.me");
    expect(resolver.resolve("Context Graphs")).toBe(
      "https://pod.vardeman.me/vault/wiki/concepts/context-graphs.md",
    );
  });

  it("resolves path-style wikilinks by stripping the folder prefix", () => {
    const resolver = new HardcodedResolver("https://pod.vardeman.me");
    expect(resolver.resolve("External Resources/Husain - Evals-Skills for Coding Agents")).toBe(
      "https://pod.vardeman.me/vault/wiki/concepts/husain---evals-skills-for-coding-agents.md",
    );
  });

  it("resolves heading-anchor wikilinks by dropping the anchor", () => {
    const resolver = new HardcodedResolver("https://pod.vardeman.me");
    expect(resolver.resolve("Judge Memory#Application Multi-Hop Faithfulness")).toBe(
      "https://pod.vardeman.me/vault/wiki/concepts/judge-memory.md",
    );
  });

  it("routes typed wikilinks by class hint (author→people)", () => {
    const resolver = new HardcodedResolver("https://pod.vardeman.me");
    expect(resolver.resolve("Jane Researcher", "author")).toBe(
      "https://pod.vardeman.me/vault/wiki/people/jane-researcher.md",
    );
  });

  it("strips the @ citekey marker before slugifying", () => {
    const resolver = new HardcodedResolver("https://pod.vardeman.me");
    expect(resolver.resolve("@zhang-2025-rlm")).toBe(
      "https://pod.vardeman.me/vault/wiki/concepts/zhang-2025-rlm.md",
    );
  });

  it("honours a non-default storagePath", () => {
    const resolver = new HardcodedResolver("https://pod.example", "/data");
    expect(resolver.resolve("Context Graphs")).toBe(
      "https://pod.example/data/wiki/concepts/context-graphs.md",
    );
  });
});
