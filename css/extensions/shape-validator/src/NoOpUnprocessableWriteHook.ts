/**
 * Default no-op implementation of the unprocessable-write hook.
 * Satisfies ShaclValidator's hook slot via TypeScript structural typing
 * (no implements clause to avoid Components.js generator creating an
 * unresolvable abstract-class reference). Real hook lives in mem-trigger.
 */
export class NoOpUnprocessableWriteHook {
  public async onShaclRejection(_input: {
    targetUri: string;
    validationReport: string;
    writerWebId?: string;
    timestamp: Date;
  }): Promise<void> {
    // Intentional no-op. Real hook lives in mem-trigger.
  }
}
