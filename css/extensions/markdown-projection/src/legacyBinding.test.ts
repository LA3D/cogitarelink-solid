import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";

// G8 anti-drift guard: the legacy vault: render map (predicates.ts) is retired so there is a
// single source for the hint→predicate binding. The canonical edge map is HINT_TO_PROJECTION
// (wikilinkProjection.ts, cito:/skos:/dct:); the canonical literal binding is DEFAULT_LITERAL_BINDING
// (spanLiteralProjection.ts). The stale vault: map must not reappear as a second source.
describe("G8: legacy vault: predicate map retired (single-source binding)", () => {
  const parsingSrc = new URL("../../shared/markdown-parsing/src/", import.meta.url);

  it("predicates.ts (stale vault: render map) is deleted", () => {
    expect(existsSync(fileURLToPath(new URL("predicates.ts", parsingSrc)))).toBe(false);
  });

  it("markdown-parsing index no longer re-exports predicates", () => {
    const idx = readFileSync(fileURLToPath(new URL("index.ts", parsingSrc)), "utf8");
    expect(idx).not.toMatch(/predicates/);
  });
});
