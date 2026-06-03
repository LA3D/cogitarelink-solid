// Agreement guard (audit F5): every tboxPath the live config points the
// ShapeValidationStore at must correspond to a real file shipped in this
// extension's data/ dir. The config paths are CONTAINER paths
// (/community-server/extensions/shape-validator/data/<file>), so we match by
// basename against data/. The store now THROWS on an unreadable tboxPath, so a
// typo there would break the server at the first governed write — this test
// catches that typo at CI time instead. Mirrors stampAgreement.test.ts's
// config-reading pattern.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { basename, join } from "path";

const CONFIG = join(__dirname, "..", "..", "..", "config");
const DATA = join(__dirname, "..", "data");

function tboxPathsFromConfig(): string[] {
  const doc = JSON.parse(readFileSync(join(CONFIG, "solid-config.json"), "utf8"));
  const entry = (doc["@graph"] as Array<Record<string, unknown>>).find(
    (e) => e["@type"] === "ShapeValidationStore",
  );
  if (!entry) throw new Error("no ShapeValidationStore entry in solid-config.json");
  const paths = entry.tboxPaths;
  if (!Array.isArray(paths)) throw new Error("ShapeValidationStore.tboxPaths is not an array");
  return paths as string[];
}

describe("tboxPaths config/data agreement (audit F5)", () => {
  const paths = tboxPathsFromConfig();

  it("config declares at least one tboxPath", () => {
    expect(paths.length).toBeGreaterThan(0);
  });

  it.each(paths)("data file for tboxPath exists: %s", (p) => {
    expect(existsSync(join(DATA, basename(p)))).toBe(true);
  });
});
