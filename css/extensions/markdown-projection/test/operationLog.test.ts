import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import * as path from "path";
import { findLatestAction } from "../src/operationLog.js";

const TGT = "https://pod.vardeman.me/vault/wiki/concepts/decay-theory.md";
const OPS_BASE = "https://pod.vardeman.me/vault/wiki/.operations/";

function announcement(target: string, action: string, published: string): string {
  return `@prefix as: <https://www.w3.org/ns/activitystreams#> .
@prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
<> a as:Announce, ${action} ;
   as:object <${target}> ;
   as:published "${published}"^^xsd:dateTime .`;
}

describe("findLatestAction", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), "ops-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("returns undefined when the ops dir is missing", () => {
    expect(findLatestAction(path.join(dir, "nope"), TGT, OPS_BASE)).toBeUndefined();
  });

  it("returns undefined when no announcement targets the resource", () => {
    writeFileSync(path.join(dir, "op-1.ttl"),
      announcement("https://pod.vardeman.me/vault/wiki/concepts/other.md",
                   "mem:CrystallizeAction", "2026-05-25T10:00:00Z"));
    expect(findLatestAction(dir, TGT, OPS_BASE)).toBeUndefined();
  });

  it("returns the action for a matching announcement, with dereferenceable URL", () => {
    writeFileSync(path.join(dir, "op-1.ttl"),
      announcement(TGT, "mem:CrystallizeAction", "2026-05-25T10:00:00Z"));
    const a = findLatestAction(dir, TGT, OPS_BASE);
    expect(a).toBeDefined();
    expect(a!.actionType).toBe("https://pod.vardeman.me/vault/ontology/mem#CrystallizeAction");
    expect(a!.activityUrl).toBe(OPS_BASE + "op-1.ttl");
    expect(a!.publishedAt).toBe("2026-05-25T10:00:00Z");
  });

  it("returns the latest by as:published when multiple target the resource", () => {
    writeFileSync(path.join(dir, "op-early.ttl"),
      announcement(TGT, "mem:CrystallizeAction", "2026-05-25T10:00:00Z"));
    writeFileSync(path.join(dir, "op-late.ttl"),
      announcement(TGT, "mem:SupersedeAction", "2026-06-01T09:00:00Z"));
    const a = findLatestAction(dir, TGT, OPS_BASE);
    expect(a!.actionType).toBe("https://pod.vardeman.me/vault/ontology/mem#SupersedeAction");
    expect(a!.activityUrl).toBe(OPS_BASE + "op-late.ttl");
  });

  it("ignores container internals (dotfiles) and non-ttl files", () => {
    writeFileSync(path.join(dir, ".meta"), "broken { not turtle");
    writeFileSync(path.join(dir, "README.txt"), "ignore me");
    writeFileSync(path.join(dir, "op-1.ttl"),
      announcement(TGT, "mem:CrystallizeAction", "2026-05-25T10:00:00Z"));
    expect(findLatestAction(dir, TGT, OPS_BASE)!.actionType)
      .toBe("https://pod.vardeman.me/vault/ontology/mem#CrystallizeAction");
  });

  it("ignores triples whose subject is not the announcement URL (multi-subject hardening)", () => {
    // <> = CrystallizeAction targeting TGT (the legitimate announcement)
    // <urn:noise> = SupersedeAction also referencing TGT via as:object (stray subject)
    // findLatestAction must return the <> subject's action, not the stray's.
    const multiSubject = `@prefix as: <https://www.w3.org/ns/activitystreams#> .
@prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
<> a as:Announce, mem:CrystallizeAction ;
   as:object <${TGT}> ;
   as:published "2026-05-25T10:00:00Z"^^xsd:dateTime .
<urn:noise> a mem:SupersedeAction ;
   as:object <${TGT}> ;
   as:published "2026-06-01T09:00:00Z"^^xsd:dateTime .`;
    writeFileSync(path.join(dir, "op-1.ttl"), multiSubject);
    const a = findLatestAction(dir, TGT, OPS_BASE);
    expect(a).toBeDefined();
    expect(a!.actionType).toBe("https://pod.vardeman.me/vault/ontology/mem#CrystallizeAction");
  });
});
