/**
 * Hook for surfacing SHACL-rejected writes to the memory-substrate
 * trigger pipeline. Implemented by mem-trigger; consumed by shape-validator's
 * ShaclValidator. Default binding is a no-op so shape-validator works in
 * environments where mem-trigger is not installed.
 *
 * Declared as abstract class (not interface) so componentsjs-generator emits
 * a valid Class descriptor rather than an AbstractClass that fails at boot.
 * See MEMORY.md "Components.js cannot instantiate TypeScript interface".
 *
 * See docs/superpowers/specs/2026-05-20-mem-trigger-detector-wiring-design.md.
 */
export abstract class IUnprocessableWriteHook {
  public abstract onShaclRejection(input: {
    targetUri: string;
    validationReport: string;
    writerWebId?: string;
    timestamp: Date;
  }): Promise<void>;
}
