import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "../src/EventEmitter";

const SAMPLE_TURTLE = `@prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .
<urn:uuid:00000000-0000-0000-0000-000000000001> a mem:UnprocessableWrite .
`;

const EVENTS_CONTAINER = "https://pod.example/vault/wiki/.events/";

interface FakeStore {
  setRepresentation: ReturnType<typeof vi.fn>;
}

function fakeStore(): FakeStore {
  return { setRepresentation: vi.fn().mockResolvedValue(new Map()) };
}

describe("EventEmitter", () => {
  it("writes the Turtle to a uniquely-named file under the events container", async () => {
    const store = fakeStore();
    const emitter = new EventEmitter({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      store: store as any,
      eventsContainer: EVENTS_CONTAINER,
    });

    await emitter.emit(SAMPLE_TURTLE);

    expect(store.setRepresentation).toHaveBeenCalledTimes(1);
    const [identifier, representation] = store.setRepresentation.mock.calls[0]!;
    expect(identifier.path.startsWith(EVENTS_CONTAINER)).toBe(true);
    expect(identifier.path.endsWith(".ttl")).toBe(true);
    expect(representation.binary).toBe(true);
    // content-type lives in metadata
    expect(representation.metadata.contentType).toBe("text/turtle");
    // Read the data stream content
    const chunks: Buffer[] = [];
    for await (const chunk of representation.data) {
      chunks.push(Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks).toString("utf8");
    expect(body).toBe(SAMPLE_TURTLE);
  });

  it("generated filenames are sortable (ISO timestamp prefix)", async () => {
    const store = fakeStore();
    const emitter = new EventEmitter({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      store: store as any,
      eventsContainer: EVENTS_CONTAINER,
    });
    await emitter.emit(SAMPLE_TURTLE);
    await emitter.emit(SAMPLE_TURTLE);
    const path1 = store.setRepresentation.mock.calls[0]![0].path;
    const path2 = store.setRepresentation.mock.calls[1]![0].path;
    // ISO timestamps sort lexicographically; the two filenames must be unique
    expect(path1).not.toBe(path2);
    // Both should match the YYYY-MM-DDTHH-MM-SS-... pattern in the filename
    const filename1 = path1.substring(EVENTS_CONTAINER.length);
    expect(filename1).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
