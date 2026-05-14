export interface MementoRecord {
  hash: string;
  datetime: Date;
  message?: string;
}

export interface GitOptions {
  cwd: string;
}
