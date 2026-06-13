import { describe, it, expect } from "vitest";
import { DataFactory } from "n3";
import type { Quad } from "n3";
import { subtractProjected, pairShadow } from "../src/projectionDelta";

const { namedNode, literal, quad } = DataFactory;

const PAGE = "https://p.example/x.md";
const THIS = `${PAGE}#this`;
const q = (s: string, p: string, o: string, lit = false) =>
  quad(namedNode(s), namedNode(p), lit ? literal(o) : namedNode(o));

const PREF = "http://www.w3.org/2004/02/skos/core#prefLabel";
const BROADER = "http://www.w3.org/2004/02/skos/core#broader";

describe("subtractProjected", () => {
  it("removes exactly the old projection, term-equal", () => {
    const oldProj = [q(THIS, PREF, "Old", true), q(THIS, BROADER, "https://p.example/a.md#this")];
    const current = [...oldProj, q(THIS, "https://p.example/agent#note", "kept", true)];
    const out = subtractProjected(current, oldProj);
    expect(out).toHaveLength(1);
    expect(out[0].predicate.value).toBe("https://p.example/agent#note");
  });

  it("agent triple using a GOVERNED predicate on a foreign subject survives", () => {
    const oldProj = [q(THIS, PREF, "X", true)];
    const foreign = q("https://p.example/other#it", PREF, "Agent-asserted", true);
    const out = subtractProjected([...oldProj, foreign], oldProj);
    expect(out).toEqual([foreign]);
  });

  it("agent triple identical to a projected triple is removed with it (coincidence rule, spec §5)", () => {
    const t = q(THIS, BROADER, "https://p.example/b.md#this");
    expect(subtractProjected([t], [t])).toHaveLength(0);
  });

  it("literals differing only in datatype are NOT term-equal (no false subtraction)", () => {
    const plain = quad(namedNode(THIS), namedNode(PREF), literal("L"));
    const typed = quad(namedNode(THIS), namedNode(PREF),
      literal("L", namedNode("http://www.w3.org/2001/XMLSchema#token")));
    expect(subtractProjected([typed], [plain])).toHaveLength(1);
  });

  it("empty old projection (first write) subtracts nothing", () => {
    const cur = [q(THIS, PREF, "New", true)];
    expect(subtractProjected(cur, [])).toEqual(cur);
  });

  it("idempotency: (S − f(b)) ∪ f(b) has the same canonical set as S ∪ f(b)", () => {
    const fb = [q(THIS, PREF, "L", true)];
    const s = [...fb, q(THIS, "https://p.example/agent#note", "n", true)];
    const once = [...subtractProjected(s, fb), ...fb];
    expect(new Set(once.map(String)).size).toBe(new Set(s.map(String)).size);
  });
});

describe("pairShadow (degraded mode — spec §5)", () => {
  it("removes only quads matching (subject, predicate) pairs the NEW projection emits", () => {
    const newProj = [q(THIS, PREF, "New", true)];
    const current = [
      q(THIS, PREF, "Stale", true),
      q(THIS, BROADER, "https://p.example/old.md#this"),
      q("https://p.example/other#it", PREF, "foreign", true),
    ];
    const out = pairShadow(current, newProj);
    expect(out.map((x) => x.predicate.value + "|" + x.subject.value).sort()).toEqual([
      `${BROADER}|${THIS}`,
      `${PREF}|https://p.example/other#it`,
    ].sort());
  });

  it("pair-shadow may leave residue for pairs the new body dropped — documented limitation", () => {
    // A stale broader edge survives when the new projection has no broader pair at all:
    // this is WHY degraded mode must emit a curation signal (Task 5).
    const out = pairShadow([q(THIS, BROADER, "https://p.example/old.md#this")], []);
    expect(out).toHaveLength(1);
  });
});
