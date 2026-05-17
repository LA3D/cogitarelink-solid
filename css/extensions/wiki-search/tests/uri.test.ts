import { describe, it, expect } from "vitest";
import { isUnderBaseUrl, isInWikiSubtree, buildPagingUrl } from "../src/uri";

describe("uri helpers", () => {
  const baseUrl = "https://pod.vardeman.me";

  describe("isUnderBaseUrl", () => {
    it("true for URLs under base", () => {
      expect(isUnderBaseUrl("https://pod.vardeman.me/vault/wiki/", baseUrl)).toBe(true);
    });
    it("false for off-host URLs", () => {
      expect(isUnderBaseUrl("https://other.example/x", baseUrl)).toBe(false);
    });
    it("ignores trailing slash on base", () => {
      expect(isUnderBaseUrl("https://pod.vardeman.me/x", "https://pod.vardeman.me/")).toBe(true);
    });
  });

  describe("isInWikiSubtree", () => {
    it("true for /vault/wiki/ itself", () => {
      expect(isInWikiSubtree("https://pod.vardeman.me/vault/wiki/")).toBe(true);
    });
    it("true for /vault/wiki/pages/", () => {
      expect(isInWikiSubtree("https://pod.vardeman.me/vault/wiki/pages/")).toBe(true);
    });
    it("true for /vault/wiki/pages/foo.md", () => {
      expect(isInWikiSubtree("https://pod.vardeman.me/vault/wiki/pages/foo.md")).toBe(true);
    });
    it("false for /vault/profile/", () => {
      expect(isInWikiSubtree("https://pod.vardeman.me/vault/profile/")).toBe(false);
    });
    it("false for /vault/", () => {
      expect(isInWikiSubtree("https://pod.vardeman.me/vault/")).toBe(false);
    });
  });

  describe("buildPagingUrl", () => {
    it("preserves existing params, updates startIndex", () => {
      const url = buildPagingUrl(
        "https://pod.vardeman.me/vault/wiki/?ext=search-grep&oslc.searchTerms=%22x%22&oslc.pageSize=25",
        50,
      );
      expect(url).toContain("oslc.startIndex=50");
      expect(url).toContain("oslc.pageSize=25");
      expect(url).toContain("oslc.searchTerms=%22x%22");
      expect(url).toContain("ext=search-grep");
    });
    it("overwrites existing startIndex", () => {
      const url = buildPagingUrl(
        "https://pod.vardeman.me/vault/wiki/?ext=search-grep&oslc.searchTerms=%22x%22&oslc.startIndex=0",
        25,
      );
      expect(url).toMatch(/oslc\.startIndex=25/);
      expect(url).not.toMatch(/oslc\.startIndex=0/);
    });
  });
});
