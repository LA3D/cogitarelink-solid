export const TRAILER_MARKER = "<!-- pod:notice";
export const TRAILER_END = "<!-- /pod:notice -->";

export interface OpenAction {
  op: string;
  type: string;
  rationale?: string;
}

export function renderTrailer(actions: OpenAction[]): string {
  const n = actions.length;
  const lines = actions.map((a) =>
    `> ${a.type} <${a.op}>${a.rationale ? ` — "${a.rationale}"` : ""}`);
  return [
    "",
    `${TRAILER_MARKER} — server-managed; do not include this block in writes -->`,
    `> ⚠ ${n} open action${n === 1 ? "" : "s"} on this resource:`,
    ...lines,
    `> Full graph + state: ?_profile=fused · all views: ?_profile=alt`,
    TRAILER_END,
    "",
  ].join("\n");
}
