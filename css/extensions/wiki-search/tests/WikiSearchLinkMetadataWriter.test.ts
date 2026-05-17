import { describe, it, expect } from "vitest";
import { WikiSearchLinkMetadataWriter } from "../src/WikiSearchLinkMetadataWriter";

function makeFakeInput(id: string) {
  const headers: Record<string, string[]> = {};
  const response = {
    hasHeader: (k: string) => k.toLowerCase() in headers,
    getHeader: (k: string) => headers[k.toLowerCase()]?.join(", "),
    setHeader: (k: string, v: string | string[]) => {
      headers[k.toLowerCase()] = Array.isArray(v) ? v : [v];
    },
    appendHeader: (k: string, v: string) => {
      const key = k.toLowerCase();
      if (!headers[key]) headers[key] = [];
      headers[key].push(v);
    },
  };
  return {
    input: {
      metadata: { identifier: { value: id } },
      response,
    },
    headers,
  };
}

describe("WikiSearchLinkMetadataWriter", () => {
  const baseUrl = "https://pod.vardeman.me";
  const writer = new WikiSearchLinkMetadataWriter(baseUrl);

  it("emits Link rel=queryBase for /vault/wiki/", async () => {
    const { input, headers } = makeFakeInput("https://pod.vardeman.me/vault/wiki/");
    await writer.handle(input as any);
    const linkVal = headers.link?.join(", ") ?? "";
    expect(linkVal).toContain('?ext=search-grep');
    expect(linkVal).toContain('rel="http://open-services.net/ns/core#queryBase"');
  });

  it("emits header for /vault/wiki/pages/", async () => {
    const { input, headers } = makeFakeInput("https://pod.vardeman.me/vault/wiki/pages/");
    await writer.handle(input as any);
    const linkVal = headers.link?.join(", ") ?? "";
    expect(linkVal).toContain('?ext=search-grep');
  });

  it("skips /vault/profile/", async () => {
    const { input, headers } = makeFakeInput("https://pod.vardeman.me/vault/profile/");
    await writer.handle(input as any);
    expect(headers.link).toBeUndefined();
  });

  it("skips off-base URLs", async () => {
    const { input, headers } = makeFakeInput("https://other.example/vault/wiki/");
    await writer.handle(input as any);
    expect(headers.link).toBeUndefined();
  });

  it("appends to existing Link header (additive composition)", async () => {
    const { input, headers } = makeFakeInput("https://pod.vardeman.me/vault/wiki/");
    // Pre-seed an existing Link header
    headers.link = ['<https://existing>; rel="x"'];
    await writer.handle(input as any);
    const allLinks = headers.link ?? [];
    expect(allLinks.length).toBeGreaterThanOrEqual(2);
    expect(allLinks.join(", ")).toContain("existing");
    expect(allLinks.join(", ")).toContain("?ext=search-grep");
  });
});
