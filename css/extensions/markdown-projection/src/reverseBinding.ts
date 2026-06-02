export function buildReverseBinding(forward: Record<string, string>): Record<string, string> {
  const rev: Record<string, string> = {};
  for (const [tok, iri] of Object.entries(forward)) rev[iri] = tok;
  return rev;
}
export function suggestGrammar(predIRI: string, reverse: Record<string, string>): string {
  const tok = reverse[predIRI];
  return tok ? `add [<value>]{.${tok}}` : `predicate ${predIRI} has no grammar token (extension surface)`;
}
