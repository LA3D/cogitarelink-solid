import { describe, it, expect } from "vitest";
import { renderTrailer, TRAILER_MARKER } from "../src/trailer";

describe("renderTrailer", () => {
  it("renders count, ops, rationale, pointers", () => {
    const t = renderTrailer([{ op: "https://p.me/vault/wiki/.operations/op-17",
                               type: "mem:RealignAction",
                               rationale: "broader link targets a renamed concept" }]);
    expect(t).toContain(TRAILER_MARKER);
    expect(t).toContain("1 open action");
    expect(t).toContain(".operations/op-17");
    expect(t).toContain("renamed concept");
    expect(t).toContain("?_profile=fused");
    expect(t).toContain("?_profile=alt");
    expect(t).toContain("<!-- /pod:notice -->");
  });
  it("omits rationale line when absent", () => {
    const t = renderTrailer([{ op: "https://p.me/ops/op-1", type: "mem:RealignAction" }]);
    expect(t).not.toContain("— \"");
  });
  it("pluralizes", () => {
    const t = renderTrailer([
      { op: "https://p.me/ops/op-1", type: "mem:RealignAction" },
      { op: "https://p.me/ops/op-2", type: "mem:RealignAction" },
    ]);
    expect(t).toContain("2 open actions");
  });
});
