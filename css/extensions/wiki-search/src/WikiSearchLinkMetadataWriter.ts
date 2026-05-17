import { MetadataWriter, type MetadataWriterInput, addHeader } from "@solid/community-server";
import { isUnderBaseUrl, isInWikiSubtree } from "./uri";

/**
 * Adds a Link: rel="queryBase" header to GET responses for containers
 * at or under /vault/wiki/. Closes the cold-start discovery loop: an
 * agent reading only HTTP headers (D55 Tier 1) finds the wiki-search
 * affordance without first reading the D83 capability catalog.
 *
 * Path-prefix dispatch — not rdf:type scan — because we cannot afford
 * to read every child's .meta on every container GET just for header
 * decoration. Path matching aligns with the affordance descriptor's
 * wiki:targetContainer </vault/wiki/> claim.
 */
export class WikiSearchLinkMetadataWriter extends MetadataWriter {
  private readonly baseUrl: string;
  private readonly queryBaseUrl: string;

  public constructor(baseUrl: string) {
    super();
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.queryBaseUrl = `${this.baseUrl}/vault/wiki/?ext=search-grep`;
  }

  public async handle(input: MetadataWriterInput): Promise<void> {
    const id = input.metadata?.identifier?.value;
    if (!id) return;
    if (!isUnderBaseUrl(id, this.baseUrl)) return;
    if (!isInWikiSubtree(id)) return;
    if (!id.endsWith("/")) return; // containers only

    addHeader(
      input.response,
      "Link",
      `<${this.queryBaseUrl}>; rel="http://open-services.net/ns/core#queryBase"; title="wiki-search"`,
    );
  }
}
