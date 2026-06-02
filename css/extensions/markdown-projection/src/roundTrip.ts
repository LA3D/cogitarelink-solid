import { Quad } from "n3";
import { buildReverseBinding } from "./reverseBinding.js";

// Round-trip oracle (dev/test tool only — NOT a served endpoint; the served graph→markdown reverse
// direction stays absent per the spec, sub-project D / no-stubs). Regenerates the inline grammar
// from a set of governed quads, for a deterministic lossy/ambiguity check on the forward projection.
//
// Fidelity: LITERAL objects round-trip losslessly (`[value]{.tok}`). RESOURCE-edge objects recover
// the predicate token but the link label is the URI's final slug — label→slug→URI is not reversible,
// so the original wikilink label is NOT recovered. That lossiness is exactly what this oracle exists
// to surface; callers compare the regenerated grammar against the source to flag it.
export function regenerateGrammar(quads: Quad[], pageUrl: string, forward: Record<string, string>): string {
  const rev = buildReverseBinding(forward);
  return quads
    .map((q) => {
      const tok = rev[q.predicate.value];
      if (!tok) return "";
      if (q.object.termType === "Literal") return `[${q.object.value}]{.${tok}}`;
      return `[[${q.object.value.split("/").pop()}]]{.${tok}}`;
    })
    .filter(Boolean)
    .join("\n");
}
