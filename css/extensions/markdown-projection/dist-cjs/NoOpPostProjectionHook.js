"use strict";
// CommonJS-loadable per markdown-projection's src-cjs convention.
//
// Source of truth for the IPostProjectionHook interface:
//   css/extensions/mem-trigger/src/hooks/IPostProjectionHook.ts
// Inline type repeated here because cross-package TypeScript imports don't
// resolve (no root workspace, mem-trigger dist not built). See Task 2
// (IUnprocessableWriteHook / NoOpUnprocessableWriteHook) for precedent.
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoOpPostProjectionHook = void 0;
class NoOpPostProjectionHook {
    async onEdgesWritten(_input) {
        // Intentional no-op. Real hook lives in mem-trigger.
    }
}
exports.NoOpPostProjectionHook = NoOpPostProjectionHook;
