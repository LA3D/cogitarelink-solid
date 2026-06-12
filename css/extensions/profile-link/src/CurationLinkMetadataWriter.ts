import { MetadataWriter, type MetadataWriterInput, addHeader } from "@solid/community-server";
import { DataFactory } from "n3";
import { isUnderBaseUrl } from "./uri";

const { namedNode } = DataFactory;
// mem:hasOpenAction — agreement-test FOLLOWUP covers this constant vs T7 parseProposal
const MEM_HAS_OPEN_ACTION = namedNode(
  "https://pod.vardeman.me/vault/ontology/mem#hasOpenAction",
);
// D96: ops-index places the back-pointer on the page's mainEntity (<#this>) when
// declared. metadata.getAll is <>-subject-bound, so the writer reads both subjects.
const SCHEMA_MAIN_ENTITY = namedNode("https://schema.org/mainEntity");

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

    // Collect open actions from <> AND from any declared mainEntity (<#this>) — D96.
    const subjects = [input.metadata.identifier, ...input.metadata.getAll(SCHEMA_MAIN_ENTITY)];
    const dedup = new Set<string>();
    const actions = subjects
      .flatMap((s) => input.metadata.quads(s as any, MEM_HAS_OPEN_ACTION, null))
      .map((q) => q.object)
      .filter((a) => !dedup.has(a.value) && dedup.add(a.value));
    if (actions.length === 0) return;

    addHeader(
      input.response,
      "Link",
      actions.map((a) => `<${a.value}>; rel="${MEM_HAS_OPEN_ACTION.value}"`),
    );
  }
}
