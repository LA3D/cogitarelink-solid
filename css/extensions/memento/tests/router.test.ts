import { describe, it, expect } from "vitest";
import { decide } from "../src/router";

describe("decide", () => {
  it("passes through plain GET with no Memento signals", () => {
    expect(decide({
      method: "GET",
      url: "http://pod/note.md",
      acceptDatetime: null,
    })).toEqual({ kind: "passthrough" });
  });

  it("passes through POST regardless of headers", () => {
    expect(decide({
      method: "POST",
      url: "http://pod/note.md",
      acceptDatetime: "Wed, 15 Apr 2026 12:00:00 GMT",
    })).toEqual({ kind: "passthrough" });
  });

  it("routes GET with Accept-Datetime to timegate decision", () => {
    const d = decide({
      method: "GET",
      url: "http://pod/note.md",
      acceptDatetime: "Wed, 15 Apr 2026 12:00:00 GMT",
    });
    expect(d.kind).toBe("timegate");
    if (d.kind !== "timegate") throw new Error("type narrow");
    expect(d.datetime.toISOString()).toBe("2026-04-15T12:00:00.000Z");
    expect(d.location).toBe("http://pod/note.md");
  });

  it("routes GET ?ext=timemap to timemap decision", () => {
    const d = decide({
      method: "GET",
      url: "http://pod/note.md?ext=timemap",
      acceptDatetime: null,
    });
    expect(d).toEqual({ kind: "timemap", path: "http://pod/note.md" });
  });

  it("routes GET ?version=YYYYMMDDHHMMSS to memento decision", () => {
    const d = decide({
      method: "GET",
      url: "http://pod/note.md?version=20260415120000",
      acceptDatetime: null,
    });
    expect(d).toEqual({
      kind: "memento",
      version: "20260415120000",
      path: "http://pod/note.md",
    });
  });

  it("prefers explicit version over accept-datetime when both present", () => {
    const d = decide({
      method: "GET",
      url: "http://pod/note.md?version=20260415120000",
      acceptDatetime: "Wed, 01 Jan 2026 00:00:00 GMT",
    });
    expect(d.kind).toBe("memento");
  });

  it("passes through if accept-datetime is malformed", () => {
    expect(decide({
      method: "GET",
      url: "http://pod/note.md",
      acceptDatetime: "not a date",
    })).toEqual({ kind: "passthrough" });
  });

  it("passes through if version param is malformed", () => {
    expect(decide({
      method: "GET",
      url: "http://pod/note.md?version=notadate",
      acceptDatetime: null,
    })).toEqual({ kind: "passthrough" });
  });

  describe("tombstone routing", () => {
    it("routes plain GET on a tombstoned path to tombstone decision", () => {
      expect(decide({
        method: "GET",
        url: "http://pod/note.md",
        acceptDatetime: null,
        isTombstoned: true,
      })).toEqual({ kind: "tombstone", path: "http://pod/note.md" });
    });

    it("ignores tombstone flag when Accept-Datetime is set — timegate wins", () => {
      const d = decide({
        method: "GET",
        url: "http://pod/note.md",
        acceptDatetime: "Wed, 15 Apr 2026 12:00:00 GMT",
        isTombstoned: true,
      });
      expect(d.kind).toBe("timegate");
    });

    it("ignores tombstone flag when ?version= is set — memento wins", () => {
      const d = decide({
        method: "GET",
        url: "http://pod/note.md?version=20260415120000",
        acceptDatetime: null,
        isTombstoned: true,
      });
      expect(d.kind).toBe("memento");
    });

    it("ignores tombstone flag when ?ext=timemap — timemap wins (TimeMap should be reachable even after deletion)", () => {
      const d = decide({
        method: "GET",
        url: "http://pod/note.md?ext=timemap",
        acceptDatetime: null,
        isTombstoned: true,
      });
      expect(d.kind).toBe("timemap");
    });

    it("does not route to tombstone for non-GET requests", () => {
      expect(decide({
        method: "DELETE",
        url: "http://pod/note.md",
        acceptDatetime: null,
        isTombstoned: true,
      })).toEqual({ kind: "passthrough" });
    });
  });
});
