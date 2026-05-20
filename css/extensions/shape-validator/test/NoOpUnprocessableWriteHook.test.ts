import { describe, it, expect } from 'vitest';
import { NoOpUnprocessableWriteHook } from '../src/NoOpUnprocessableWriteHook';

describe('NoOpUnprocessableWriteHook', () => {
  it('resolves without side effects', async () => {
    const hook = new NoOpUnprocessableWriteHook();
    await expect(
      hook.onShaclRejection({
        targetUri: 'https://example.org/wiki/concepts/x.md',
        validationReport: '@prefix sh: <http://www.w3.org/ns/shacl#> . [] a sh:ValidationReport .',
        timestamp: new Date(),
      }),
    ).resolves.toBeUndefined();
  });
});
