// Inline copy of IUnprocessableWriteHook — interface erases at compile time.
// Source of truth: css/extensions/mem-trigger/src/hooks/IUnprocessableWriteHook.ts
interface IUnprocessableWriteHook {
  onShaclRejection(input: {
    targetUri: string;
    validationReport: string;
    writerWebId?: string;
    timestamp: Date;
  }): Promise<void>;
}

export class NoOpUnprocessableWriteHook implements IUnprocessableWriteHook {
  public async onShaclRejection(_input: {
    targetUri: string;
    validationReport: string;
    writerWebId?: string;
    timestamp: Date;
  }): Promise<void> {
    // Intentional no-op. Real hook lives in mem-trigger.
  }
}
