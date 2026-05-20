// CommonJS-loadable per markdown-projection's src-cjs convention.
//
// Source of truth for the IPostProjectionHook interface:
//   css/extensions/mem-trigger/src/hooks/IPostProjectionHook.ts
// Inline type repeated here because cross-package TypeScript imports don't
// resolve (no root workspace, mem-trigger dist not built). See Task 2
// (IUnprocessableWriteHook / NoOpUnprocessableWriteHook) for precedent.

type PostProjectionHookInput = {
  subject: string;
  edges: Array<{ predicate: string; object: string }>;
  timestamp: Date;
};

export class NoOpPostProjectionHook {
  public async onEdgesWritten(_input: PostProjectionHookInput): Promise<void> {
    // Intentional no-op. Real hook lives in mem-trigger.
  }
}
