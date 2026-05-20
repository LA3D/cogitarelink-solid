# MemTrigger Detector Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all four MemTrigger detectors into the substrate so `mem:*` events archive to `/.events/` on the conditions they describe; close the D74 substrate-self-monitoring contract; un-skip the four `test_mem_events.py` integration tests.

**Architecture:** Two Components.js DI hook interfaces (`IUnprocessableWriteHook`, `IPostProjectionHook`) with no-op defaults in producer extensions and real implementations in mem-trigger. MemTriggerListener subscribes to MonitoringStore for `BoundExceededDetector` (real `checkBound`) and runs a `setInterval` timer for `ReflectionDueDetector`. Cross-extension hooks deliver SHACL rejections and post-projection edges from shape-validator and markdown-projection respectively. Delivery to harness via A+C (post-write `/.events/` GET + Solid Notifications subscription); Pattern B deferred to RQ-Atomic-Feedback-1.

**Tech Stack:** TypeScript 5.x, Components.js (Solid CSS v8), N3.js v2, Vitest (unit), pytest + httpx (integration). Python via `~/uvws/.venv/bin/python`.

**Spec:** `docs/superpowers/specs/2026-05-20-mem-trigger-detector-wiring-design.md`

---

## File structure

### New files

```
css/extensions/mem-trigger/src/hooks/
  ├── IUnprocessableWriteHook.ts        # Interface contract (producer-consumer)
  ├── IPostProjectionHook.ts            # Interface contract (producer-consumer)
  ├── MemTriggerUnprocessableWriteHook.ts  # Real impl, wires to UnprocessableWriteDetector
  └── MemTriggerPostProjectionHook.ts      # Real impl, wires to ContradictionDetector
css/extensions/mem-trigger/src/
  └── loadDurableContainers.ts          # Type Index parser for ReflectionDue path filter
css/extensions/mem-trigger/tests/
  ├── MemTriggerListener.checkBound.test.ts
  ├── MemTriggerListener.tickReflection.test.ts
  ├── loadDurableContainers.test.ts
  └── hooks/
      ├── MemTriggerUnprocessableWriteHook.test.ts
      └── MemTriggerPostProjectionHook.test.ts
css/extensions/shape-validator/src/
  └── NoOpUnprocessableWriteHook.ts     # Default no-op when mem-trigger absent
css/extensions/markdown-projection/src-cjs/
  └── NoOpPostProjectionHook.ts         # Default no-op when mem-trigger absent
css/config/
  └── mem-trigger-test.json             # Short-interval ReflectionDue override
```

### Modified files

```
css/extensions/mem-trigger/src/MemTriggerListener.ts
  - Implement real checkBound (read parent container, count ldp:contains)
  - Add lastActivity Map; track on 'changed' for durable-path targets
  - Add tickReflection + setInterval in handle()
  - Add durableContainers Set loaded from Type Index in handle()
  - Implement finalize() to clearInterval

css/extensions/shape-validator/src/storage/validators/ShaclValidator.ts
  - Add IUnprocessableWriteHook constructor param (default NoOp)
  - Call hook.onShaclRejection in handle() before throwing 422 (wrapped try/catch)

css/extensions/markdown-projection/src-cjs/listener.ts
  - Add IPostProjectionHook constructor param (default NoOp)
  - Retain projected triples; filter to <#this> subject edges
  - Call hook.onEdgesWritten after MetaWriter completes

css/config/mem-trigger.json
  - Add Override binding IUnprocessableWriteHook to MemTriggerUnprocessableWriteHook
  - Add Override binding IPostProjectionHook to MemTriggerPostProjectionHook

css/config/shape-validation/shape-validation.json
  - Add ShaclValidator constructor param for IUnprocessableWriteHook (NoOp default)

css/config/markdown-projection.json
  - Add MarkdownProjectionListener constructor param for IPostProjectionHook (NoOp default)

tests/integration/test_mem_events.py
  - Replace four pytest.skip stubs with real test bodies

FOLLOWUPS.md
  - Strike through Phase C.10 wiring scope + deferrals section

.claude/memory/MEMORY.md
  - Add sprint completion summary (post-implementation)

css/extensions/mem-trigger/README.md
  - New README documenting hook interfaces + A+C delivery patterns
```

---

## Task 1: Verify CSS baseline behavior

**Files:**
- Read: `css/extensions/mem-trigger/src/MemTriggerListener.ts`
- Read: `tests/integration/test_mem_events.py`

Before any code changes, confirm the current baseline behavior so regressions are detectable.

- [ ] **Step 1: Bring up the Pod fresh**

```bash
docker compose down -v && docker compose up -d
```

Wait ~20 seconds for boot. Tail logs:

```bash
docker compose logs --tail 50
```

Expected: no errors, server listening on https://pod.vardeman.me:3000 (or http://localhost:3000 if TLS deploy isn't active).

- [ ] **Step 2: Confirm MemTriggerListener attaches**

Do a smoke PUT to `/vault/wiki/concepts/`:

```bash
curl -X PUT http://localhost:3000/vault/wiki/concepts/test-baseline-$(uuidgen).md \
  -H "Content-Type: text/markdown" \
  -d "# baseline" -v 2>&1 | tail -20
```

Expected: 201 Created (or 204). Check Pod logs:

```bash
docker compose logs | grep -E "(markdown-projection|MemTrigger)" | tail -10
```

Expected: at least one `[markdown-projection]` log line confirming projection ran (which means WorkerParallelInitializer fired all three listeners including MemTrigger).

- [ ] **Step 3: Run existing test suite to establish baseline**

```bash
cd css/extensions/mem-trigger && npm test 2>&1 | tail -20
```

Expected: existing tests pass. Note the count for comparison after the sprint.

```bash
export SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem
~/uvws/.venv/bin/python -m pytest tests/integration/test_mem_events.py -v
```

Expected: 4 tests SKIPPED, 0 failed.

- [ ] **Step 4: Confirm the four test stubs are the un-skip targets**

```bash
grep -n "pytest.skip\|def test_" tests/integration/test_mem_events.py
```

Expected output: four `@pytest.mark.skip` decorators + four `def test_*` functions matching the four detectors.

- [ ] **Step 5: Commit nothing — verification only**

No file changes in this task. Proceed to Task 2.

---

## Task 2: Define IUnprocessableWriteHook + NoOp default (shape-validator side)

**Files:**
- Create: `css/extensions/mem-trigger/src/hooks/IUnprocessableWriteHook.ts`
- Create: `css/extensions/shape-validator/src/NoOpUnprocessableWriteHook.ts`
- Create: `css/extensions/shape-validator/test/NoOpUnprocessableWriteHook.test.ts`

- [ ] **Step 1: Write the failing test**

`css/extensions/shape-validator/test/NoOpUnprocessableWriteHook.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd css/extensions/shape-validator && npx vitest run test/NoOpUnprocessableWriteHook.test.ts
```

Expected: FAIL with "Cannot find module '../src/NoOpUnprocessableWriteHook'".

- [ ] **Step 3: Create the interface**

`css/extensions/mem-trigger/src/hooks/IUnprocessableWriteHook.ts`:

```typescript
/**
 * Hook for surfacing SHACL-rejected writes to the memory-substrate
 * trigger pipeline. Implemented by mem-trigger; consumed by shape-validator's
 * ShaclValidator. Default binding is a no-op so shape-validator works in
 * environments where mem-trigger is not installed.
 *
 * See docs/superpowers/specs/2026-05-20-mem-trigger-detector-wiring-design.md.
 */
export interface IUnprocessableWriteHook {
  onShaclRejection(input: {
    targetUri: string;
    validationReport: string;
    writerWebId?: string;
    timestamp: Date;
  }): Promise<void>;
}
```

- [ ] **Step 4: Create the no-op implementation**

`css/extensions/shape-validator/src/NoOpUnprocessableWriteHook.ts`:

```typescript
import type { IUnprocessableWriteHook } from '@cogitarelink/mem-trigger/dist/hooks/IUnprocessableWriteHook';

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
```

Note: if the `@cogitarelink/mem-trigger` package resolution doesn't work via tsconfig path mapping, fall back to a structural import — copy the interface inline as a local type. The runtime behavior is identical (TypeScript interfaces erase at compile time).

- [ ] **Step 5: Run test to verify it passes**

```bash
cd css/extensions/shape-validator && npx vitest run test/NoOpUnprocessableWriteHook.test.ts
```

Expected: PASS (1/1).

- [ ] **Step 6: Commit**

```bash
git add css/extensions/mem-trigger/src/hooks/IUnprocessableWriteHook.ts \
        css/extensions/shape-validator/src/NoOpUnprocessableWriteHook.ts \
        css/extensions/shape-validator/test/NoOpUnprocessableWriteHook.test.ts
git commit -m "$(cat <<'EOF'
[Agent: Claude] mem-trigger: IUnprocessableWriteHook interface + NoOp default

Interface lives in mem-trigger/src/hooks/; no-op default ships in
shape-validator for environments where mem-trigger is absent. Per spec
D101 candidate two-hook DI pattern.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Define IPostProjectionHook + NoOp default (markdown-projection side)

**Files:**
- Create: `css/extensions/mem-trigger/src/hooks/IPostProjectionHook.ts`
- Create: `css/extensions/markdown-projection/src-cjs/NoOpPostProjectionHook.ts`
- Create: `css/extensions/markdown-projection/test/NoOpPostProjectionHook.test.ts`

- [ ] **Step 1: Write the failing test**

`css/extensions/markdown-projection/test/NoOpPostProjectionHook.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { NoOpPostProjectionHook } from '../src-cjs/NoOpPostProjectionHook';

describe('NoOpPostProjectionHook', () => {
  it('resolves without side effects', async () => {
    const hook = new NoOpPostProjectionHook();
    await expect(
      hook.onEdgesWritten({
        subject: 'https://example.org/wiki/concepts/x.md#this',
        edges: [
          { predicate: 'http://example.org/wiki#supports', object: 'https://example.org/y' },
        ],
        timestamp: new Date(),
      }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd css/extensions/markdown-projection && npx vitest run test/NoOpPostProjectionHook.test.ts
```

Expected: FAIL with "Cannot find module '../src-cjs/NoOpPostProjectionHook'".

- [ ] **Step 3: Create the interface**

`css/extensions/mem-trigger/src/hooks/IPostProjectionHook.ts`:

```typescript
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
export interface IPostProjectionHook {
  onEdgesWritten(input: {
    subject: string;
    edges: Array<{ predicate: string; object: string }>;
    timestamp: Date;
  }): Promise<void>;
}
```

- [ ] **Step 4: Create the no-op implementation**

`css/extensions/markdown-projection/src-cjs/NoOpPostProjectionHook.ts`:

```typescript
// CommonJS-loadable per markdown-projection's src-cjs convention.

export class NoOpPostProjectionHook {
  public async onEdgesWritten(_input: {
    subject: string;
    edges: Array<{ predicate: string; object: string }>;
    timestamp: Date;
  }): Promise<void> {
    // Intentional no-op. Real hook lives in mem-trigger.
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd css/extensions/markdown-projection && npx vitest run test/NoOpPostProjectionHook.test.ts
```

Expected: PASS (1/1).

- [ ] **Step 6: Commit**

```bash
git add css/extensions/mem-trigger/src/hooks/IPostProjectionHook.ts \
        css/extensions/markdown-projection/src-cjs/NoOpPostProjectionHook.ts \
        css/extensions/markdown-projection/test/NoOpPostProjectionHook.test.ts
git commit -m "$(cat <<'EOF'
[Agent: Claude] mem-trigger: IPostProjectionHook interface + NoOp default

Interface lives in mem-trigger/src/hooks/; no-op default ships in
markdown-projection (src-cjs) for environments where mem-trigger is
absent. Per spec D101 candidate two-hook DI pattern.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: MemTriggerUnprocessableWriteHook implementation

**Files:**
- Create: `css/extensions/mem-trigger/src/hooks/MemTriggerUnprocessableWriteHook.ts`
- Create: `css/extensions/mem-trigger/tests/hooks/MemTriggerUnprocessableWriteHook.test.ts`

- [ ] **Step 1: Write the failing test**

`css/extensions/mem-trigger/tests/hooks/MemTriggerUnprocessableWriteHook.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { MemTriggerUnprocessableWriteHook } from '../../src/hooks/MemTriggerUnprocessableWriteHook';
import { UnprocessableWriteDetector } from '../../src/detectors/UnprocessableWriteDetector';
import type { EventEmitter } from '../../src/EventEmitter';

describe('MemTriggerUnprocessableWriteHook', () => {
  it('emits a mem:UnprocessableWrite event on rejection', async () => {
    const emitter = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventEmitter;
    const detector = new UnprocessableWriteDetector();
    const hook = new MemTriggerUnprocessableWriteHook(detector, emitter);

    await hook.onShaclRejection({
      targetUri: 'https://pod.vardeman.me/vault/wiki/concepts/x.md',
      validationReport: '@prefix sh: <http://www.w3.org/ns/shacl#> . [] a sh:ValidationReport ; sh:conforms false .',
      writerWebId: 'https://pod.vardeman.me/vault/profile/card#me',
      timestamp: new Date('2026-05-20T12:00:00Z'),
    });

    expect(emitter.emit).toHaveBeenCalledOnce();
    const turtle = (emitter.emit as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(turtle).toContain('mem:UnprocessableWrite');
    expect(turtle).toContain('https://pod.vardeman.me/vault/wiki/concepts/x.md');
  });

  it('does not emit when validationReport is empty', async () => {
    const emitter = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventEmitter;
    const detector = new UnprocessableWriteDetector();
    const hook = new MemTriggerUnprocessableWriteHook(detector, emitter);

    await hook.onShaclRejection({
      targetUri: 'https://pod.vardeman.me/vault/wiki/concepts/x.md',
      validationReport: '',
      timestamp: new Date(),
    });

    expect(emitter.emit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd css/extensions/mem-trigger && npx vitest run tests/hooks/MemTriggerUnprocessableWriteHook.test.ts
```

Expected: FAIL with "Cannot find module '.../MemTriggerUnprocessableWriteHook'".

- [ ] **Step 3: Create the implementation**

`css/extensions/mem-trigger/src/hooks/MemTriggerUnprocessableWriteHook.ts`:

```typescript
import type { IUnprocessableWriteHook } from './IUnprocessableWriteHook';
import { UnprocessableWriteDetector } from '../detectors/UnprocessableWriteDetector';
import type { EventEmitter } from '../EventEmitter';

export class MemTriggerUnprocessableWriteHook implements IUnprocessableWriteHook {
  private readonly detector: UnprocessableWriteDetector;
  private readonly emitter: EventEmitter;

  public constructor(detector: UnprocessableWriteDetector, emitter: EventEmitter) {
    this.detector = detector;
    this.emitter = emitter;
  }

  public async onShaclRejection(input: {
    targetUri: string;
    validationReport: string;
    writerWebId?: string;
    timestamp: Date;
  }): Promise<void> {
    const turtle = this.detector.buildEvent({
      targetUri: input.targetUri,
      validationReport: input.validationReport,
      writerWebId: input.writerWebId,
      timestamp: input.timestamp,
    });
    if (turtle !== null) {
      await this.emitter.emit(turtle);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd css/extensions/mem-trigger && npx vitest run tests/hooks/MemTriggerUnprocessableWriteHook.test.ts
```

Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add css/extensions/mem-trigger/src/hooks/MemTriggerUnprocessableWriteHook.ts \
        css/extensions/mem-trigger/tests/hooks/MemTriggerUnprocessableWriteHook.test.ts
git commit -m "$(cat <<'EOF'
[Agent: Claude] mem-trigger: MemTriggerUnprocessableWriteHook implementation

Wraps UnprocessableWriteDetector + EventEmitter. Called by ShaclValidator
on SHACL rejection (Task 10). Emits mem:UnprocessableWrite event to
/.events/ archive; in-context delivery to agent happens via the existing
422 response body.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: MemTriggerPostProjectionHook implementation

**Files:**
- Create: `css/extensions/mem-trigger/src/hooks/MemTriggerPostProjectionHook.ts`
- Create: `css/extensions/mem-trigger/tests/hooks/MemTriggerPostProjectionHook.test.ts`

- [ ] **Step 1: Write the failing test**

`css/extensions/mem-trigger/tests/hooks/MemTriggerPostProjectionHook.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { MemTriggerPostProjectionHook } from '../../src/hooks/MemTriggerPostProjectionHook';
import { ContradictionDetector } from '../../src/detectors/ContradictionDetector';
import type { EventEmitter } from '../../src/EventEmitter';

const WIKI_SUPPORTS = 'https://pod.vardeman.me/vault/ontology/wiki#supports';
const WIKI_CRITICIZES = 'https://pod.vardeman.me/vault/ontology/wiki#criticizes';

describe('MemTriggerPostProjectionHook', () => {
  it('emits a mem:ContradictionDetected event when conflicting edges target same object', async () => {
    const emitter = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventEmitter;
    const detector = new ContradictionDetector({
      contradictoryPairs: [[WIKI_SUPPORTS, WIKI_CRITICIZES]],
    });
    const hook = new MemTriggerPostProjectionHook(detector, emitter);

    await hook.onEdgesWritten({
      subject: 'https://pod.vardeman.me/vault/wiki/concepts/x.md#this',
      edges: [
        { predicate: WIKI_SUPPORTS, object: 'https://pod.vardeman.me/vault/wiki/concepts/y.md#this' },
        { predicate: WIKI_CRITICIZES, object: 'https://pod.vardeman.me/vault/wiki/concepts/y.md#this' },
      ],
      timestamp: new Date('2026-05-20T12:00:00Z'),
    });

    expect(emitter.emit).toHaveBeenCalledOnce();
    const turtle = (emitter.emit as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(turtle).toContain('mem:ContradictionDetected');
  });

  it('does not emit when edges are non-conflicting', async () => {
    const emitter = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventEmitter;
    const detector = new ContradictionDetector({
      contradictoryPairs: [[WIKI_SUPPORTS, WIKI_CRITICIZES]],
    });
    const hook = new MemTriggerPostProjectionHook(detector, emitter);

    await hook.onEdgesWritten({
      subject: 'https://pod.vardeman.me/vault/wiki/concepts/x.md#this',
      edges: [
        { predicate: WIKI_SUPPORTS, object: 'https://pod.vardeman.me/vault/wiki/concepts/y.md#this' },
        { predicate: WIKI_SUPPORTS, object: 'https://pod.vardeman.me/vault/wiki/concepts/z.md#this' },
      ],
      timestamp: new Date(),
    });

    expect(emitter.emit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd css/extensions/mem-trigger && npx vitest run tests/hooks/MemTriggerPostProjectionHook.test.ts
```

Expected: FAIL with "Cannot find module '.../MemTriggerPostProjectionHook'".

- [ ] **Step 3: Create the implementation**

`css/extensions/mem-trigger/src/hooks/MemTriggerPostProjectionHook.ts`:

```typescript
import type { IPostProjectionHook } from './IPostProjectionHook';
import { ContradictionDetector } from '../detectors/ContradictionDetector';
import type { EventEmitter } from '../EventEmitter';

export class MemTriggerPostProjectionHook implements IPostProjectionHook {
  private readonly detector: ContradictionDetector;
  private readonly emitter: EventEmitter;

  public constructor(detector: ContradictionDetector, emitter: EventEmitter) {
    this.detector = detector;
    this.emitter = emitter;
  }

  public async onEdgesWritten(input: {
    subject: string;
    edges: Array<{ predicate: string; object: string }>;
    timestamp: Date;
  }): Promise<void> {
    const turtle = this.detector.maybeEmit({
      subject: input.subject,
      edges: input.edges,
      now: input.timestamp,
    });
    if (turtle !== null) {
      await this.emitter.emit(turtle);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd css/extensions/mem-trigger && npx vitest run tests/hooks/MemTriggerPostProjectionHook.test.ts
```

Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add css/extensions/mem-trigger/src/hooks/MemTriggerPostProjectionHook.ts \
        css/extensions/mem-trigger/tests/hooks/MemTriggerPostProjectionHook.test.ts
git commit -m "$(cat <<'EOF'
[Agent: Claude] mem-trigger: MemTriggerPostProjectionHook implementation

Wraps ContradictionDetector + EventEmitter. Called by
MarkdownProjectionListener after .meta write completes (Task 12).
Emits mem:ContradictionDetected when configured predicate pairs
(v1: wiki:supports + wiki:criticizes) point at the same object.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: loadDurableContainers utility

**Files:**
- Create: `css/extensions/mem-trigger/src/loadDurableContainers.ts`
- Create: `css/extensions/mem-trigger/tests/loadDurableContainers.test.ts`

- [ ] **Step 1: Write the failing test**

`css/extensions/mem-trigger/tests/loadDurableContainers.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { loadDurableContainers } from '../src/loadDurableContainers';
import type { ResourceStore } from '@solid/community-server';
import { Readable } from 'node:stream';

const TYPE_INDEX_TURTLE = `
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix wiki:  <https://pod.vardeman.me/vault/ontology/wiki#> .

<#concepts> a solid:TypeRegistration ;
  solid:forClass wiki:Concept ;
  solid:instanceContainer </vault/wiki/concepts/> .

<#sources> a solid:TypeRegistration ;
  solid:forClass wiki:Source ;
  solid:instanceContainer </vault/wiki/sources/> .

<#people> a solid:TypeRegistration ;
  solid:forClass wiki:Person ;
  solid:instanceContainer </vault/wiki/people/> .
`;

describe('loadDurableContainers', () => {
  it('parses solid:instanceContainer values from a Type Index Turtle document', async () => {
    const store = {
      getRepresentation: vi.fn().mockResolvedValue({
        data: Readable.from([TYPE_INDEX_TURTLE]),
        metadata: { contentType: 'text/turtle' },
      }),
    } as unknown as ResourceStore;

    const set = await loadDurableContainers(store, 'https://pod.vardeman.me/vault/settings/publicTypeIndex');

    expect(set.size).toBe(3);
    expect(set.has('/vault/wiki/concepts/')).toBe(true);
    expect(set.has('/vault/wiki/sources/')).toBe(true);
    expect(set.has('/vault/wiki/people/')).toBe(true);
  });

  it('returns empty set when Type Index read fails', async () => {
    const store = {
      getRepresentation: vi.fn().mockRejectedValue(new Error('Not found')),
    } as unknown as ResourceStore;

    const set = await loadDurableContainers(store, 'https://pod.vardeman.me/vault/settings/publicTypeIndex');

    expect(set.size).toBe(0);
  });

  it('normalizes container URIs to trailing-slash form', async () => {
    const turtleNoSlash = `
      @prefix solid: <http://www.w3.org/ns/solid/terms#> .
      <#x> a solid:TypeRegistration ;
        solid:instanceContainer </vault/wiki/concepts> .
    `;
    const store = {
      getRepresentation: vi.fn().mockResolvedValue({
        data: Readable.from([turtleNoSlash]),
        metadata: { contentType: 'text/turtle' },
      }),
    } as unknown as ResourceStore;

    const set = await loadDurableContainers(store, 'https://pod.vardeman.me/vault/settings/publicTypeIndex');
    expect(set.has('/vault/wiki/concepts/')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd css/extensions/mem-trigger && npx vitest run tests/loadDurableContainers.test.ts
```

Expected: FAIL with "Cannot find module '../src/loadDurableContainers'".

- [ ] **Step 3: Create the implementation**

`css/extensions/mem-trigger/src/loadDurableContainers.ts`:

```typescript
import { getLoggerFor } from 'global-logger-factory';
import type { ResourceStore } from '@solid/community-server';
import { Parser } from 'n3';

const logger = getLoggerFor('mem-trigger:loadDurableContainers');

const SOLID_INSTANCE_CONTAINER = 'http://www.w3.org/ns/solid/terms#instanceContainer';

export async function loadDurableContainers(
  store: ResourceStore,
  typeIndexUri: string,
): Promise<Set<string>> {
  let turtle: string;
  try {
    const representation = await store.getRepresentation(
      { path: typeIndexUri },
      { type: { 'text/turtle': 1 } },
    );
    turtle = await streamToString(representation.data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Could not load Type Index at ${typeIndexUri}: ${msg}`);
    return new Set();
  }

  const parser = new Parser({ baseIRI: typeIndexUri });
  const result = new Set<string>();
  try {
    parser.parse(turtle, (error, quad) => {
      if (error) {
        logger.warn(`Type Index parse error: ${error.message}`);
        return;
      }
      if (!quad) return;
      if (quad.predicate.value === SOLID_INSTANCE_CONTAINER) {
        const url = new URL(quad.object.value);
        let path = url.pathname;
        if (!path.endsWith('/')) path += '/';
        result.add(path);
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Type Index parse exception: ${msg}`);
    return new Set();
  }

  return result;
}

async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd css/extensions/mem-trigger && npx vitest run tests/loadDurableContainers.test.ts
```

Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add css/extensions/mem-trigger/src/loadDurableContainers.ts \
        css/extensions/mem-trigger/tests/loadDurableContainers.test.ts
git commit -m "$(cat <<'EOF'
[Agent: Claude] mem-trigger: loadDurableContainers utility for Type Index

Parses solid:instanceContainer values from /vault/settings/publicTypeIndex.
Used by MemTriggerListener.handle() at startup to populate the durable-
container set for ReflectionDue path filtering. Graceful empty-set
fallback on read or parse failure (D78 oracle: Type Index is canonical
dispatch, but its absence shouldn't crash the listener).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Real checkBound implementation in MemTriggerListener

**Files:**
- Modify: `css/extensions/mem-trigger/src/MemTriggerListener.ts`
- Create: `css/extensions/mem-trigger/tests/MemTriggerListener.checkBound.test.ts`

- [ ] **Step 1: Write the failing test**

`css/extensions/mem-trigger/tests/MemTriggerListener.checkBound.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemTriggerListener } from '../src/MemTriggerListener';
import type { MonitoringStore, ResourceStore } from '@solid/community-server';
import { Readable } from 'node:stream';

function buildContainerTurtle(childCount: number): string {
  const ldpContains = Array.from({ length: childCount }, (_, i) =>
    `<https://pod.vardeman.me/vault/wiki/concepts/child-${i}.md>`).join(',\n    ');
  return `
    @prefix ldp: <http://www.w3.org/ns/ldp#> .
    <https://pod.vardeman.me/vault/wiki/concepts/> ldp:contains
      ${ldpContains} .
  `;
}

describe('MemTriggerListener.checkBound', () => {
  let mockStore: ResourceStore;
  let mockMonitoring: MonitoringStore;
  let onChangeHandler: ((target: { path: string }, activity: unknown, metadata: unknown) => void) | null = null;
  let emitSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    emitSpy = vi.fn().mockResolvedValue(undefined);
    onChangeHandler = null;
    mockMonitoring = {
      on: vi.fn((event: string, handler: typeof onChangeHandler) => {
        if (event === 'changed') onChangeHandler = handler;
      }),
    } as unknown as MonitoringStore;
  });

  it('emits BoundExceeded when parent container exceeds threshold', async () => {
    mockStore = {
      getRepresentation: vi.fn().mockResolvedValue({
        data: Readable.from([buildContainerTurtle(13)]),
        metadata: { contentType: 'text/turtle' },
      }),
    } as unknown as ResourceStore;

    const listener = new MemTriggerListener(
      mockMonitoring,
      mockStore,
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12,         // boundThreshold
      86400000,   // reflectionIntervalMs (unused this test)
      [],         // contradictoryPairs
    );
    // Inject spy emitter
    (listener as unknown as { emitter: { emit: typeof emitSpy } }).emitter = { emit: emitSpy };

    await listener.handle();
    expect(onChangeHandler).not.toBeNull();
    onChangeHandler!(
      { path: 'https://pod.vardeman.me/vault/wiki/concepts/new-resource.md' },
      null,
      null,
    );
    // Drain chain
    await new Promise((r) => setImmediate(r));

    expect(emitSpy).toHaveBeenCalledOnce();
    const turtle = emitSpy.mock.calls[0][0] as string;
    expect(turtle).toContain('mem:BoundExceeded');
  });

  it('does not emit when childCount equals threshold', async () => {
    mockStore = {
      getRepresentation: vi.fn().mockResolvedValue({
        data: Readable.from([buildContainerTurtle(12)]),
        metadata: { contentType: 'text/turtle' },
      }),
    } as unknown as ResourceStore;

    const listener = new MemTriggerListener(
      mockMonitoring, mockStore,
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12, 86400000, [],
    );
    (listener as unknown as { emitter: { emit: typeof emitSpy } }).emitter = { emit: emitSpy };
    await listener.handle();
    onChangeHandler!({ path: 'https://pod.vardeman.me/vault/wiki/concepts/new.md' }, null, null);
    await new Promise((r) => setImmediate(r));

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('skips writes to .events/ parent', async () => {
    mockStore = {
      getRepresentation: vi.fn().mockResolvedValue({
        data: Readable.from([buildContainerTurtle(20)]),
        metadata: { contentType: 'text/turtle' },
      }),
    } as unknown as ResourceStore;

    const listener = new MemTriggerListener(
      mockMonitoring, mockStore,
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12, 86400000, [],
    );
    (listener as unknown as { emitter: { emit: typeof emitSpy } }).emitter = { emit: emitSpy };
    await listener.handle();
    onChangeHandler!({ path: 'https://pod.vardeman.me/vault/wiki/.events/x.ttl' }, null, null);
    await new Promise((r) => setImmediate(r));

    expect(emitSpy).not.toHaveBeenCalled();
    expect(mockStore.getRepresentation).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd css/extensions/mem-trigger && npx vitest run tests/MemTriggerListener.checkBound.test.ts
```

Expected: FAIL — `expect(emitSpy).toHaveBeenCalledOnce()` fails because `checkBound` is currently a no-op stub.

- [ ] **Step 3: Replace the `checkBound` stub with the real implementation**

Edit `css/extensions/mem-trigger/src/MemTriggerListener.ts`. Add imports at top of file (after existing imports):

```typescript
import { Parser } from 'n3';
```

Replace the stub method (currently at `MemTriggerListener.ts:109-112`):

```typescript
  private async checkBound(target: ResourceIdentifier): Promise<void> {
    // Derive parent container URI: strip last segment, ensure trailing /.
    const parentUri = deriveParentContainer(target.path);
    if (parentUri === null) return;
    // Defense-in-depth filter (also filtered in onChange).
    if (parentUri.includes('/.events/') || parentUri.includes('/.operations/')) return;

    let containerTurtle: string;
    try {
      const representation = await this.store.getRepresentation(
        { path: parentUri },
        { type: { 'text/turtle': 1 } },
      );
      containerTurtle = await streamToString(representation.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`checkBound: could not read parent container ${parentUri}: ${msg}`);
      return;
    }

    let childCount = 0;
    try {
      const parser = new Parser({ baseIRI: parentUri });
      const quads = parser.parse(containerTurtle);
      childCount = quads.filter((q) => q.predicate.value === 'http://www.w3.org/ns/ldp#contains').length;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`checkBound: parse error for ${parentUri}: ${msg}`);
      return;
    }

    const now = new Date();
    const lastEmitted = this.lastBoundEmit.get(parentUri) ?? null;
    const turtle = this.bound.maybeEmit({
      containerUri: parentUri,
      childCount,
      lastEmittedForContainer: lastEmitted,
      now,
    });
    if (turtle !== null) {
      await this.emitter.emit(turtle);
      this.lastBoundEmit.set(parentUri, now);
    }
  }
```

Add module-level helpers at the bottom of the file (or in a new internal file `MemTriggerListenerHelpers.ts` if preferred):

```typescript
function deriveParentContainer(path: string): string | null {
  try {
    const url = new URL(path);
    if (url.pathname === '/' || url.pathname === '') return null;
    const trimmed = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
    const idx = trimmed.lastIndexOf('/');
    if (idx < 0) return null;
    url.pathname = trimmed.slice(0, idx + 1);
    return url.toString();
  } catch {
    return null;
  }
}

async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd css/extensions/mem-trigger && npx vitest run tests/MemTriggerListener.checkBound.test.ts
```

Expected: PASS (3/3).

- [ ] **Step 5: Run all mem-trigger tests to verify no regressions**

```bash
cd css/extensions/mem-trigger && npm test 2>&1 | tail -20
```

Expected: all existing tests still pass; the new test file contributes its 3 cases.

- [ ] **Step 6: Commit**

```bash
git add css/extensions/mem-trigger/src/MemTriggerListener.ts \
        css/extensions/mem-trigger/tests/MemTriggerListener.checkBound.test.ts
git commit -m "$(cat <<'EOF'
[Agent: Claude] mem-trigger: real checkBound implementation

Replaces the v1 stub with: read parent container via
store.getRepresentation, parse Turtle with N3.js, count ldp:contains
triples, invoke BoundExceededDetector.maybeEmit. Per-container flapping
suppression preserved (24h default). Defense-in-depth skip of .events/
and .operations/ parents.

Read mechanism is store.getRepresentation (per spec Section 3.1); the
wiki-search D92 re-entrant-lock concern doesn't apply since 'changed'
fires post-commit and the parent is a different resource from the write
target.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: lastActivity tracking + Type Index loading at handle()

**Files:**
- Modify: `css/extensions/mem-trigger/src/MemTriggerListener.ts`

- [ ] **Step 1: Write the failing test**

Append to `css/extensions/mem-trigger/tests/MemTriggerListener.checkBound.test.ts` (reuses mock setup):

```typescript
import { loadDurableContainers as actualLoad } from '../src/loadDurableContainers';

describe('MemTriggerListener.handle: durable-container loading and activity tracking', () => {
  it('loads durable containers from Type Index at handle()', async () => {
    const TYPE_INDEX_TTL = `
      @prefix solid: <http://www.w3.org/ns/solid/terms#> .
      <#concepts> a solid:TypeRegistration ;
        solid:instanceContainer </vault/wiki/concepts/> .
    `;
    const store = {
      getRepresentation: vi.fn().mockResolvedValue({
        data: Readable.from([TYPE_INDEX_TTL]),
        metadata: { contentType: 'text/turtle' },
      }),
    } as unknown as ResourceStore;
    const monitoring = { on: vi.fn() } as unknown as MonitoringStore;

    const listener = new MemTriggerListener(
      monitoring, store,
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12, 86400000, [],
    );
    await listener.handle();

    const set = (listener as unknown as { durableContainers: Set<string> }).durableContainers;
    expect(set.has('/vault/wiki/concepts/')).toBe(true);
  });

  it('tracks lastActivity for writes under durable containers', async () => {
    const TYPE_INDEX_TTL = `
      @prefix solid: <http://www.w3.org/ns/solid/terms#> .
      <#concepts> a solid:TypeRegistration ;
        solid:instanceContainer </vault/wiki/concepts/> .
    `;
    let handler: ((target: { path: string }, a: unknown, m: unknown) => void) | null = null;
    const store = {
      getRepresentation: vi.fn().mockImplementation(({ path }: { path: string }) => {
        if (path.includes('publicTypeIndex')) {
          return Promise.resolve({
            data: Readable.from([TYPE_INDEX_TTL]),
            metadata: { contentType: 'text/turtle' },
          });
        }
        return Promise.resolve({
          data: Readable.from([buildContainerTurtle(0)]),
          metadata: { contentType: 'text/turtle' },
        });
      }),
    } as unknown as ResourceStore;
    const monitoring = {
      on: vi.fn((evt: string, h: typeof handler) => { if (evt === 'changed') handler = h; }),
    } as unknown as MonitoringStore;

    const listener = new MemTriggerListener(
      monitoring, store,
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12, 86400000, [],
    );
    await listener.handle();

    handler!({ path: 'https://pod.vardeman.me/vault/wiki/concepts/x.md' }, null, null);
    await new Promise((r) => setImmediate(r));

    const activity = (listener as unknown as { lastActivity: Map<string, Date> }).lastActivity;
    expect(activity.has('https://pod.vardeman.me/vault/wiki/concepts/x.md')).toBe(true);
  });

  it('does NOT track lastActivity for writes outside durable containers', async () => {
    const TYPE_INDEX_TTL = `
      @prefix solid: <http://www.w3.org/ns/solid/terms#> .
      <#concepts> a solid:TypeRegistration ;
        solid:instanceContainer </vault/wiki/concepts/> .
    `;
    let handler: ((target: { path: string }, a: unknown, m: unknown) => void) | null = null;
    const store = {
      getRepresentation: vi.fn().mockImplementation(({ path }: { path: string }) =>
        path.includes('publicTypeIndex')
          ? Promise.resolve({ data: Readable.from([TYPE_INDEX_TTL]), metadata: { contentType: 'text/turtle' } })
          : Promise.resolve({ data: Readable.from([buildContainerTurtle(0)]), metadata: { contentType: 'text/turtle' } }),
      ),
    } as unknown as ResourceStore;
    const monitoring = {
      on: vi.fn((evt: string, h: typeof handler) => { if (evt === 'changed') handler = h; }),
    } as unknown as MonitoringStore;

    const listener = new MemTriggerListener(
      monitoring, store,
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12, 86400000, [],
    );
    await listener.handle();

    handler!({ path: 'https://pod.vardeman.me/vault/wiki/working/x.md' }, null, null);
    await new Promise((r) => setImmediate(r));

    const activity = (listener as unknown as { lastActivity: Map<string, Date> }).lastActivity;
    expect(activity.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd css/extensions/mem-trigger && npx vitest run tests/MemTriggerListener.checkBound.test.ts
```

Expected: the three new describe-block tests FAIL — `durableContainers` and `lastActivity` fields don't exist yet, and Type Index loading isn't wired.

- [ ] **Step 3: Wire durableContainers loading and lastActivity tracking**

Edit `css/extensions/mem-trigger/src/MemTriggerListener.ts`. Add import:

```typescript
import { loadDurableContainers } from './loadDurableContainers';
```

Add new fields (alongside existing `lastBoundEmit` at line 43):

```typescript
  private readonly lastActivity = new Map<string, Date>();
  private readonly lastReflection = new Map<string, Date>();
  private durableContainers: Set<string> = new Set();
  private typeIndexUri: string;
```

Modify the constructor to accept the Type Index URI (add as last parameter; update Components.js wiring in Task 11):

```typescript
  public constructor(
    monitoringStore: MonitoringStore,
    store: ResourceStore,
    eventsContainer: string,
    baseUrl: string,
    boundThreshold: number,
    reflectionIntervalMs: number,
    contradictoryPairs: Array<[string, string]>,
    typeIndexUri: string,
  ) {
    // ... existing assignments ...
    this.typeIndexUri = typeIndexUri;
  }
```

Modify `handle()` to load durable containers and track activity:

```typescript
  public async handle(): Promise<void> {
    this.durableContainers = await loadDurableContainers(this.store, this.typeIndexUri);
    if (this.durableContainers.size === 0) {
      this.logger.warn(
        `MemTriggerListener: durable-container set is empty (Type Index at ${this.typeIndexUri} may not exist yet); ReflectionDue path filter will admit nothing until a write triggers a retry.`,
      );
    }

    this.monitoringStore.on('changed', (target, activity, metadata) => {
      this.onChange(target, activity, metadata);
    });

    this.logger.info(
      `MemTriggerListener attached (eventsContainer=${this.eventsContainer}, baseUrl=${this.baseUrl}, durableContainers=${this.durableContainers.size})`,
    );
  }
```

Modify `onChange` to track activity for durable paths (before the existing chain.then):

```typescript
  private onChange(target: ResourceIdentifier, _activity: unknown, _metadata: unknown): void {
    if (target.path.includes('/.events/') || target.path.includes('/.operations/')) {
      return;
    }
    if (!target.path.startsWith(this.baseUrl)) {
      return;
    }

    // Activity tracking for ReflectionDue path filter.
    if (this.isDurableTarget(target.path)) {
      this.lastActivity.set(target.path, new Date());
    }

    this.chain = this.chain
      .then(async () => { await this.checkBound(target); })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`MemTrigger onChange handler error: ${msg}`);
      });
  }

  private isDurableTarget(targetUri: string): boolean {
    try {
      const url = new URL(targetUri);
      for (const container of this.durableContainers) {
        if (url.pathname.startsWith(container)) return true;
      }
    } catch {
      return false;
    }
    return false;
  }
```

- [ ] **Step 4: Update the T7-written checkBound tests to pass the new typeIndexUri arg**

Task 7's tests construct `MemTriggerListener` with 7 positional args. T8's constructor now requires 8. Update each `new MemTriggerListener(...)` call site in `tests/MemTriggerListener.checkBound.test.ts` to append the typeIndexUri as the 8th arg:

```typescript
const listener = new MemTriggerListener(
  mockMonitoring,
  mockStore,
  'https://pod.vardeman.me/vault/wiki/.events/',
  'https://pod.vardeman.me/vault',
  12,
  86400000,
  [],
  'https://pod.vardeman.me/vault/settings/publicTypeIndex',  // NEW: typeIndexUri
);
```

For the T7 tests that don't care about Type Index (the basic checkBound tests), the test fixture provides a mock `store.getRepresentation` that returns either container Turtle or Type Index Turtle depending on `path`. Update those tests' mock to handle `publicTypeIndex` requests with an empty-set response:

```typescript
mockStore = {
  getRepresentation: vi.fn().mockImplementation(({ path }: { path: string }) => {
    if (path.includes('publicTypeIndex')) {
      return Promise.resolve({
        data: Readable.from(['@prefix solid: <http://www.w3.org/ns/solid/terms#> .']),
        metadata: { contentType: 'text/turtle' },
      });
    }
    return Promise.resolve({
      data: Readable.from([buildContainerTurtle(13)]),  // or 12, per the test
      metadata: { contentType: 'text/turtle' },
    });
  }),
} as unknown as ResourceStore;
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd css/extensions/mem-trigger && npx vitest run tests/MemTriggerListener.checkBound.test.ts
```

Expected: PASS (6/6 — original 3 + new 3).

- [ ] **Step 6: Commit**

```bash
git add css/extensions/mem-trigger/src/MemTriggerListener.ts \
        css/extensions/mem-trigger/tests/MemTriggerListener.checkBound.test.ts
git commit -m "$(cat <<'EOF'
[Agent: Claude] mem-trigger: durable-container loading + lastActivity tracking

handle() now loads the durable-container set from Type Index at startup
(graceful empty-set fallback). onChange tracks lastActivity for writes
whose path starts with any durable container — feeds ReflectionDue path
filter (Task 9). Working-memory and other non-durable paths are skipped.

Constructor takes new typeIndexUri parameter; Components.js wiring update
follows in Task 11.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: tickReflection + setInterval + finalize()

**Files:**
- Modify: `css/extensions/mem-trigger/src/MemTriggerListener.ts`
- Create: `css/extensions/mem-trigger/tests/MemTriggerListener.tickReflection.test.ts`

- [ ] **Step 1: Write the failing test**

`css/extensions/mem-trigger/tests/MemTriggerListener.tickReflection.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemTriggerListener } from '../src/MemTriggerListener';
import type { MonitoringStore, ResourceStore } from '@solid/community-server';
import { Readable } from 'node:stream';

const TYPE_INDEX_TTL = `
  @prefix solid: <http://www.w3.org/ns/solid/terms#> .
  <#concepts> a solid:TypeRegistration ;
    solid:instanceContainer </vault/wiki/concepts/> .
`;

function makeStore() {
  return {
    getRepresentation: vi.fn().mockResolvedValue({
      data: Readable.from([TYPE_INDEX_TTL]),
      metadata: { contentType: 'text/turtle' },
    }),
  } as unknown as ResourceStore;
}

describe('MemTriggerListener.tickReflection', () => {
  let emitSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => { emitSpy = vi.fn().mockResolvedValue(undefined); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('emits ReflectionDue for subjects with activity past the interval', async () => {
    const monitoring = { on: vi.fn() } as unknown as MonitoringStore;
    const listener = new MemTriggerListener(
      monitoring, makeStore(),
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12,
      200,    // reflectionIntervalMs — short for test
      [],
      'https://pod.vardeman.me/vault/settings/publicTypeIndex',
    );
    (listener as unknown as { emitter: { emit: typeof emitSpy } }).emitter = { emit: emitSpy };
    await listener.handle();

    // Pre-populate lastActivity for two subjects, well in the past.
    const long_ago = new Date(Date.now() - 1000);
    (listener as unknown as { lastActivity: Map<string, Date> }).lastActivity.set(
      'https://pod.vardeman.me/vault/wiki/concepts/a.md', long_ago,
    );
    (listener as unknown as { lastActivity: Map<string, Date> }).lastActivity.set(
      'https://pod.vardeman.me/vault/wiki/concepts/b.md', long_ago,
    );

    await (listener as unknown as { tickReflection(): Promise<void> }).tickReflection();
    expect(emitSpy).toHaveBeenCalledTimes(2);

    listener.finalize?.();
  });

  it('does not emit again on second tick without new activity', async () => {
    const monitoring = { on: vi.fn() } as unknown as MonitoringStore;
    const listener = new MemTriggerListener(
      monitoring, makeStore(),
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12, 200, [],
      'https://pod.vardeman.me/vault/settings/publicTypeIndex',
    );
    (listener as unknown as { emitter: { emit: typeof emitSpy } }).emitter = { emit: emitSpy };
    await listener.handle();

    const long_ago = new Date(Date.now() - 1000);
    (listener as unknown as { lastActivity: Map<string, Date> }).lastActivity.set(
      'https://pod.vardeman.me/vault/wiki/concepts/a.md', long_ago,
    );

    await (listener as unknown as { tickReflection(): Promise<void> }).tickReflection();
    expect(emitSpy).toHaveBeenCalledTimes(1);

    emitSpy.mockClear();
    await (listener as unknown as { tickReflection(): Promise<void> }).tickReflection();
    expect(emitSpy).not.toHaveBeenCalled();

    listener.finalize?.();
  });

  it('finalize() clears the reflection interval', async () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const monitoring = { on: vi.fn() } as unknown as MonitoringStore;
    const listener = new MemTriggerListener(
      monitoring, makeStore(),
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12, 200, [],
      'https://pod.vardeman.me/vault/settings/publicTypeIndex',
    );
    await listener.handle();
    expect(setIntervalSpy).toHaveBeenCalled();

    listener.finalize?.();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd css/extensions/mem-trigger && npx vitest run tests/MemTriggerListener.tickReflection.test.ts
```

Expected: FAIL — `tickReflection` and `finalize` methods don't exist.

- [ ] **Step 3: Add tickReflection, setInterval setup, and finalize()**

Edit `css/extensions/mem-trigger/src/MemTriggerListener.ts`.

Add field for the interval handle and the tick rate:

```typescript
  private reflectionTimer: NodeJS.Timeout | null = null;
  private readonly reflectionTickRateMs: number;
```

Modify the constructor to accept tick rate as an additional parameter (after reflectionIntervalMs):

```typescript
  public constructor(
    monitoringStore: MonitoringStore,
    store: ResourceStore,
    eventsContainer: string,
    baseUrl: string,
    boundThreshold: number,
    reflectionIntervalMs: number,
    reflectionTickRateMs: number,
    contradictoryPairs: Array<[string, string]>,
    typeIndexUri: string,
  ) {
    // ... existing assignments ...
    this.reflectionTickRateMs = reflectionTickRateMs;
    // ... rest ...
  }
```

Update `handle()` to start the interval:

```typescript
  public async handle(): Promise<void> {
    this.durableContainers = await loadDurableContainers(this.store, this.typeIndexUri);
    // ... existing warning + on('changed') subscription ...

    this.reflectionTimer = setInterval(() => {
      this.tickReflection().catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`tickReflection error: ${msg}`);
      });
    }, this.reflectionTickRateMs);
  }
```

Add `tickReflection` method:

```typescript
  private async tickReflection(): Promise<void> {
    const now = new Date();
    for (const [subjectUri, lastActivity] of this.lastActivity) {
      const lastEmitted = this.lastReflection.get(subjectUri) ?? null;
      const turtle = this.reflection.maybeEmit({
        lastEmitted,
        lastActivity,
        now,
      });
      if (turtle !== null) {
        await this.emitter.emit(turtle);
        this.lastReflection.set(subjectUri, now);
      }
    }
  }
```

Add `finalize()` method (CSS Initializer lifecycle):

```typescript
  public finalize(): void {
    if (this.reflectionTimer !== null) {
      clearInterval(this.reflectionTimer);
      this.reflectionTimer = null;
    }
  }
```

- [ ] **Step 4: Update T7/T8-written tests to pass the new reflectionTickRateMs arg**

T9's constructor inserts `reflectionTickRateMs` between `reflectionIntervalMs` and `contradictoryPairs`. Every existing `new MemTriggerListener(...)` call in `tests/MemTriggerListener.checkBound.test.ts` (7 call sites from T7 + T8) must add the new arg in position 7. Use a production-equivalent default for tests not exercising the timer:

```typescript
const listener = new MemTriggerListener(
  mockMonitoring,
  mockStore,
  'https://pod.vardeman.me/vault/wiki/.events/',
  'https://pod.vardeman.me/vault',
  12,
  86400000,        // reflectionIntervalMs
  3600000,         // reflectionTickRateMs — NEW
  [],              // contradictoryPairs
  'https://pod.vardeman.me/vault/settings/publicTypeIndex',
);
```

After the edits, the tickReflection test file's call sites already include `reflectionTickRateMs` in the correct slot (per Step 1 above).

- [ ] **Step 5: Run test to verify it passes**

```bash
cd css/extensions/mem-trigger && npx vitest run tests/MemTriggerListener.tickReflection.test.ts
```

Expected: PASS (3/3).

- [ ] **Step 6: Run all mem-trigger tests**

```bash
cd css/extensions/mem-trigger && npm test 2>&1 | tail -20
```

Expected: all green; tickReflection and checkBound tests both pass; no regressions.

- [ ] **Step 7: Commit**

```bash
git add css/extensions/mem-trigger/src/MemTriggerListener.ts \
        css/extensions/mem-trigger/tests/MemTriggerListener.checkBound.test.ts \
        css/extensions/mem-trigger/tests/MemTriggerListener.tickReflection.test.ts
git commit -m "$(cat <<'EOF'
[Agent: Claude] mem-trigger: tickReflection + setInterval + finalize()

handle() starts a setInterval at reflectionTickRateMs cadence; tick walks
lastActivity Map and invokes ReflectionDueDetector.maybeEmit per subject.
finalize() clears the interval to prevent leaks on extension reload.

Constructor adds reflectionTickRateMs parameter; Components.js wiring
update in Task 11 sets production default to 3600000ms (1h tick).
Test-mode override (Task 14) uses 100ms tick + 200ms threshold for fast
integration tests.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: ShaclValidator constructor injection + hook invocation

**Files:**
- Modify: `css/extensions/shape-validator/src/storage/validators/ShaclValidator.ts`
- Modify: `css/extensions/shape-validator/test/ShaclValidator.test.ts` (add hook invocation tests)

- [ ] **Step 1: Write the failing test**

Create `css/extensions/shape-validator/test/ShaclValidatorHook.test.ts` (separate file — hook tests are independent from existing SHACL validation tests). This test focuses narrowly on the hook contract; it does not re-exercise the full SHACL validation pipeline:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ShaclValidator } from '../src/storage/validators/ShaclValidator';
import { NoOpUnprocessableWriteHook } from '../src/NoOpUnprocessableWriteHook';
import { ShaclValidationError } from '../src/error/ShaclValidationError';
import type { IUnprocessableWriteHook } from '@cogitarelink/mem-trigger/dist/hooks/IUnprocessableWriteHook';

const FAKE_REPORT = '@prefix sh: <http://www.w3.org/ns/shacl#> . [] a sh:ValidationReport ; sh:conforms false .';

/**
 * Helper: directly tests the rejection branch by stubbing the validator's
 * internal methods. This avoids the full SHACL pipeline (which would need
 * a shape, a malformed body, and a converter mock).
 *
 * We test the hook contract surgically: given that handle() reaches the
 * `!report.conforms` branch with a known reportTurtle, does it invoke the
 * hook and still throw?
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
  // Directly invoke the private serializeReport + rejection block via a
  // patched handle(). We monkey-patch the conforming check by stubbing
  // the validator's internal serializeReport and forcing the rejection
  // pathway.
  let thrown: unknown = null;
  try {
    // Call a test-only helper exposed via export (or use the public handle
    // pathway with a minimal mock). For purity, we call a small extracted
    // helper that the implementation exposes: see Step 3.
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
```

This test relies on the implementation exposing a small testable helper (`invokeHookAndThrow`) extracted from the rejection branch. Step 3 adds this extraction so the test is meaningful without re-implementing the full SHACL pipeline.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd css/extensions/shape-validator && npx vitest run test/ShaclValidatorHook.test.ts
```

Expected: FAIL — `invokeHookAndThrow` method doesn't exist; constructor doesn't accept the hook param.

- [ ] **Step 3: Modify ShaclValidator**

Edit `css/extensions/shape-validator/src/storage/validators/ShaclValidator.ts`.

Add imports:

```typescript
import { NoOpUnprocessableWriteHook } from '../../NoOpUnprocessableWriteHook';
import type { IUnprocessableWriteHook } from '@cogitarelink/mem-trigger/dist/hooks/IUnprocessableWriteHook';
```

Add field:

```typescript
  private readonly unprocessableHook: IUnprocessableWriteHook;
```

Modify constructor:

```typescript
  public constructor(
    converter: RepresentationConverter,
    auxiliaryStrategy: AuxiliaryStrategy,
    unprocessableHook?: IUnprocessableWriteHook,
  ) {
    super();
    this.converter = converter;
    this.auxiliaryStrategy = auxiliaryStrategy;
    this.unprocessableHook = unprocessableHook ?? new NoOpUnprocessableWriteHook();
  }
```

Extract the rejection branch into a testable helper. Replace the existing rejection block in `handle()` (currently lines 84-87):

```typescript
    if (!report.conforms) {
      const reportTurtle = await this.serializeReport(report.dataset);
      await this.invokeHookAndThrow(representation.metadata.identifier.value, reportTurtle, shapeURL);
    }
```

Add the new method:

```typescript
  /**
   * Invokes IUnprocessableWriteHook (substrate archival) and then throws
   * ShaclValidationError. Hook errors are swallowed — the 422 must always
   * be returned to the agent regardless of substrate archival outcome.
   *
   * Exposed as a method (rather than inline) so the hook contract is
   * unit-testable without driving the full SHACL pipeline.
   */
  public async invokeHookAndThrow(
    targetUri: string,
    reportTurtle: string,
    shapeURL: string = 'urn:test:no-shape-url',
  ): Promise<void> {
    try {
      await this.unprocessableHook.onShaclRejection({
        targetUri,
        validationReport: reportTurtle,
        timestamp: new Date(),
      });
    } catch (hookErr: unknown) {
      const msg = hookErr instanceof Error ? hookErr.message : String(hookErr);
      this.logger.warn(`UnprocessableWrite hook error (substrate event archival failed; 422 still returned to agent): ${msg}`);
    }
    throw new ShaclValidationError(shapeURL, reportTurtle);
  }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd css/extensions/shape-validator && npx vitest run test/ShaclValidatorHook.test.ts
```

Expected: PASS (3/3).

- [ ] **Step 5: Run all shape-validator tests**

```bash
cd css/extensions/shape-validator && npm test 2>&1 | tail -20
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add css/extensions/shape-validator/src/storage/validators/ShaclValidator.ts \
        css/extensions/shape-validator/test/ShaclValidatorHook.test.ts
git commit -m "$(cat <<'EOF'
[Agent: Claude] shape-validator: invoke IUnprocessableWriteHook on SHACL fail

ShaclValidator gains an optional unprocessableHook constructor param
(defaults to NoOpUnprocessableWriteHook). On SHACL rejection, the hook
is called BEFORE throwing the 422, wrapped in try/catch — substrate
errors do not mask the 422 from the agent. Components.js wiring to
MemTrigger impl in Task 11.

In-context delivery for the agent stays via the existing 422 response
body (sh:ValidationReport); the hook archives the same content to
/.events/ for posterity and follower agents.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Components.js wiring — IUnprocessableWriteHook + new MemTriggerListener constructor params

**Files:**
- Modify: `css/config/shape-validation/shape-validation.json`
- Modify: `css/config/mem-trigger.json`

- [ ] **Step 1: Add no-op default binding for IUnprocessableWriteHook**

Edit `css/config/shape-validation/shape-validation.json`. Locate the ShaclValidator instance declaration. Add an `unprocessableHook` parameter pointing at a new NoOp instance:

```json
{
  "@id": "urn:cogitarelink:NoOpUnprocessableWriteHook",
  "@type": "NoOpUnprocessableWriteHook"
}
```

In the ShaclValidator instance, add the constructor argument:

```json
"unprocessableHook": { "@id": "urn:cogitarelink:NoOpUnprocessableWriteHook" }
```

- [ ] **Step 2: Update mem-trigger.json with new MemTriggerListener constructor params**

Edit `css/config/mem-trigger.json`. Modify the MemTriggerListener instance to include the new `reflectionTickRateMs` and `typeIndexUri` parameters. Production defaults:

```json
{
  "@id": "urn:cogitarelink:MemTriggerListener",
  "@type": "MemTriggerListener",
  "monitoringStore": { "@id": "urn:solid-server:default:ResourceStore" },
  "store": { "@id": "urn:solid-server:default:ResourceStore" },
  "eventsContainer": "https://pod.vardeman.me/vault/wiki/.events/",
  "baseUrl": { "@id": "urn:solid-server:default:variable:baseUrl" },
  "boundThreshold": 12,
  "reflectionIntervalMs": 86400000,
  "reflectionTickRateMs": 3600000,
  "contradictoryPairs": [
    [
      "https://pod.vardeman.me/vault/ontology/wiki#supports",
      "https://pod.vardeman.me/vault/ontology/wiki#criticizes"
    ]
  ],
  "typeIndexUri": "https://pod.vardeman.me/vault/settings/publicTypeIndex"
}
```

- [ ] **Step 3: Declare module-scope detector + emitter instances**

The hook impls (Tasks 4 + 5) take a detector + EventEmitter via constructor. The existing `MemTriggerListener` constructs its own detector/emitter instances internally; the hooks need their own. Add these declarations to `mem-trigger.json`'s `@graph` array (siblings to MemTriggerListener):

```json
{
  "comment": "Standalone UnprocessableWriteDetector for MemTriggerUnprocessableWriteHook. Stateless — no concurrency concern with MemTriggerListener's internal instance.",
  "@id": "urn:cogitarelink:UnprocessableWriteDetectorStandalone",
  "@type": "UnprocessableWriteDetector"
},
{
  "comment": "Standalone ContradictionDetector for MemTriggerPostProjectionHook.",
  "@id": "urn:cogitarelink:ContradictionDetectorStandalone",
  "@type": "ContradictionDetector",
  "contradictoryPairs": [
    [
      "https://pod.vardeman.me/vault/ontology/wiki#supports",
      "https://pod.vardeman.me/vault/ontology/wiki#criticizes"
    ]
  ]
},
{
  "comment": "Standalone EventEmitter pointing at the same /.events/ container as MemTriggerListener. Shares the underlying store so writes go to the same place.",
  "@id": "urn:cogitarelink:EventEmitterStandalone",
  "@type": "EventEmitter",
  "store": { "@id": "urn:solid-server:default:ResourceStore" },
  "eventsContainer": "https://pod.vardeman.me/vault/wiki/.events/"
}
```

If the underlying `EventEmitter`, `UnprocessableWriteDetector`, or `ContradictionDetector` TypeScript classes are not exported via the Components.js context (check `css/extensions/mem-trigger/components/`), the `@type` declarations will fail at boot with "Could not load class or interface". In that case, ensure each class is exported in `src/index.ts` and re-run `componentsjs-generator` (or run `npm run build` if the package has a wrap-script).

- [ ] **Step 4: Add Components.js Override binding ShaclValidator's hook**

Still in `css/config/mem-trigger.json`, add the MemTriggerUnprocessableWriteHook instance and the Override:

```json
{
  "@id": "urn:cogitarelink:MemTriggerUnprocessableWriteHook",
  "@type": "MemTriggerUnprocessableWriteHook",
  "detector": { "@id": "urn:cogitarelink:UnprocessableWriteDetectorStandalone" },
  "emitter": { "@id": "urn:cogitarelink:EventEmitterStandalone" }
},
{
  "comment": "Bind ShaclValidator's unprocessableHook to MemTrigger impl when mem-trigger is installed.",
  "@type": "Override",
  "overrideInstance": { "@id": "urn:cogitarelink:ShaclValidator" },
  "overrideParameters": {
    "@type": "ShaclValidator",
    "unprocessableHook": { "@id": "urn:cogitarelink:MemTriggerUnprocessableWriteHook" }
  }
}
```

The `urn:cogitarelink:ShaclValidator` @id must match the existing declaration in `shape-validation.json`. If the existing @id differs (e.g., `urn:solid-server:default:ShaclValidator`), adjust accordingly. The K1 limitation (one Override per instance) means this Override targets a different instance than the existing WorkerParallelInitializer Override — no conflict.

- [ ] **Step 5: Boot the Pod and verify**

```bash
docker compose down && docker compose up -d --build
sleep 20
docker compose logs 2>&1 | grep -E "(Error|MemTrigger|markdown-projection)" | tail -30
```

Expected: no Components.js boot errors; MemTriggerListener attaches; no "Could not load class or interface" or "Detected more than one key value" errors.

Smoke a SHACL-failing write:

```bash
curl -X PUT http://localhost:3000/vault/wiki/concepts/test-bad-shacl.md \
  -H "Content-Type: text/markdown" \
  -d "no required frontmatter" -v 2>&1 | tail -20
```

Expected: 422 response with Turtle `sh:ValidationReport` body (existing behavior).

Check `/.events/` for the archived event:

```bash
curl -H "Accept: text/turtle" http://localhost:3000/vault/wiki/.events/ 2>&1 | grep -E "(contains|UnprocessableWrite)"
```

Expected: at least one resource listed; fetching it shows `mem:UnprocessableWrite` Turtle.

- [ ] **Step 6: Commit**

```bash
git add css/config/shape-validation/shape-validation.json css/config/mem-trigger.json
git commit -m "$(cat <<'EOF'
[Agent: Claude] config: wire IUnprocessableWriteHook + new MemTrigger params

shape-validation.json: ShaclValidator declares unprocessableHook param
with NoOpUnprocessableWriteHook as default binding.

mem-trigger.json:
- MemTriggerListener gets reflectionTickRateMs=3600000 (1h prod default)
  and typeIndexUri pointing at /vault/settings/publicTypeIndex.
- contradictoryPairs default to [(wiki:supports, wiki:criticizes)] per
  HR-6 / spec Section 3.3.
- Override swaps ShaclValidator.unprocessableHook from NoOp to
  MemTriggerUnprocessableWriteHook when mem-trigger is installed.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: MarkdownProjectionListener edge retention + hook invocation

**Files:**
- Modify: `css/extensions/markdown-projection/src-cjs/listener.ts`
- Modify: `css/extensions/markdown-projection/test/projectionPipeline.test.ts` (add hook invocation test)

- [ ] **Step 1: Write the failing test**

Create `css/extensions/markdown-projection/test/listenerHook.test.ts`. This test exercises the *hook contract* in isolation by extracting the edge-filter + hook-invocation logic into a testable helper (added in Step 3). The full listener pipeline is exercised separately by existing tests in `projectionPipeline.test.ts`.

```typescript
import { describe, it, expect, vi } from 'vitest';
import { DataFactory } from 'n3';
import { NoOpPostProjectionHook } from '../src-cjs/NoOpPostProjectionHook';
import { invokePostProjectionHook } from '../src-cjs/listener';

const { namedNode, quad } = DataFactory;

const WIKI_SUPPORTS = 'https://pod.vardeman.me/vault/ontology/wiki#supports';
const TARGET_URI = 'https://pod.vardeman.me/vault/wiki/concepts/x.md';
const THIS_IRI = `${TARGET_URI}#this`;
const Y_THIS = 'https://pod.vardeman.me/vault/wiki/concepts/y.md#this';

describe('invokePostProjectionHook (extracted helper)', () => {
  it('passes <#this>-subject edges to hook.onEdgesWritten', async () => {
    const hook = { onEdgesWritten: vi.fn().mockResolvedValue(undefined) };
    const triples = [
      quad(namedNode(THIS_IRI), namedNode(WIKI_SUPPORTS), namedNode(Y_THIS)),
      quad(namedNode(TARGET_URI), namedNode('http://purl.org/dc/terms/title'), namedNode('foo')),
    ];

    await invokePostProjectionHook(hook, TARGET_URI, triples);

    expect(hook.onEdgesWritten).toHaveBeenCalledOnce();
    const input = hook.onEdgesWritten.mock.calls[0][0];
    expect(input.subject).toBe(THIS_IRI);
    expect(input.edges).toEqual([{ predicate: WIKI_SUPPORTS, object: Y_THIS }]);
  });

  it('invokes hook with empty edges array when no <#this> edges produced', async () => {
    const hook = { onEdgesWritten: vi.fn().mockResolvedValue(undefined) };
    const triples = [
      quad(namedNode(TARGET_URI), namedNode('http://purl.org/dc/terms/title'), namedNode('foo')),
    ];

    await invokePostProjectionHook(hook, TARGET_URI, triples);

    expect(hook.onEdgesWritten).toHaveBeenCalledOnce();
    const input = hook.onEdgesWritten.mock.calls[0][0];
    expect(input.edges).toEqual([]);
  });

  it('swallows hook errors (logs but does not throw)', async () => {
    const hook = {
      onEdgesWritten: vi.fn().mockRejectedValue(new Error('hook crashed')),
    };
    const triples = [
      quad(namedNode(THIS_IRI), namedNode(WIKI_SUPPORTS), namedNode(Y_THIS)),
    ];

    await expect(invokePostProjectionHook(hook, TARGET_URI, triples)).resolves.toBeUndefined();
  });

  it('NoOp default resolves without error for any input', async () => {
    const hook = new NoOpPostProjectionHook();
    const triples = [
      quad(namedNode(THIS_IRI), namedNode(WIKI_SUPPORTS), namedNode(Y_THIS)),
    ];
    await expect(invokePostProjectionHook(hook, TARGET_URI, triples)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd css/extensions/markdown-projection && npx vitest run test/listenerHook.test.ts
```

Expected: FAIL — hook not called; the listener doesn't inject or invoke `IPostProjectionHook`.

- [ ] **Step 3: Modify the listener and extract the testable helper**

Edit `css/extensions/markdown-projection/src-cjs/listener.ts`.

Add imports near the top:

```typescript
import { NoOpPostProjectionHook } from "./NoOpPostProjectionHook";
import type { IPostProjectionHook } from "@cogitarelink/mem-trigger/dist/hooks/IPostProjectionHook";
```

In the listener class, add a field and accept the hook in the constructor (the listener's existing constructor takes several params — append `postProjectionHook` as the last optional one):

```typescript
private readonly postProjectionHook: IPostProjectionHook;

// In constructor body, add this assignment after the existing assignments:
this.postProjectionHook = postProjectionHook ?? new NoOpPostProjectionHook();
```

After the existing `await writer.replaceGoverned(...)` call (currently around line 273), add the hook invocation:

```typescript
        // After .meta is written, surface <#this> subject edges to the
        // post-projection hook (consumed by mem-trigger's
        // ContradictionDetector). No-op default when mem-trigger absent.
        await invokePostProjectionHook(this.postProjectionHook, target.path, triples);
```

Add the exported helper at module scope (so the unit test can import it directly):

```typescript
import type { Quad } from "n3";

/**
 * Filter triples to <#this>-subject edges and invoke the post-projection hook.
 * Hook errors are swallowed — substrate archival failures must not block the
 * .meta write that just succeeded.
 *
 * Exported so unit tests can exercise the hook contract without driving the
 * full projection pipeline.
 */
export async function invokePostProjectionHook(
  hook: IPostProjectionHook,
  targetUri: string,
  triples: Quad[],
): Promise<void> {
  const thisIri = `${targetUri}#this`;
  const edges = triples
    .filter((q) => q.subject.value === thisIri)
    .map((q) => ({ predicate: q.predicate.value, object: q.object.value }));
  try {
    await hook.onEdgesWritten({
      subject: thisIri,
      edges,
      timestamp: new Date(),
    });
  } catch (hookErr: unknown) {
    const msg = hookErr instanceof Error ? hookErr.message : String(hookErr);
    console.error(`[markdown-projection] postProjection hook error (substrate event archival failed; .meta still written): ${msg}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd css/extensions/markdown-projection && npx vitest run test/listenerHook.test.ts
```

Expected: PASS on both new tests.

- [ ] **Step 5: Run all markdown-projection tests**

```bash
cd css/extensions/markdown-projection && npm test 2>&1 | tail -20
```

Expected: all green; existing projection tests unaffected (edge retention is a strict superset — no behavior change in `.meta` writes).

- [ ] **Step 6: Commit**

```bash
git add css/extensions/markdown-projection/src-cjs/listener.ts \
        css/extensions/markdown-projection/test/listenerHook.test.ts
git commit -m "$(cat <<'EOF'
[Agent: Claude] markdown-projection: invoke IPostProjectionHook after .meta

After MetaWriter.replaceGoverned completes, the listener filters
projected triples to <#this> subject edges and invokes
postProjectionHook.onEdgesWritten. Default is NoOpPostProjectionHook;
Components.js Override in Task 13 swaps in MemTrigger's impl when
mem-trigger is installed.

Hook errors are swallowed (warn-and-continue) — substrate archival
failures must not block .meta writes.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Components.js wiring — IPostProjectionHook Override

**Files:**
- Modify: `css/config/markdown-projection.json`
- Modify: `css/config/mem-trigger.json`

- [ ] **Step 1: Add no-op default binding to markdown-projection.json**

Edit `css/config/markdown-projection.json`. Declare the NoOp instance and add the `postProjectionHook` parameter to MarkdownProjectionListener:

```json
{
  "@id": "urn:cogitarelink:NoOpPostProjectionHook",
  "@type": "NoOpPostProjectionHook"
}
```

In the MarkdownProjectionListener instance, add:

```json
"postProjectionHook": { "@id": "urn:cogitarelink:NoOpPostProjectionHook" }
```

- [ ] **Step 2: Add Override binding to MemTrigger impl in mem-trigger.json**

Edit `css/config/mem-trigger.json`. Add the MemTriggerPostProjectionHook instance (reusing the standalone detector + emitter @ids declared in Task 11 Step 3) and the Override:

```json
{
  "@id": "urn:cogitarelink:MemTriggerPostProjectionHook",
  "@type": "MemTriggerPostProjectionHook",
  "detector": { "@id": "urn:cogitarelink:ContradictionDetectorStandalone" },
  "emitter": { "@id": "urn:cogitarelink:EventEmitterStandalone" }
},
{
  "comment": "Bind MarkdownProjectionListener's postProjectionHook to MemTrigger impl when mem-trigger is installed.",
  "@type": "Override",
  "overrideInstance": { "@id": "urn:cogitarelink:MarkdownProjectionListener" },
  "overrideParameters": {
    "@type": "MarkdownProjectionListener",
    "postProjectionHook": { "@id": "urn:cogitarelink:MemTriggerPostProjectionHook" }
  }
}
```

Note: the K1 limit (one Override per instance) means this Override targets `MarkdownProjectionListener`, distinct from the existing WorkerParallelInitializer Override that also touches MarkdownProjectionListener via the handlers list. These are at different levels (instance vs. list-membership) and should not conflict, but watch for the "Detected more than one key value" preprocess error at boot — if it appears, consolidate the two Overrides per the K1 pattern.

- [ ] **Step 3: Boot the Pod and verify**

```bash
docker compose down && docker compose up -d --build
sleep 20
docker compose logs 2>&1 | grep -E "(Error|MemTrigger|markdown-projection)" | tail -30
```

Expected: no errors; both listeners attach.

Smoke a contradiction write:

```bash
curl -X PUT http://localhost:3000/vault/wiki/concepts/test-contra-$(uuidgen).md \
  -H "Content-Type: text/markdown" \
  --data-binary $'---\ntype: concept-note\n---\n# test\n\n[[Y]]{.supports} and [[Y]]{.criticizes}\n' \
  -v 2>&1 | tail -10
```

Expected: 201 Created.

Check `/.events/` for a fresh `mem:ContradictionDetected`:

```bash
curl -H "Accept: text/turtle" http://localhost:3000/vault/wiki/.events/ 2>&1 | grep -E "(contains|Contradiction)"
```

- [ ] **Step 4: Commit**

```bash
git add css/config/markdown-projection.json css/config/mem-trigger.json
git commit -m "$(cat <<'EOF'
[Agent: Claude] config: wire IPostProjectionHook MarkdownProjection → MemTrigger

markdown-projection.json: MarkdownProjectionListener declares
postProjectionHook param with NoOpPostProjectionHook as default.

mem-trigger.json: Override swaps in MemTriggerPostProjectionHook when
mem-trigger is installed. Hook receives <#this>-subject edges from the
just-completed projection.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Test-mode config for short ReflectionDue intervals

**Files:**
- Create: `css/config/mem-trigger-test.json`

- [ ] **Step 1: Create the test config**

`css/config/mem-trigger-test.json`:

```json
{
  "@context": [
    "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^8.0.0/components/context.jsonld",
    "https://linkedsoftwaredependencies.org/bundles/npm/mem-trigger/^0.1.0/components/context.jsonld"
  ],
  "@graph": [
    {
      "comment": "Test-mode override: short intervals so test_reflection_due_emits_event completes in <1s. Override semantics replace the production reflectionIntervalMs (86400000) and reflectionTickRateMs (3600000) with 200ms / 100ms respectively. Loaded only when SOLID_TEST_MODE_MEM_TRIGGER=1 is set.",
      "@type": "Override",
      "overrideInstance": { "@id": "urn:cogitarelink:MemTriggerListener" },
      "overrideParameters": {
        "@type": "MemTriggerListener",
        "reflectionIntervalMs": 200,
        "reflectionTickRateMs": 100
      }
    }
  ]
}
```

- [ ] **Step 2: Add docker-compose env hook (or document manual import)**

Document in the test config's comment (and in the integration test docstring) how to activate this config. Two options:

1. **Compose override** (recommended): create `docker-compose.test.yml` that loads this config via `CSS_CONFIG` env override.
2. **Manual import** in the CSS config file: load this file via `@import` in `solid-config.json` (gated behind a test flag).

For simplicity, document the manual approach in `README.md` (Task 20) and let the test fixture (Task 18) handle config selection via env vars passed to `docker compose up`.

- [ ] **Step 3: Commit**

```bash
git add css/config/mem-trigger-test.json
git commit -m "$(cat <<'EOF'
[Agent: Claude] config: test-mode mem-trigger override with short intervals

Loads in test runs to make test_reflection_due_emits_event practical:
reflectionIntervalMs=200, reflectionTickRateMs=100 — fast enough that
the test completes in <1s. Documented activation pattern in
extension README (Task 20).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Un-skip test_bound_exceeded_emits_event

**Files:**
- Modify: `tests/integration/test_mem_events.py`

- [ ] **Step 1: Write the test body**

Replace the existing stub:

```python
import pytest
import httpx
import uuid
import time
from urllib.parse import quote


POD_BASE = "http://localhost:3000"
CONCEPTS = f"{POD_BASE}/vault/wiki/concepts/"
EVENTS = f"{POD_BASE}/vault/wiki/.events/"


def _read_events_targeting(container_uri: str) -> list[str]:
    """List event resource URIs in /.events/, return those whose Turtle mentions container_uri."""
    r = httpx.get(EVENTS, headers={"Accept": "text/turtle"}, timeout=10)
    r.raise_for_status()
    # Naive parse: find each ldp:contains target.
    contained = []
    for line in r.text.splitlines():
        line = line.strip()
        if line.startswith("<") and "ldp:contains" not in line:
            pass  # subjects, not targets — body below catches members
    # Simpler: just iterate over child URIs by HEAD via ldp:contains.
    # For test purposes, fetch every listed member and check.
    matches = []
    # CSS exposes container as Turtle: members appear as objects of ldp:contains.
    import re
    for m in re.finditer(r"<([^>]+)>\s*\.", r.text):
        member = m.group(1)
        if "/.events/" not in member:
            continue
        try:
            mr = httpx.get(member, headers={"Accept": "text/turtle"}, timeout=5)
            if container_uri in mr.text:
                matches.append(member)
        except httpx.HTTPError:
            continue
    return matches


def test_bound_exceeded_emits_event():
    """Writing 13 resources into a fresh container triggers a mem:BoundExceeded event."""
    test_container_slug = f"test-bound-{uuid.uuid4().hex[:8]}"
    test_container_uri = f"{CONCEPTS}{test_container_slug}/"

    # PUT 13 resources to push the container over the Fano bound (12).
    for i in range(13):
        body = f"---\ntype: concept-note\nprefLabel: child-{i}\n---\n# child-{i}\n"
        r = httpx.put(
            f"{test_container_uri}child-{i}.md",
            content=body,
            headers={"Content-Type": "text/markdown"},
            timeout=10,
        )
        assert r.status_code in (201, 204), f"PUT {i} failed: {r.status_code} {r.text}"
        # Brief sleep so the chain Promise in MemTriggerListener drains between writes.
        time.sleep(0.1)

    # Allow the last chain to drain.
    time.sleep(1.0)

    # Look for a mem:BoundExceeded event targeting our container.
    matches = _read_events_targeting(test_container_uri)
    assert len(matches) >= 1, f"No mem:BoundExceeded event found for {test_container_uri}"

    # Verify the event content
    event_turtle = httpx.get(matches[0], headers={"Accept": "text/turtle"}, timeout=5).text
    assert "mem:BoundExceeded" in event_turtle
    assert test_container_uri in event_turtle
```

- [ ] **Step 2: Bring up the Pod with mem-trigger-test.json config loaded**

```bash
# Bring up Pod with production config (test-mode not needed for bound test)
docker compose down && docker compose up -d
sleep 20
```

- [ ] **Step 3: Run the test**

```bash
export SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem
~/uvws/.venv/bin/python -m pytest tests/integration/test_mem_events.py::test_bound_exceeded_emits_event -v 2>&1 | tail -20
```

Expected: PASS.

If it fails, troubleshoot:
- Check `docker compose logs | grep -i error` for backend errors.
- Verify `curl -H "Accept: text/turtle" $EVENTS` returns a listing (not 404 / not empty).
- Inspect `/.events/` member Turtle for `mem:BoundExceeded` predicate (the detector might emit but the assertion regex might be off).

- [ ] **Step 4: Commit**

```bash
git add tests/integration/test_mem_events.py
git commit -m "$(cat <<'EOF'
[Agent: Claude] integration: un-skip test_bound_exceeded_emits_event

Writes 13 resources into a fresh /vault/wiki/concepts/ subcontainer,
asserts a mem:BoundExceeded event lands in /.events/ targeting the
container URI. Uses naive Turtle scan to locate the event (full SPARQL
querying deferred until pod-query skill stabilizes).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Un-skip test_unprocessable_write_emits_event

**Files:**
- Modify: `tests/integration/test_mem_events.py`

- [ ] **Step 1: Write the test body**

Replace the second `pytest.skip` stub:

```python
def test_unprocessable_write_emits_event():
    """A SHACL-rejected write produces a mem:UnprocessableWrite event in .events/."""
    target_uri = f"{CONCEPTS}test-bad-{uuid.uuid4().hex[:8]}.md"

    # Write a body that lacks the required ConceptShape fields
    # (e.g., missing skos:prefLabel projection from frontmatter).
    bad_body = "# no frontmatter, no required fields\n"
    r = httpx.put(
        target_uri,
        content=bad_body,
        headers={"Content-Type": "text/markdown"},
        timeout=10,
    )
    assert r.status_code == 422, f"Expected SHACL rejection, got {r.status_code}: {r.text}"
    assert "sh:ValidationReport" in r.text, "422 response body should carry sh:ValidationReport"

    # Allow chain drain.
    time.sleep(0.5)

    # The event archive should record the rejection.
    matches = _read_events_targeting(target_uri)
    assert len(matches) >= 1, f"No mem:UnprocessableWrite event found for {target_uri}"

    event_turtle = httpx.get(matches[0], headers={"Accept": "text/turtle"}, timeout=5).text
    assert "mem:UnprocessableWrite" in event_turtle
    assert target_uri in event_turtle
    assert "sh:ValidationReport" in event_turtle  # same report content as the 422 body
```

- [ ] **Step 2: Run the test**

```bash
~/uvws/.venv/bin/python -m pytest tests/integration/test_mem_events.py::test_unprocessable_write_emits_event -v 2>&1 | tail -20
```

Expected: PASS.

Troubleshoot if needed: confirm the existing ConceptShape rejects the malformed body (the test should send something the shape genuinely refuses). If the shape doesn't reject what the test sends, adjust the test payload to violate a specific constraint (e.g., missing required predicate per ConceptShape minCount=1).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/test_mem_events.py
git commit -m "$(cat <<'EOF'
[Agent: Claude] integration: un-skip test_unprocessable_write_emits_event

Sends a body that violates ConceptShape, confirms 422 with
sh:ValidationReport in response body, then verifies the same report
content appears in a mem:UnprocessableWrite event in /.events/.
Validates the in-context (422) + archival (/.events/) dual-channel
delivery for SHACL rejections.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Un-skip test_contradiction_detected_emits_event

**Files:**
- Modify: `tests/integration/test_mem_events.py`

- [ ] **Step 1: Write the test body**

Replace the third `pytest.skip` stub:

```python
def test_contradiction_detected_emits_event():
    """Adding wiki:supports + wiki:criticizes for same object fires mem:ContradictionDetected."""
    target_slug = f"test-contra-{uuid.uuid4().hex[:8]}"
    target_uri = f"{CONCEPTS}{target_slug}.md"
    other_uri = f"{CONCEPTS}{target_slug}-other"

    # Body with conflicting wikilinks pointing at the same target.
    body = (
        "---\ntype: concept-note\nprefLabel: contra-test\n---\n"
        f"# contra test\n\n"
        f"This [[{target_slug}-other]]{{.supports}} something. "
        f"It also [[{target_slug}-other]]{{.criticizes}} that same thing.\n"
    )
    r = httpx.put(
        target_uri,
        content=body,
        headers={"Content-Type": "text/markdown"},
        timeout=10,
    )
    assert r.status_code in (201, 204), f"PUT failed: {r.status_code} {r.text}"

    # Allow .meta projection + hook chain to drain.
    time.sleep(1.0)

    matches = _read_events_targeting(target_uri)
    assert len(matches) >= 1, f"No mem:ContradictionDetected event found for {target_uri}"

    event_turtle = httpx.get(matches[0], headers={"Accept": "text/turtle"}, timeout=5).text
    assert "mem:ContradictionDetected" in event_turtle
    assert target_uri in event_turtle
```

- [ ] **Step 2: Run the test**

```bash
~/uvws/.venv/bin/python -m pytest tests/integration/test_mem_events.py::test_contradiction_detected_emits_event -v 2>&1 | tail -20
```

Expected: PASS.

Troubleshoot:
- Confirm the wikilink class-annotation syntax (`[[X]]{.supports}`) is the format MarkdownProjectionListener parses. Inspect `css/extensions/markdown-projection/src/wikilinks.ts` for the actual regex.
- If MarkdownProjectionListener doesn't project conflicting edges into the .meta, the hook receives empty edges and contradiction never fires. Verify the edges by GET `<target>.meta` and grep for `wiki:supports` + `wiki:criticizes`.
- If both edges are in .meta but contradiction still doesn't fire, check `contradictoryPairs` in mem-trigger.json matches the projected predicate IRIs exactly (full URIs, not CURIEs).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/test_mem_events.py
git commit -m "$(cat <<'EOF'
[Agent: Claude] integration: un-skip test_contradiction_detected_emits_event

PUTs a body containing both [[X]]{.supports} and [[X]]{.criticizes}
wikilinks; expects MarkdownProjectionListener to project both edges
into .meta, then invokes the postProjectionHook which runs
ContradictionDetector and emits mem:ContradictionDetected to /.events/.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: Un-skip test_reflection_due_emits_event

**Files:**
- Modify: `tests/integration/test_mem_events.py`
- Possibly create: `docker-compose.test-mem-trigger.yml` (or document env activation)

- [ ] **Step 1: Document and load the test-mode config**

This test requires the Pod to be started with `mem-trigger-test.json` loaded so the ReflectionDue interval is 200ms instead of 24h.

Either:

(a) Edit `css/config/solid-config.json` to conditionally `@import` the test override (gated behind an env var if CSS supports it), or
(b) Create `docker-compose.test-mem-trigger.yml` that mounts the test config into the container.

For (b):

```yaml
# docker-compose.test-mem-trigger.yml
services:
  css:
    environment:
      - CSS_EXTRA_CONFIG=/etc/cogitarelink/mem-trigger-test.json
    volumes:
      - ./css/config/mem-trigger-test.json:/etc/cogitarelink/mem-trigger-test.json:ro
```

Then start the Pod with: `docker compose -f docker-compose.yml -f docker-compose.test-mem-trigger.yml up -d`.

CSS's actual mechanism for loading extra config files depends on the existing setup — check the Dockerfile + entrypoint. The exact wiring is left to the implementer.

- [ ] **Step 2: Write the test body**

Replace the fourth `pytest.skip` stub:

```python
def test_reflection_due_emits_event():
    """After 24h-equivalent of activity without emission, mem:ReflectionDue is emitted.

    Requires Pod started with mem-trigger-test.json loaded:
        reflectionIntervalMs=200ms, reflectionTickRateMs=100ms.
    """
    target_slug = f"test-reflect-{uuid.uuid4().hex[:8]}"
    target_uri = f"{CONCEPTS}{target_slug}.md"

    body = (
        "---\ntype: concept-note\nprefLabel: reflect-test\n---\n"
        f"# reflect test\n"
    )
    r = httpx.put(
        target_uri,
        content=body,
        headers={"Content-Type": "text/markdown"},
        timeout=10,
    )
    assert r.status_code in (201, 204)

    # Wait > intervalMs + a tick.
    time.sleep(0.4)

    matches = _read_events_targeting(target_uri)
    assert len(matches) >= 1, f"No mem:ReflectionDue event found for {target_uri}"

    event_turtle = httpx.get(matches[0], headers={"Accept": "text/turtle"}, timeout=5).text
    assert "mem:ReflectionDue" in event_turtle
    assert target_uri in event_turtle
```

- [ ] **Step 3: Run the test with test-mode config**

```bash
docker compose -f docker-compose.yml -f docker-compose.test-mem-trigger.yml down
docker compose -f docker-compose.yml -f docker-compose.test-mem-trigger.yml up -d
sleep 20

~/uvws/.venv/bin/python -m pytest tests/integration/test_mem_events.py::test_reflection_due_emits_event -v 2>&1 | tail -20
```

Expected: PASS.

Troubleshoot:
- Confirm the test-mode config loaded by checking logs for the `reflectionIntervalMs=200` value.
- If lastActivity isn't getting tracked, verify the Type Index loaded successfully (look for the warning log in MemTriggerListener.handle()).

- [ ] **Step 4: Commit**

```bash
git add tests/integration/test_mem_events.py docker-compose.test-mem-trigger.yml
git commit -m "$(cat <<'EOF'
[Agent: Claude] integration: un-skip test_reflection_due_emits_event

PUTs a resource to /vault/wiki/concepts/, waits past the test-mode
reflectionIntervalMs (200ms), expects a mem:ReflectionDue event in
/.events/ targeting the subject. Requires Pod started with
docker-compose.test-mem-trigger.yml loaded (short intervals).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 19: Adversarial cross-batch review

**Files:** None modified — review only

Per `agentic-development.md` "Cross-batch review is its own category": at sprint close, run an adversarial reviewer with cross-batch consistency as the primary lens. The per-task TDD already verified internal consistency; this catches mismatches across batches.

- [ ] **Step 1: Dispatch cross-batch review subagent**

Use the `Agent` tool with `subagent_type=Explore`. Prompt template:

```
You are reviewing the MemTrigger detector wiring sprint (commits since
8c3158b). The spec is at docs/superpowers/specs/2026-05-20-mem-trigger-detector-wiring-design.md
and the plan at docs/superpowers/plans/2026-05-20-mem-trigger-detector-wiring.md.

CROSS-BATCH CONSISTENCY is your primary lens — NOT "is each commit correct"
(that's already verified by per-task TDD).

Specifically check:

1. **Interface ↔ implementation agreement**:
   - IUnprocessableWriteHook signature matches NoOpUnprocessableWriteHook
     AND MemTriggerUnprocessableWriteHook exactly (same method name,
     same input shape, same return type).
   - IPostProjectionHook signature matches NoOpPostProjectionHook AND
     MemTriggerPostProjectionHook exactly.
   - If interfaces are imported across packages, the import paths resolve
     (or structural typing is used consistently).

2. **Components.js config ↔ TypeScript class agreement**:
   - Every constructor param in MemTriggerListener.ts has a corresponding
     entry in mem-trigger.json.
   - Param ordering matches between TS and JSON (Components.js positional
     args).
   - Override target @ids in mem-trigger.json match the declared @ids
     in shape-validation.json and markdown-projection.json.

3. **contradictoryPairs IRI consistency**:
   - The predicate IRIs in mem-trigger.json's contradictoryPairs match the
     predicate IRIs that MarkdownProjectionListener actually projects from
     [[X]]{.supports} and [[X]]{.criticizes} wikilinks. (If the listener
     projects wiki:supports as `https://pod.vardeman.me/vault/ontology/wiki#supports`
     but the config has the bare CURIE or a different base, the detector
     will never match.)

4. **Activity-path-filter ↔ Type-Index agreement**:
   - The durable containers loaded via loadDurableContainers match what
     /vault/settings/publicTypeIndex actually contains. If the listener
     filters by /vault/wiki/concepts/ but Type Index lists
     /vault/wiki/Concept/ (case-sensitive mismatch), activity tracking
     silently breaks.

5. **Hook invocation ↔ error semantics**:
   - ShaclValidator wraps hook in try/catch and still throws 422 — verify.
   - MarkdownProjectionListener wraps hook in try/catch and still completes
     .meta write — verify.

6. **Test fixture ↔ production config divergence**:
   - mem-trigger-test.json overrides reflectionIntervalMs and
     reflectionTickRateMs but does NOT accidentally override other
     production-relevant params (boundThreshold, contradictoryPairs, etc.).

7. **Stale documentation**:
   - FOLLOWUPS.md "Phase C.10 wiring scope + deferrals" should be
     struck through (Task 20).
   - MEMORY.md should not still describe checkBound as a stub.

Report findings in severity-ranked form (Error / Warning / Info).
Do NOT modify any files — surface issues only.
```

- [ ] **Step 2: Review findings and fix in follow-up commits**

For each Error-severity finding, create a fix commit. For Warnings, decide case-by-case. For Info, document in MEMORY.md under "Substrate-behavior findings".

- [ ] **Step 3: Commit cross-batch review record**

```bash
# If fixes were needed, they're already committed individually.
# If clean, append a note to MEMORY.md or just record in the sprint-close commit (Task 20).
```

---

## Task 20: Docs — README, FOLLOWUPS, MEMORY

**Files:**
- Create: `css/extensions/mem-trigger/README.md`
- Modify: `FOLLOWUPS.md`
- Modify: `.claude/memory/MEMORY.md`

- [ ] **Step 1: Write the README**

`css/extensions/mem-trigger/README.md`:

````markdown
# mem-trigger

CSS extension that emits memory-substrate event activities (`mem:*`) to a
configured LDN inbox at `/vault/wiki/.events/` when the substrate detects
specific conditions on writes or at periodic intervals.

## What it does

Four detectors, all unit-tested and wired:

| Detector | Trigger | Event |
|---|---|---|
| `BoundExceededDetector` | LDP container exceeds child-count threshold (default 12, Fano bound D77) | `mem:BoundExceeded` |
| `UnprocessableWriteDetector` | SHACL validation rejects a write | `mem:UnprocessableWrite` |
| `ContradictionDetector` | Body projection produces conflicting edges (default pair: `wiki:supports` + `wiki:criticizes`) | `mem:ContradictionDetected` |
| `ReflectionDueDetector` | A durable subject hasn't been reflected on within interval (default 24h) | `mem:ReflectionDue` |

## Hook interfaces

Two Components.js DI interfaces let other extensions provide trigger
inputs. Both ship NoOp defaults in producer extensions so mem-trigger is
an optional dependency.

| Interface | Producer | Default |
|---|---|---|
| `IUnprocessableWriteHook` | shape-validator | `NoOpUnprocessableWriteHook` |
| `IPostProjectionHook` | markdown-projection | `NoOpPostProjectionHook` |

When mem-trigger is installed, `mem-trigger.json` Override declarations
swap the NoOps for `MemTriggerUnprocessableWriteHook` /
`MemTriggerPostProjectionHook`.

## Delivery to consumers

Substrate events archive to `/vault/wiki/.events/<uuid>.ttl` as AS2
activities with `mem:*` multi-typing. Two patterns serve consumers:

- **Pattern A — post-write GET**: an authoring harness queries
  `/vault/wiki/.events/` after every write to find events targeting the
  just-written URI. Deterministic, no subscription needed.
- **Pattern C — Solid Notifications stream**: consumers subscribe to the
  inbox via Solid Notifications Protocol for streaming delivery. Works for
  external follower agents and for timer-driven `mem:ReflectionDue` events
  that have no write to ride.

Pattern B (atomic in-response Link headers) is **deferred** to
`RQ-Atomic-Feedback-1` in `.claude/memory/MEMORY.md`. Rung 1.5 eval must
include a task class measuring whether atomic feedback is worth the
architectural cost.

## Configuration

Production config: `css/config/mem-trigger.json`. Key params:

- `boundThreshold` (default 12)
- `reflectionIntervalMs` (default 86400000 = 24h)
- `reflectionTickRateMs` (default 3600000 = 1h)
- `contradictoryPairs` (default `[[wiki:supports, wiki:criticizes]]`)
- `typeIndexUri` (default `https://pod.vardeman.me/vault/settings/publicTypeIndex`)

Test-mode override: `css/config/mem-trigger-test.json` sets short
intervals (200ms / 100ms) for integration tests. Load via
`docker-compose.test-mem-trigger.yml`.

## See also

- Spec: `docs/superpowers/specs/2026-05-20-mem-trigger-detector-wiring-design.md`
- Decision: D101 (MemTrigger detector wiring and substrate-signal delivery model)
- D74 (memory-substrate triggers — the contract this extension implements)
````

- [ ] **Step 2: Strike through FOLLOWUPS Phase C.10**

Edit `FOLLOWUPS.md`. Locate the "Phase C.10 — MemTrigger v1 wiring" section. Wrap heading + content in strikethrough markdown (`~~...~~`) or replace with a closure note:

```markdown
## ~~Phase C.10 — MemTrigger v1 wiring (Memory Structuring Sprint, 2026-05-18)~~

**Closed 2026-05-20** by MemTrigger detector wiring sprint (D101).
See `docs/superpowers/specs/2026-05-20-mem-trigger-detector-wiring-design.md`.
All four detectors wired; four `test_mem_events.py` tests un-skipped and
passing.
```

- [ ] **Step 3: Update MEMORY.md with sprint completion**

Edit `.claude/memory/MEMORY.md`. Add a new section at the top (or after the Shape Completion Sprint summary):

```markdown
## MemTrigger Detector Wiring Sprint — Shipped (2026-05-20)

All four MemTrigger detectors wired. D74 substrate-self-monitoring
contract closed. Sprint tag: `mem-trigger-detector-wiring-complete`.

- **Four detectors wired**: BoundExceeded (real ldp:contains counter via
  store.getRepresentation), UnprocessableWrite (via IUnprocessableWriteHook
  from shape-validator), ContradictionDetected (via IPostProjectionHook
  from markdown-projection), ReflectionDue (setInterval timer + Type Index
  durable-path filter).
- **Two new hook interfaces**: IUnprocessableWriteHook and
  IPostProjectionHook, both Components.js DI with NoOp defaults in
  producer extensions. mem-trigger.json Overrides swap NoOps for
  MemTrigger impls when installed.
- **Delivery model**: A+C combined. Pattern A = client-side
  /vault/wiki/.events/ GET after writes. Pattern C = Solid Notifications
  subscription. Pattern B (atomic in-response Link headers) deferred to
  RQ-Atomic-Feedback-1 — Rung 1.5 must measure atomic vs deferred
  feedback for agent behavior.
- **D101 ratified**: MemTrigger detector wiring and substrate-signal
  delivery model.
- **Tests**: 4 test_mem_events.py integration tests un-skipped + passing
  on live Pod. ~5 new TS unit test files. No regressions in existing
  markdown-projection, shape-validator, memento test suites.

**Substrate-behavior findings** (durable):
- store.getRepresentation against the parent container from inside a
  MonitoringStore 'changed' handler works — the wiki-search D92
  re-entrant-lock issue does NOT apply to parent reads (target is
  different from the just-written resource).
- Components.js K1 (one Override per instance) accommodated: hook
  Overrides target ShaclValidator and MarkdownProjectionListener
  separately, distinct from mem-trigger.json's existing
  WorkerParallelInitializer Override.
- Pod's Type Index drives durable-container filter at runtime — adding
  an L4 overlay that registers a new class+container automatically
  extends MemTriggerListener's reflection-tracking scope on next restart.
```

- [ ] **Step 4: Commit**

```bash
git add css/extensions/mem-trigger/README.md FOLLOWUPS.md .claude/memory/MEMORY.md
git commit -m "$(cat <<'EOF'
[Agent: Claude] docs: MemTrigger sprint close — README + FOLLOWUPS + MEMORY

- New css/extensions/mem-trigger/README.md documenting the four
  detectors, two hook interfaces, A+C delivery patterns, and config.
- FOLLOWUPS.md "Phase C.10 — MemTrigger v1 wiring" struck through
  with closure note.
- MEMORY.md adds sprint completion section + D101 ratification +
  substrate-behavior findings + RQ-Atomic-Feedback-1 cross-ref.

Sprint tag: mem-trigger-detector-wiring-complete

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Tag the sprint**

```bash
git tag mem-trigger-detector-wiring-complete
```

---

## Final verification checklist

Run all four assertions in this order:

1. **All four integration tests pass**:
   ```bash
   ~/uvws/.venv/bin/python -m pytest tests/integration/test_mem_events.py -v
   ```
   Expected: 4 passed, 0 skipped.

2. **No regressions in existing test suites**:
   ```bash
   cd css/extensions/mem-trigger && npm test 2>&1 | tail -5
   cd ../shape-validator && npm test 2>&1 | tail -5
   cd ../markdown-projection && npm test 2>&1 | tail -5
   cd ../../.. && ~/uvws/.venv/bin/python -m pytest tests/ -v --ignore=tests/integration/test_mem_events.py 2>&1 | tail -5
   ```
   Expected: all green.

3. **Pod boots cleanly**:
   ```bash
   docker compose down && docker compose up -d && sleep 20
   docker compose logs 2>&1 | grep -iE "(error|exception)" | grep -v "INFO" | head
   ```
   Expected: no errors.

4. **No-op default smoke test** (verify shape-validator + markdown-projection still work without mem-trigger):
   - Temporarily comment out the mem-trigger import in `css/config/solid-config.json`, restart, do a write + a SHACL-failing write. Both behaviors should be byte-identical to pre-sprint (no errors, 422 with sh:ValidationReport for the failure case).

If all four pass, the sprint is shippable.

---

## Decision ratification

D101 ratifies on:
- Four `test_mem_events.py` tests passing on the live Pod
- No regressions in the existing 94+53+19 test baseline
- Sprint tag `mem-trigger-detector-wiring-complete` applied

Add D101 to `.claude/skills/decision-lookup/decisions.md` after the sprint closes.
