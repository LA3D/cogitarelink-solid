import { describe, it, expect } from "vitest";
import { RepresentationMetadata } from "@solid/community-server";
import { DataFactory } from "n3";
import { CurationLinkMetadataWriter } from "../src/CurationLinkMetadataWriter";

const { namedNode } = DataFactory;
const MEM_HAS_OPEN_ACTION = namedNode(
  "https://pod.vardeman.me/vault/ontology/mem#hasOpenAction",
);
const SCHEMA_MAIN_ENTITY = namedNode("https://schema.org/mainEntity");

function makeInput(identifier: string, actionUrls: string[]) {
  const metadata = new RepresentationMetadata(namedNode(identifier));
  for (const a of actionUrls) {
    metadata.add(MEM_HAS_OPEN_ACTION, namedNode(a));
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
  } as unknown as Parameters<CurationLinkMetadataWriter["handle"]>[0]["response"];
  return { metadata, response, headers };
}

describe("CurationLinkMetadataWriter", () => {
  const writer = new CurationLinkMetadataWriter("http://localhost:3000");

  it("emits one Link per mem:hasOpenAction value with rel = predicate IRI", async () => {
    const actionUrl =
      "http://localhost:3000/id/.operations/proposal-orcid-2026.ttl";
    const { metadata, response, headers } = makeInput(
      "http://localhost:3000/id/schemes/orcid",
      [actionUrl],
    );
    await writer.handle({ metadata, response } as any);
    expect(headers.link).toBeDefined();
    const link = headers.link!.join(", ");
    expect(link).toContain(
      `<${actionUrl}>; rel="${MEM_HAS_OPEN_ACTION.value}"`,
    );
  });

  it("emits nothing when mem:hasOpenAction is absent", async () => {
    const { metadata, response, headers } = makeInput(
      "http://localhost:3000/id/schemes/orcid",
      [],
    );
    await writer.handle({ metadata, response } as any);
    expect(headers.link).toBeUndefined();
  });

  it("emits nothing when identifier is outside baseUrl", async () => {
    const { metadata, response, headers } = makeInput(
      "http://other.example/id/schemes/orcid",
      ["http://localhost:3000/id/.operations/proposal-orcid.ttl"],
    );
    await writer.handle({ metadata, response } as any);
    expect(headers.link).toBeUndefined();
  });

  it("emits two Link values for two open actions", async () => {
    const action1 = "http://localhost:3000/id/.operations/proposal-a.ttl";
    const action2 = "http://localhost:3000/id/.operations/proposal-b.ttl";
    const { metadata, response, headers } = makeInput(
      "http://localhost:3000/id/schemes/orcid",
      [action1, action2],
    );
    await writer.handle({ metadata, response } as any);
    const link = headers.link!.join(", ");
    expect(link).toContain(
      `<${action1}>; rel="${MEM_HAS_OPEN_ACTION.value}"`,
    );
    expect(link).toContain(
      `<${action2}>; rel="${MEM_HAS_OPEN_ACTION.value}"`,
    );
  });

  // D96 (SP2-T11): the listener now places the back-pointer on the page's
  // schema:mainEntity (<#this>) for wiki-lane resources. The writer must still
  // surface it — a <#this>-subject pointer is invisible to metadata.getAll
  // (which is <>-subject-bound), so the writer reads both subjects.
  it("emits Link when the back-pointer sits on the <#this> mainEntity subject", async () => {
    const page = "http://localhost:3000/vault/wiki/concepts/probe.md";
    const actionUrl = "http://localhost:3000/vault/wiki/.operations/p1.ttl";
    const { metadata, response, headers } = makeInput(page, []);
    metadata.add(SCHEMA_MAIN_ENTITY, namedNode(`${page}#this`));
    metadata.addQuad(namedNode(`${page}#this`), MEM_HAS_OPEN_ACTION, namedNode(actionUrl));

    await writer.handle({ metadata, response } as any);
    expect(headers.link).toBeDefined();
    expect(headers.link!.join(", ")).toContain(
      `<${actionUrl}>; rel="${MEM_HAS_OPEN_ACTION.value}"`,
    );
  });

  it("does not double-emit when the same action sits on both subjects", async () => {
    const page = "http://localhost:3000/vault/wiki/concepts/probe.md";
    const actionUrl = "http://localhost:3000/vault/wiki/.operations/p1.ttl";
    const { metadata, response, headers } = makeInput(page, [actionUrl]);
    metadata.add(SCHEMA_MAIN_ENTITY, namedNode(`${page}#this`));
    metadata.addQuad(namedNode(`${page}#this`), MEM_HAS_OPEN_ACTION, namedNode(actionUrl));

    await writer.handle({ metadata, response } as any);
    const links = headers.link!.join(", ").split(", ").filter((l) => l.includes(actionUrl));
    expect(links.length).toBe(1);
  });
});
