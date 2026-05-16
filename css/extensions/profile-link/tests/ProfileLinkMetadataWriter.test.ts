import { describe, it, expect } from "vitest";
import { RepresentationMetadata } from "@solid/community-server";
import { DataFactory } from "n3";
import { ProfileLinkMetadataWriter } from "../src/ProfileLinkMetadataWriter";

const { namedNode } = DataFactory;
const DCT_CONFORMS_TO = namedNode("http://purl.org/dc/terms/conformsTo");

function makeInput(identifier: string, conformsTo: string[]) {
  const metadata = new RepresentationMetadata(namedNode(identifier));
  for (const c of conformsTo) {
    metadata.add(DCT_CONFORMS_TO, namedNode(c));
  }
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
  } as unknown as Parameters<ProfileLinkMetadataWriter["handle"]>[0]["response"];
  return { metadata, response, headers };
}

describe("ProfileLinkMetadataWriter", () => {
  const writer = new ProfileLinkMetadataWriter("http://localhost:3000");

  it("emits one Link header per dct:conformsTo value", async () => {
    const { metadata, response, headers } = makeInput(
      "http://localhost:3000/vault/meta/shapes/page.shacl.ttl",
      ["https://www.w3.org/TR/shacl/"],
    );
    await writer.handle({ metadata, response } as any);
    expect(headers.link).toBeDefined();
    expect(headers.link!.join(", ")).toContain('<https://www.w3.org/TR/shacl/>; rel="profile"');
  });

  it("emits multiple Link values for multi-valued conformsTo", async () => {
    const { metadata, response, headers } = makeInput(
      "http://localhost:3000/vault/wiki/pages/x",
      [
        "https://pod.vardeman.me/vault/meta/profiles/concept",
        "https://solidproject.org/TR/protocol",
      ],
    );
    await writer.handle({ metadata, response } as any);
    const link = headers.link!.join(", ");
    expect(link).toContain('<https://pod.vardeman.me/vault/meta/profiles/concept>; rel="profile"');
    expect(link).toContain('<https://solidproject.org/TR/protocol>; rel="profile"');
  });

  it("emits nothing when identifier is outside baseUrl", async () => {
    const { metadata, response, headers } = makeInput(
      "http://other.example/foo",
      ["https://example.org/profile"],
    );
    await writer.handle({ metadata, response } as any);
    expect(headers.link).toBeUndefined();
  });

  it("emits nothing when no dct:conformsTo present", async () => {
    const { metadata, response, headers } = makeInput(
      "http://localhost:3000/vault/wiki/pages/x",
      [],
    );
    await writer.handle({ metadata, response } as any);
    expect(headers.link).toBeUndefined();
  });
});
