/**
 * Hook for surfacing post-projection body edges to the memory-substrate
 * trigger pipeline. Implemented by mem-trigger; consumed by markdown-projection's
 * listener after MetaWriter.replaceGoverned completes. Default binding is a
 * no-op so markdown-projection works in environments where mem-trigger is
 * not installed.
 *
 * The `edges` array carries body-projected (predicate, object) pairs for the
 * <#this> subject of the resource (per D95 Thing-as-top-class).
 *
 * See docs/superpowers/specs/2026-05-20-mem-trigger-detector-wiring-design.md.
 */
/**
 * Declared as abstract class (not interface) so componentsjs-generator emits
 * a valid Class descriptor rather than an AbstractClass that fails at boot.
 * See MEMORY.md "Components.js cannot instantiate TypeScript interface".
 */
export abstract class IPostProjectionHook {
  public abstract onEdgesWritten(input: {
    subject: string;
    edges: Array<{ predicate: string; object: string }>;
    timestamp: Date;
  }): Promise<void>;
}
