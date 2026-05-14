import { MetadataWriter, type MetadataWriterInput, addHeader } from "@solid/community-server";
import { isUnderBaseUrl } from "./uri";

/**
 * Per RFC 7089 §4.1.1, every OriginalResource response advertises its TimeMap and
 * TimeGate so Memento-aware clients can discover the temporal access surface from
 * a plain GET. This writer runs alongside the default LinkRelMetadataWriter and
 * appends to the existing `Link` header (CSS `addHeader` accumulates).
 *
 * Per D61 the OriginalResource doubles as TimeGate, so we point `rel="timegate"`
 * at the same URI. `Vary: accept-datetime` is also mandated by the spec.
 */
export class MementoLinkMetadataWriter extends MetadataWriter {
  private readonly baseUrl: string;

  public constructor(baseUrl: string) {
    super();
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  public async handle(input: MetadataWriterInput): Promise<void> {
    const id = input.metadata.identifier?.value;
    if (!id || !isUnderBaseUrl(id, this.baseUrl)) return;
    const timemap = `${id}${id.includes("?") ? "&" : "?"}ext=timemap`;
    addHeader(input.response, "Link", [
      `<${timemap}>; rel="timemap"`,
      `<${id}>; rel="timegate"`,
    ]);
    addHeader(input.response, "Vary", "accept-datetime");
  }
}
