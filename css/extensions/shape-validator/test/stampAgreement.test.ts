// Drift guard: the body-hash stamp predicate is single-sourced as a default in
// code (STAMP_PRED) but the DEPLOYMENT IRI lives in config (the AdmissionFloorStore
// and MarkdownProjectionListener stampPredicate params). The floor writes the stamp
// and the listener's backstop reads it to decide whether to re-project — if the two
// config values ever diverge, the backstop silently re-projects on every write
// (lost in-band optimisation) or, worse, the listener clobbers a floor-written .meta.
// This test asserts BOTH config files declare the SAME stampPredicate AND that it
// matches the exported STAMP_PRED default, so a config edit can't drift from code.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { STAMP_PRED } from "../src/storage/AdmissionFloorStore";

const CONFIG = join(__dirname, "..", "..", "..", "config");

// Pull the `stampPredicate` value off the @graph entry with the given @id.
function stampOf(configFile: string, id: string): string {
  const doc = JSON.parse(readFileSync(join(CONFIG, configFile), "utf8"));
  const entry = (doc["@graph"] as Array<Record<string, unknown>>).find((e) => e["@id"] === id);
  if (!entry) throw new Error(`no @graph entry with @id ${id} in ${configFile}`);
  const val = entry.stampPredicate;
  if (typeof val !== "string") throw new Error(`no string stampPredicate on ${id} in ${configFile}`);
  return val;
}

describe("stampPredicate config/code agreement (drift guard)", () => {
  const floorStamp = stampOf("solid-config.json", "urn:shape-validation:default:ResourceStore_AdmissionFloor");
  const listenerStamp = stampOf("markdown-projection.json", "urn:cogitarelink:MarkdownProjectionListener");

  it("floor config stampPredicate == listener config stampPredicate", () => {
    expect(floorStamp).toBe(listenerStamp);
  });

  it("config stampPredicate == exported STAMP_PRED default", () => {
    expect(floorStamp).toBe(STAMP_PRED);
    expect(listenerStamp).toBe(STAMP_PRED);
  });
});
