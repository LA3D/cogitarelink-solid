export type ChangeOp = "create" | "update" | "delete";

// NOTE (audit L1): a `webid` field + `WebID:` commit trailer used to live here,
// but it was dead at runtime. The only caller is MementoCommitListener, which
// derives its event from the CSS MonitoringStore `changed` event. That event's
// RepresentationMetadata is built fresh by DataAccessorBasedStore
// (`addActivityMetadata`/`addContainerActivity`) and carries ONLY the AS
// activity term (plus `as:object` for container Add/Remove) — the acting
// agent's credentials/WebID never reach the store layer's ChangeMap. With no
// runtime source for a WebID, the trailer branch could never fire. Removed per
// no-stubs (no tested-but-unreachable code). If actor attribution is wanted,
// it must be threaded from the request/operation context above the store, not
// recovered here.
export interface ChangeEvent {
  op: ChangeOp;
  identifier: string;
}

export function formatCommitMessage(event: ChangeEvent): string {
  return `${event.op} ${event.identifier}`;
}
