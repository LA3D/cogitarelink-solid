import { describe, it, expect, vi } from 'vitest';
import { ShaclValidator } from '../src/storage/validators/ShaclValidator';
import { NoOpUnprocessableWriteHook } from '../src/NoOpUnprocessableWriteHook';
import { ShaclValidationError } from '../src/error/ShaclValidationError';

interface IUnprocessableWriteHook {
  onShaclRejection(input: {
    targetUri: string;
    validationReport: string;
    writerWebId?: string;
    timestamp: Date;
  }): Promise<void>;
}

const FAKE_REPORT = '@prefix sh: <http://www.w3.org/ns/shacl#> . [] a sh:ValidationReport ; sh:conforms false .';

/**
 * Helper: directly tests the rejection branch by calling the extracted
 * invokeHookAndThrow method. This avoids the full SHACL pipeline.
 */
async function invokeRejectionPath(
  hook: IUnprocessableWriteHook,
  identifierValue: string,
): Promise<{ thrown: unknown; hookCallCount: number }> {
  const validator = new ShaclValidator(
    {} as never,  // converter — not reached
    {} as never,  // auxStrategy — not reached
    hook,
  );
  let thrown: unknown = null;
  try {
    await (validator as unknown as {
      invokeHookAndThrow(targetUri: string, reportTurtle: string): Promise<void>;
    }).invokeHookAndThrow(identifierValue, FAKE_REPORT);
  } catch (err) {
    thrown = err;
  }
  return {
    thrown,
    hookCallCount: (hook.onShaclRejection as ReturnType<typeof vi.fn>).mock.calls.length,
  };
}

describe('ShaclValidator unprocessableWrite hook integration', () => {
  it('calls hook.onShaclRejection on SHACL failure and throws ShaclValidationError', async () => {
    const hook: IUnprocessableWriteHook = {
      onShaclRejection: vi.fn().mockResolvedValue(undefined),
    };
    const result = await invokeRejectionPath(hook, 'https://example.org/x.md');
    expect(result.hookCallCount).toBe(1);
    expect(result.thrown).toBeInstanceOf(ShaclValidationError);
    const call = (hook.onShaclRejection as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.targetUri).toBe('https://example.org/x.md');
    expect(call.validationReport).toBe(FAKE_REPORT);
  });

  it('swallows hook errors and still throws ShaclValidationError', async () => {
    const hook: IUnprocessableWriteHook = {
      onShaclRejection: vi.fn().mockRejectedValue(new Error('hook crashed')),
    };
    const result = await invokeRejectionPath(hook, 'https://example.org/x.md');
    expect(result.hookCallCount).toBe(1);
    expect(result.thrown).toBeInstanceOf(ShaclValidationError);
  });

  it('uses NoOp default when no hook injected', () => {
    const validator = new ShaclValidator({} as never, {} as never);
    const hook = (validator as unknown as { unprocessableHook: IUnprocessableWriteHook }).unprocessableHook;
    expect(hook).toBeInstanceOf(NoOpUnprocessableWriteHook);
  });
});
