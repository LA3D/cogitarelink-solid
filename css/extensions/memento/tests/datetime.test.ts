import { describe, it, expect } from "vitest";
import {
  toMementoString,
  fromMementoString,
  toRFC7231,
  fromRFC7231,
  closestPrior,
} from "../src/datetime";

describe("toMementoString", () => {
  it("formats a UTC Date as 14-digit YYYYMMDDHHMMSS", () => {
    const d = new Date(Date.UTC(2026, 3, 15, 12, 0, 0));  // 2026-04-15T12:00:00Z
    expect(toMementoString(d)).toBe("20260415120000");
  });

  it("pads single-digit fields", () => {
    const d = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));    // 2026-01-01T00:00:00Z
    expect(toMementoString(d)).toBe("20260101000000");
  });

  it("uses UTC, not local time", () => {
    // 2026-12-31T23:59:59Z — any TZ offset would change the date in local time
    const d = new Date(Date.UTC(2026, 11, 31, 23, 59, 59));
    expect(toMementoString(d)).toBe("20261231235959");
  });
});

describe("fromMementoString", () => {
  it("parses 14-digit string to a UTC Date", () => {
    const d = fromMementoString("20260415120000");
    expect(d.toISOString()).toBe("2026-04-15T12:00:00.000Z");
  });

  it("round-trips with toMementoString", () => {
    const original = "20260301081534";
    expect(toMementoString(fromMementoString(original))).toBe(original);
  });

  it("throws on non-14-digit input", () => {
    expect(() => fromMementoString("2026041512000")).toThrow();
    expect(() => fromMementoString("notadatetime!!")).toThrow();
  });
});

describe("toRFC7231", () => {
  it("formats UTC Date as IMF-fixdate", () => {
    const d = new Date(Date.UTC(2026, 3, 15, 12, 0, 0));
    expect(toRFC7231(d)).toBe("Wed, 15 Apr 2026 12:00:00 GMT");
  });

  it("emits GMT zone literal", () => {
    const d = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
    expect(toRFC7231(d)).toMatch(/GMT$/);
  });
});

describe("fromRFC7231", () => {
  it("parses IMF-fixdate (the preferred RFC 7231 format)", () => {
    const d = fromRFC7231("Wed, 15 Apr 2026 12:00:00 GMT");
    expect(d.toISOString()).toBe("2026-04-15T12:00:00.000Z");
  });

  it("round-trips with toRFC7231", () => {
    const d1 = new Date(Date.UTC(2026, 5, 8, 17, 30, 45));
    const d2 = fromRFC7231(toRFC7231(d1));
    expect(d2.getTime()).toBe(d1.getTime());
  });

  it("throws on malformed input", () => {
    expect(() => fromRFC7231("not a date")).toThrow();
  });
});

describe("closestPrior", () => {
  const a = new Date(Date.UTC(2026, 0, 1));
  const b = new Date(Date.UTC(2026, 2, 1));
  const c = new Date(Date.UTC(2026, 5, 1));
  const all = [a, b, c];

  it("returns the latest available date at or before target", () => {
    expect(closestPrior(new Date(Date.UTC(2026, 4, 15)), all)?.getTime()).toBe(b.getTime());
  });

  it("returns null when target predates all available", () => {
    expect(closestPrior(new Date(Date.UTC(2025, 6, 1)), all)).toBeNull();
  });

  it("returns the target itself when it matches exactly", () => {
    expect(closestPrior(b, all)?.getTime()).toBe(b.getTime());
  });

  it("returns the latest when target is after all available", () => {
    expect(closestPrior(new Date(Date.UTC(2027, 0, 1)), all)?.getTime()).toBe(c.getTime());
  });

  it("handles unsorted input", () => {
    const unsorted = [c, a, b];
    expect(closestPrior(new Date(Date.UTC(2026, 4, 15)), unsorted)?.getTime()).toBe(b.getTime());
  });

  it("returns null on empty input", () => {
    expect(closestPrior(new Date(), [])).toBeNull();
  });
});
