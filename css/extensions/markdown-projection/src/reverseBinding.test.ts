import { describe, it, expect } from "vitest";
import { buildReverseBinding, suggestGrammar } from "./reverseBinding";

it("inverts the token→predicate binding", () => {
  const fwd = { prefLabel: "http://www.w3.org/2004/02/skos/core#prefLabel" };
  const rev = buildReverseBinding(fwd);
  expect(rev["http://www.w3.org/2004/02/skos/core#prefLabel"]).toBe("prefLabel");
});
it("suggests grammar for a missing predicate", () => {
  const rev = buildReverseBinding({ prefLabel: "http://www.w3.org/2004/02/skos/core#prefLabel" });
  expect(suggestGrammar("http://www.w3.org/2004/02/skos/core#prefLabel", rev))
    .toBe('add [<value>]{.prefLabel}');
});
