import { MetadataWriter, type MetadataWriterInput, addHeader } from "@solid/community-server";
import { DataFactory } from "n3";
import { isUnderBaseUrl } from "./uri";

const { namedNode } = DataFactory;
// dct:conformsTo — not in CSS's DC subset, so construct directly
const DCT_CONFORMS_TO = namedNode("http://purl.org/dc/terms/conformsTo");

/**
 * Emits one `Link: rel="profile"` header per `dct:conformsTo` value on the
 * response's RepresentationMetadata. Composes additively with CSS's
 * LinkRelMetadataWriter via `addHeader`.
 *
 * Per D86: the Link header is a faithful reflection of what the resource
 * declares via dct:conformsTo, not a server-fabricated path-based claim.
 * Per RFC 6906: profile URIs are identifiers; presence asserts conformance
 * without requiring dereference.
 */
export class ProfileLinkMetadataWriter extends MetadataWriter {
  private readonly baseUrl: string;

  public constructor(baseUrl: string) {
    super();
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  public async handle(input: MetadataWriterInput): Promise<void> {
    const id = input.metadata.identifier?.value;
    if (!id || !isUnderBaseUrl(id, this.baseUrl)) return;

    const profiles = input.metadata.getAll(DCT_CONFORMS_TO);
    if (profiles.length === 0) return;

    const links = profiles.map((p) => `<${p.value}>; rel="profile"`);
    addHeader(input.response, "Link", links);
  }
}
