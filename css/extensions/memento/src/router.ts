import { fromRFC7231 } from "./datetime";
import { getMementoStringFromUri, isTimemapRequest, stripMementoQuery } from "./uri";

export type MementoDecision =
  | { kind: "passthrough" }
  | { kind: "timegate"; location: string; datetime: Date }
  | { kind: "memento"; version: string; path: string }
  | { kind: "timemap"; path: string };

export interface RouterInput {
  method: string;
  url: string;
  acceptDatetime: string | null;
}

export function decide(input: RouterInput): MementoDecision {
  if (input.method !== "GET") return { kind: "passthrough" };

  const version = getMementoStringFromUri(input.url);
  if (version) {
    return { kind: "memento", version, path: stripMementoQuery(input.url) };
  }

  if (isTimemapRequest(input.url)) {
    return { kind: "timemap", path: stripMementoQuery(input.url) };
  }

  if (input.acceptDatetime) {
    try {
      const dt = fromRFC7231(input.acceptDatetime);
      return { kind: "timegate", location: input.url, datetime: dt };
    } catch {
      return { kind: "passthrough" };
    }
  }

  return { kind: "passthrough" };
}
