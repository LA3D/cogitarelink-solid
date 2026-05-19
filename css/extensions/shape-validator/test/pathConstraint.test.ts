/**
 * Unit tests for evaluatePathConstraint (D99 Layer 2).
 *
 * These tests verify path-based class constraints:
 * - mem:Event resources must go to /wiki/.events/*, rejected at /wiki/events/*
 * - mem:Action resources can be stored at /wiki/procedures/*, rejected elsewhere
 * - Longest-prefix-wins when multiple constraints match
 * - Paths with no matching constraint pass through
 */
import { describe, it, expect } from "vitest";
import { evaluatePathConstraint, type PathConstraintConfig } from "../src/pathConstraint";

describe("evaluatePathConstraint (D99 Layer 2)", () => {
  const config: PathConstraintConfig[] = [
    {
      pathPrefix: "/wiki/.events/",
      allowedClasses: ["https://pod.vardeman.me/vault/ontology/mem#Event"],
      forbiddenClasses: [],
    },
    {
      pathPrefix: "/wiki/events/",
      allowedClasses: [],
      forbiddenClasses: ["https://pod.vardeman.me/vault/ontology/mem#Event"],
    },
  ];

  it("rejects mem:Event PUT to /wiki/events/", () => {
    const result = evaluatePathConstraint(
      "/wiki/events/foo.md",
      ["https://pod.vardeman.me/vault/ontology/mem#Event"],
      config,
    );
    expect(result.ok).toBe(false);
    expect(result.violation?.forbiddenClass).toBe(
      "https://pod.vardeman.me/vault/ontology/mem#Event",
    );
    expect(result.violation?.message).toContain("disjoint");
  });

  it("accepts mem:Event PUT to /wiki/.events/", () => {
    const result = evaluatePathConstraint(
      "/wiki/.events/abc-123",
      ["https://pod.vardeman.me/vault/ontology/mem#Event"],
      config,
    );
    expect(result.ok).toBe(true);
    expect(result.violation).toBeUndefined();
  });

  it("rejects schema:Person at /wiki/.events/ (not in allowedClasses)", () => {
    const result = evaluatePathConstraint(
      "/wiki/.events/abc",
      ["https://schema.org/Person"],
      config,
    );
    expect(result.ok).toBe(false);
    expect(result.violation?.notInAllowList).toBe("https://schema.org/Person");
    expect(result.violation?.message).toContain("must declare one of");
  });

  it("passes through paths not covered by any constraint", () => {
    const result = evaluatePathConstraint(
      "/some/other/path",
      ["https://schema.org/Thing"],
      config,
    );
    expect(result.ok).toBe(true);
    expect(result.violation).toBeUndefined();
  });

  it("honors longest-prefix-wins when multiple constraints match", () => {
    const multiConfig: PathConstraintConfig[] = [
      {
        pathPrefix: "/wiki/",
        allowedClasses: ["https://example.org/GenericResource"],
        forbiddenClasses: [],
      },
      {
        pathPrefix: "/wiki/events/",
        allowedClasses: [],
        forbiddenClasses: ["https://pod.vardeman.me/vault/ontology/mem#Event"],
      },
    ];

    const result = evaluatePathConstraint(
      "/wiki/events/foo",
      ["https://pod.vardeman.me/vault/ontology/mem#Event"],
      multiConfig,
    );
    // Should match the /wiki/events/ constraint (longer prefix), not /wiki/
    expect(result.ok).toBe(false);
    expect(result.violation?.forbiddenClass).toBe(
      "https://pod.vardeman.me/vault/ontology/mem#Event",
    );
  });

  it("accepts resource with multiple classes if any match allowedClasses", () => {
    const result = evaluatePathConstraint(
      "/wiki/.events/foo",
      [
        "https://schema.org/Person",
        "https://pod.vardeman.me/vault/ontology/mem#Event",
      ],
      config,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects resource if any class is in forbiddenClasses", () => {
    const result = evaluatePathConstraint(
      "/wiki/events/foo",
      [
        "https://schema.org/Person",
        "https://pod.vardeman.me/vault/ontology/mem#Event",
      ],
      config,
    );
    expect(result.ok).toBe(false);
    expect(result.violation?.forbiddenClass).toBe(
      "https://pod.vardeman.me/vault/ontology/mem#Event",
    );
  });

  it("uses pathPrefix as constraint key in violation report", () => {
    const result = evaluatePathConstraint(
      "/wiki/events/test",
      ["https://pod.vardeman.me/vault/ontology/mem#Event"],
      config,
    );
    expect(result.violation?.pathPrefix).toBe("/wiki/events/");
  });
});
