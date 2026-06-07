import { describe, it, expect } from "vitest";
import { getProfileToken, stripProfileQuery } from "../src/uri";

describe("getProfileToken", () => {
  it("extracts the token", () => {
    expect(getProfileToken("https://p.me/vault/wiki/concepts/x?_profile=fused")).toBe("fused");
  });
  it("handles other params", () => {
    expect(getProfileToken("https://p.me/r?a=1&_profile=doc")).toBe("doc");
  });
  it("returns undefined when absent", () => {
    expect(getProfileToken("https://p.me/r")).toBeUndefined();
  });
});

describe("stripProfileQuery", () => {
  it("removes only _profile", () => {
    expect(stripProfileQuery("https://p.me/r?a=1&_profile=doc")).toBe("https://p.me/r?a=1");
    expect(stripProfileQuery("https://p.me/r?_profile=doc")).toBe("https://p.me/r");
  });
});
