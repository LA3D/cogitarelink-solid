export type ChangeOp = "create" | "update" | "delete";

export interface ChangeEvent {
  op: ChangeOp;
  identifier: string;
  webid?: string;
}

export function formatCommitMessage(event: ChangeEvent): string {
  const subject = `${event.op} ${event.identifier}`;
  if (!event.webid) return subject;
  return `${subject}\n\nWebID: ${event.webid}`;
}
