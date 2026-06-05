import { MetadataWriter, type MetadataWriterInput, addHeader } from "@solid/community-server";
import { DataFactory } from "n3";
import { isUnderBaseUrl } from "./uri";

const { namedNode } = DataFactory;
// mem:hasOpenAction — agreement-test FOLLOWUP covers this constant vs T7 parseProposal
const MEM_HAS_OPEN_ACTION = namedNode(
  "https://pod.vardeman.me/vault/ontology/mem#hasOpenAction",
);

/**
 * Emits one `Link: <op-url>; rel="<mem:hasOpenAction IRI>"` per open curation action
 * on the resource (D112 §5 — the read-path surfacing seam). The predicate IRI is the
 * RFC 8288 extension relation type. Composes additively via addHeader, exactly like
 * ProfileLinkMetadataWriter.
 */
export class CurationLinkMetadataWriter extends MetadataWriter {
  private readonly baseUrl: string;

  public constructor(baseUrl: string) {
    super();
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  public async handle(input: MetadataWriterInput): Promise<void> {
    const id = input.metadata.identifier?.value;
    if (!id || !isUnderBaseUrl(id, this.baseUrl)) return;

    const actions = input.metadata.getAll(MEM_HAS_OPEN_ACTION);
    if (actions.length === 0) return;

    addHeader(
      input.response,
      "Link",
      actions.map((a) => `<${a.value}>; rel="${MEM_HAS_OPEN_ACTION.value}"`),
    );
  }
}
