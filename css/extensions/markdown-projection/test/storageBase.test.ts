import { describe, it, expect } from "vitest";
import { MarkdownProjectionListener } from "../src-cjs/listener.js";

// RQ-Substrate-4 Phase 3 / D107 §4.4 — the storage root is injected via
// Components.js (storagePath param), not hardcoded as /vault in TS source.
// These tests assert the derived storageBase tracks the injected storagePath.

function make(baseUrl: string, storagePath?: string): MarkdownProjectionListener {
    // store is typed-only (MonitoringStore) and untouched by the constructor /
    // storageBase getter; a stub is sufficient.
    return new (MarkdownProjectionListener as any)(
        {} as any, baseUrl, "/data", undefined, storagePath,
    );
}

describe("MarkdownProjectionListener storageBase", () => {
    it("defaults to /vault when storagePath is omitted (behaviour unchanged)", () => {
        expect(make("https://pod.example").storageBase).toBe("https://pod.example/vault");
    });

    it("derives from a non-default injected storagePath (not hardcoded /vault)", () => {
        const sb = make("https://pod.example", "/store").storageBase;
        expect(sb).toBe("https://pod.example/store");
        expect(sb).not.toContain("/vault");
    });

    it("trims a trailing slash on baseUrl and normalises storagePath", () => {
        expect(make("https://pod.example/", "/vault/").storageBase)
            .toBe("https://pod.example/vault");
    });

    it("adds a leading slash when storagePath omits it", () => {
        expect(make("https://pod.example", "data").storageBase)
            .toBe("https://pod.example/data");
    });
});
