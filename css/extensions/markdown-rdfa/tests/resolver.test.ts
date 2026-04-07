import { describe, it, expect } from "vitest";
import { slug, HardcodedResolver } from "../src/resolver.js";

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

describe("HardcodedResolver", () => {
  it("resolves bare titles to the concepts container", () => {
    const resolver = new HardcodedResolver("http://pod.vardeman.me:3000");
    expect(resolver.resolve("Context Graphs")).toBe(
      "http://pod.vardeman.me:3000/vault/resources/concepts/context-graphs.md",
    );
  });

  it("resolves path-style wikilinks by stripping the folder prefix", () => {
    const resolver = new HardcodedResolver("http://pod.vardeman.me:3000");
    expect(resolver.resolve("External Resources/Husain - Evals-Skills for Coding Agents")).toBe(
      "http://pod.vardeman.me:3000/vault/resources/concepts/husain---evals-skills-for-coding-agents.md",
    );
  });

  it("resolves heading-anchor wikilinks by dropping the anchor", () => {
    const resolver = new HardcodedResolver("http://pod.vardeman.me:3000");
    expect(resolver.resolve("Judge Memory#Application Multi-Hop Faithfulness")).toBe(
      "http://pod.vardeman.me:3000/vault/resources/concepts/judge-memory.md",
    );
  });
});
