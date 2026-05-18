import { describe, it, expect, vi } from "vitest";
import { WikiSearchHttpHandler } from "../src/WikiSearchHttpHandler";

// The handler's canHandle is path-only — easy to test without injecting CSS.
// canHandle never touches the engine/store/permissionReader/credentialsExtractor;
// the empty placeholders are safe for these path-only unit tests. Full
// orchestration is exercised by the integration tests in Task 12.
describe("WikiSearchHttpHandler.canHandle", () => {
  const handler = new WikiSearchHttpHandler(
    {} as any,  // engine
    {} as any,  // dataAccessor
    {} as any,  // permissionReader
    {} as any,  // credentialsExtractor
    "https://pod.vardeman.me",
  );

  it("claims GET with ?ext=search-grep on a container URL", async () => {
    const input = {
      request: {
        method: "GET",
        url: "/vault/wiki/?ext=search-grep&oslc.searchTerms=%22x%22",
      } as any,
      response: {} as any,
    };
    await expect(handler.canHandle(input as any)).resolves.toBeUndefined();
  });

  it("rejects GET on resource URL (no trailing slash)", async () => {
    const input = {
      request: {
        method: "GET",
        url: "/vault/wiki/foo.md?ext=search-grep",
      } as any,
      response: {} as any,
    };
    await expect(handler.canHandle(input as any)).rejects.toThrow();
  });

  it("rejects POST", async () => {
    const input = {
      request: {
        method: "POST",
        url: "/vault/wiki/?ext=search-grep",
      } as any,
      response: {} as any,
    };
    await expect(handler.canHandle(input as any)).rejects.toThrow();
  });

  it("rejects when ?ext=search-grep is absent", async () => {
    const input = {
      request: { method: "GET", url: "/vault/wiki/" } as any,
      response: {} as any,
    };
    await expect(handler.canHandle(input as any)).rejects.toThrow();
  });

  it("rejects container outside /vault/wiki/ subtree", async () => {
    const input = {
      request: { method: "GET", url: "/vault/profile/?ext=search-grep" } as any,
      response: {} as any,
    };
    await expect(handler.canHandle(input as any)).rejects.toThrow();
  });
});
