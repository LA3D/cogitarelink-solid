import type { ChangeOp } from "./commit-msg";

export interface MementoRecord {
  hash: string;
  datetime: Date;
  op?: ChangeOp;
  message?: string;
}

export interface GitOptions {
  cwd: string;
}
