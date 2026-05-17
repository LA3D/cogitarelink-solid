# Wiki-Search CSS Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 7a wiki-search — a CSS extension that intercepts `GET /vault/wiki/?ext=search-grep&oslc.searchTerms=…`, runs literal-substring AND-search recursively over `text/markdown` bodies, returns an LDP+OSLC Turtle response with WAC-filtered, score-ranked, paginated matches, advertises itself via `Link: rel="queryBase"` headers and the D83 capability catalog, and is invokable from a `solid-pod wiki-search` CLI command.

**Architecture:** New CSS extension `css/extensions/wiki-search/` mirrors the structural pattern of `memento/` and `profile-link/`: a custom `HttpHandler` that claims `?ext=search-grep` requests in the BaseHttpHandler waterfall ahead of `LdpHandler`, plus a `MetadataWriter` that decorates container GET responses with the discovery Link header. A `SearchEngine` interface isolates engine choice (Phase 1 = pure-Node RegExp; Phase 7b will swap in BM25/ripgrep). The handler walks `ResourceStore` recursively, checks WAC per-resource via `PermissionReader`, runs the engine, scores by match density, sorts globally by score, paginates with `oslc:nextPage`. The capability + affordance are declared via the existing overlay machinery (D83); the consumer skill is a thin HTTP wrapper in the sibling `solid-agent-skills` repo.

**Tech Stack:** TypeScript (CommonJS, ES2022 target), CSS v8 alpha, Components.js DI, N3.js (RDF serialization), vitest (unit tests), Python pytest + httpx (integration tests against docker-compose pod), Node 20.

**Spec anchors:**
- Refinement spec: `docs/superpowers/specs/2026-05-18-wiki-search-refinement-design.md` (read first)
- Original plan: `docs/plans/2026-05-17-wiki-search-design.md` (read second; refined by the above)
- Decision: D87 in vault `SOLID-Pod-Decisions.md`

**Repo conventions to follow:**
- Git: `[Agent: Claude]` prefix; `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`; stage specific files (not `-A`); never force push.
- TypeScript: strict mode, CommonJS module (matches memento/profile-link), `componentsjs-generator` for DI metadata.
- Python: `~/uvws/.venv/bin/python` for all pytest invocations.
- Tests: unit tests in `css/extensions/wiki-search/tests/` (vitest); integration tests in `tests/integration/test_wiki_search_e2e.py` (pytest).

---

## File Structure

### Created in this plan

```
css/extensions/wiki-search/
├── package.json                          # @cogitarelink/wiki-search, lsd:* fields
├── tsconfig.json                         # CommonJS, strict, ES2022
├── vitest.config.ts                      # vitest config
├── src/
│   ├── index.ts                          # re-exports public classes
│   ├── WikiSearchHttpHandler.ts          # main HTTP handler; recursion + WAC + AND + paging
│   ├── WikiSearchLinkMetadataWriter.ts   # emits Link: rel="queryBase" on /vault/wiki/* GETs
│   ├── SearchEngine.ts                   # interface + types (SearchPattern, Match, SearchOptions)
│   ├── RegexpSearchEngine.ts             # Phase 1 implementation (pure Node RegExp)
│   ├── parseSearchTerms.ts               # strict OSLC §7.3 quoted-phrase parser
│   ├── parseQuery.ts                     # parses query string → SearchPattern + pagination
│   ├── ResponseBuilder.ts                # builds Turtle response with paging, oslc:nextPage
│   ├── snippet.ts                        # extracts halo-bounded snippet around match offset
│   ├── score.ts                          # density-based score formula
│   ├── uri.ts                            # isUnderBaseUrl, container-path helpers
│   └── walker.ts                         # recursive ResourceStore BFS with WAC subtree-omission
└── tests/
    ├── RegexpSearchEngine.test.ts
    ├── parseSearchTerms.test.ts
    ├── parseQuery.test.ts
    ├── ResponseBuilder.test.ts
    ├── snippet.test.ts
    ├── score.test.ts
    └── walker.test.ts

css/config/
└── wiki-search.json                      # NEW Components.js wiring (handler insert + MetadataWriter override step)

css/
└── Dockerfile                            # MODIFIED: add wiki-search build + symlink block

css/config/
└── solid-config.json                     # MODIFIED: add wiki-search.json to import list + lsd context

overlays/wiki-memory/
├── capabilities/
│   └── wiki-search-substrate.ttl         # NEW capability descriptor
├── affordances/
│   └── wiki-search-grep.ttl              # NEW affordance descriptor
└── manifest.ttl                          # MODIFIED: add providesCapability + installsAffordance

tests/integration/
└── test_wiki_search_e2e.py               # NEW pytest e2e integration tests

# In sibling repo: ~/dev/git/LA3D/agents/solid-agent-skills/
src/
├── cli.ts                                # MODIFIED: register wiki-search command
└── commands/
    └── wikiSearch.ts                     # NEW CLI command
skills/wiki-search/
└── SKILL.md                              # NEW Claude skill descriptor

FOLLOWUPS.md                              # MODIFIED: close Phase 7a entry, list deferred items
```

### Responsibility per file

- **`SearchEngine.ts`** — pure types + interface. No logic. The seam between handler and engine.
- **`RegexpSearchEngine.ts`** — single-resource matching only. Stateless. Returns all per-term matches in one array.
- **`parseSearchTerms.ts`** — strict OSLC §7.3 grammar parser. Throws `MalformedSearchTermsError` (custom) on any deviation. No URL decoding (caller hands decoded string).
- **`parseQuery.ts`** — parses full query string. Delegates `oslc.searchTerms` field to `parseSearchTerms`. Returns `{ pattern, pageSize, startIndex }` or throws.
- **`walker.ts`** — async generator that yields `{ resourceIdentifier, body }` pairs for every readable `text/markdown` descendant of a container. Encapsulates the BFS + WAC subtree-omission rule.
- **`score.ts`** — pure density-based score function. Stateless.
- **`snippet.ts`** — halo-bounded substring extraction. Stateless.
- **`ResponseBuilder.ts`** — assembles the Turtle response from scored results + paging metadata. Stateless; takes a request URL to derive `oslc:nextPage`.
- **`WikiSearchHttpHandler.ts`** — orchestrator. canHandle checks `?ext=search-grep`; handle runs walker → engine → AND filter → score → sort → paginate → ResponseBuilder.
- **`WikiSearchLinkMetadataWriter.ts`** — pure side-channel on response metadata. Path-prefix dispatch on `/vault/wiki/*` container GETs.
- **`uri.ts`** — small URL helpers (mirrors memento/uri.ts and profile-link/uri.ts).

---

## Task 0: Scaffold extension directory

**Files:**
- Create: `css/extensions/wiki-search/package.json`
- Create: `css/extensions/wiki-search/tsconfig.json`
- Create: `css/extensions/wiki-search/vitest.config.ts`
- Create: `css/extensions/wiki-search/src/index.ts` (empty placeholder)
- Create: `css/extensions/wiki-search/tests/.gitkeep`

- [ ] **Step 0.1: Create `package.json`**

```json
{
  "name": "@cogitarelink/wiki-search",
  "version": "0.1.0",
  "description": "Wiki-search CSS extension (Phase 7a). Intercepts ?ext=search-grep container GETs, runs literal-substring AND-search recursively over text/markdown bodies, returns OSLC Query 3.0 response with WAC-filtered ranked matches. D87.",
  "license": "MIT",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "lsd:module": "https://linkedsoftwaredependencies.org/bundles/npm/@cogitarelink/wiki-search",
  "lsd:components": "dist/components/components.jsonld",
  "lsd:importPaths": {
    "https://linkedsoftwaredependencies.org/bundles/npm/@cogitarelink/wiki-search/^0.1.0/components/": "dist/components/",
    "https://linkedsoftwaredependencies.org/bundles/npm/@cogitarelink/wiki-search/^0.1.0/dist/": "dist/"
  },
  "lsd:contexts": {
    "https://linkedsoftwaredependencies.org/bundles/npm/@cogitarelink/wiki-search/^0.1.0/components/context.jsonld": "dist/components/context.jsonld"
  },
  "scripts": {
    "build": "npm run build:ts && npm run build:components",
    "build:ts": "tsc --skipLibCheck",
    "build:components": "componentsjs-generator -s src -c dist/components",
    "test": "vitest run"
  },
  "dependencies": {
    "n3": "^1.17.0"
  },
  "peerDependencies": {
    "@solid/community-server": "*"
  },
  "devDependencies": {
    "@solid/community-server": "^8.0.0-alpha.3",
    "@types/node": "^22.0.0",
    "componentsjs-generator": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 0.2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 0.3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 0.4: Create `src/index.ts` placeholder**

```typescript
export {};
```

- [ ] **Step 0.5: Install + verify empty build runs**

Run:
```bash
cd css/extensions/wiki-search && npm install --ignore-scripts && npm run build:ts
```

Expected: tsc completes with no errors (empty src tree).

- [ ] **Step 0.6: Commit**

```bash
git add css/extensions/wiki-search/package.json css/extensions/wiki-search/tsconfig.json css/extensions/wiki-search/vitest.config.ts css/extensions/wiki-search/src/index.ts css/extensions/wiki-search/tests/.gitkeep
git commit -m "$(cat <<'EOF'
[Agent: Claude] wiki-search: scaffold extension directory (Phase 7a)

Empty scaffold mirrors memento/profile-link layout: CommonJS, strict TS,
vitest, Components.js DI metadata generation via componentsjs-generator.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 1: SearchEngine interface + types

**Files:**
- Create: `css/extensions/wiki-search/src/SearchEngine.ts`

- [ ] **Step 1.1: Write the interface and types**

Create `src/SearchEngine.ts`:

```typescript
/**
 * Single-resource search engine seam.
 *
 * Phase 1: RegexpSearchEngine. Phase 7b: BM25SearchEngine swaps in via
 * Components.js Override; the WikiSearchHttpHandler is unchanged.
 *
 * Engines are stateless and semantics-free: they return all per-term
 * matches on the body. AND-vs-OR combination is the handler's concern.
 */

export interface SearchPattern {
  /** OSLC §7.3 quoted phrases, post-parse. Each is one literal substring. */
  terms: string[];
  options?: SearchOptions;
}

export interface SearchOptions {
  /** Default false. Phase 1 always case-insensitive; reserved for smart-case future. */
  caseSensitive?: boolean;
  /** Default 50. Bound work per body so a pathological resource can't blow up the response. */
  maxMatchesPerResource?: number;
}

export interface Match {
  /** Byte offset into body where match starts. */
  offset: number;
  /** Length of matched substring (in characters). */
  length: number;
  /** 1-indexed line number, computed from offset for snippet rendering. */
  line: number;
  /** Which input term matched (so AND-filter and score can count distinct terms). */
  term: string;
}

export interface SearchEngine {
  /**
   * Search a single resource body. Returns matches in body order — caller
   * sorts/filters/scores. Empty array if no terms matched.
   */
  search(body: string, pattern: SearchPattern): Match[];
}
```

- [ ] **Step 1.2: Verify the file compiles**

Run:
```bash
cd css/extensions/wiki-search && npm run build:ts
```

Expected: tsc completes with no errors.

- [ ] **Step 1.3: Commit**

```bash
git add css/extensions/wiki-search/src/SearchEngine.ts
git commit -m "[Agent: Claude] wiki-search: SearchEngine interface + types

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: RegexpSearchEngine + tests

**Files:**
- Create: `css/extensions/wiki-search/src/RegexpSearchEngine.ts`
- Test: `css/extensions/wiki-search/tests/RegexpSearchEngine.test.ts`

- [ ] **Step 2.1: Write the failing tests first**

Create `tests/RegexpSearchEngine.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { RegexpSearchEngine } from "../src/RegexpSearchEngine";
import type { SearchPattern } from "../src/SearchEngine";

describe("RegexpSearchEngine", () => {
  const engine = new RegexpSearchEngine();

  it("returns empty array when no terms match", () => {
    const body = "the quick brown fox";
    const pattern: SearchPattern = { terms: ["nonsense"] };
    expect(engine.search(body, pattern)).toEqual([]);
  });

  it("matches a single literal term case-insensitively by default", () => {
    const body = "Quick Brown Fox";
    const matches = engine.search(body, { terms: ["quick"] });
    expect(matches).toHaveLength(1);
    expect(matches[0].term).toBe("quick");
    expect(matches[0].offset).toBe(0);
    expect(matches[0].length).toBe(5);
    expect(matches[0].line).toBe(1);
  });

  it("matches the literal phrase including spaces", () => {
    const body = "explore progressive disclosure as a way";
    const matches = engine.search(body, { terms: ["progressive disclosure"] });
    expect(matches).toHaveLength(1);
    expect(matches[0].offset).toBe(8);
    expect(matches[0].length).toBe(22);
  });

  it("treats terms as literal substrings, not regex (special chars escaped)", () => {
    const body = "version v1.0 with parens (x.y.z)";
    const matches = engine.search(body, { terms: ["v1.0"] });
    expect(matches).toHaveLength(1);
    expect(matches[0].length).toBe(4);
    // Confirm "." was not treated as regex metachar matching any char
    const matches2 = engine.search("vX0", { terms: ["v1.0"] });
    expect(matches2).toHaveLength(0);
  });

  it("collects matches from all terms (OR-collect; handler does AND filtering)", () => {
    const body = "foo and bar and foo again";
    const matches = engine.search(body, { terms: ["foo", "bar"] });
    expect(matches).toHaveLength(3);
    const terms = matches.map(m => m.term).sort();
    expect(terms).toEqual(["bar", "foo", "foo"]);
  });

  it("computes 1-indexed line numbers from offset", () => {
    const body = "line one\nline two\nline three\nline four with target";
    const matches = engine.search(body, { terms: ["target"] });
    expect(matches).toHaveLength(1);
    expect(matches[0].line).toBe(4);
  });

  it("respects maxMatchesPerResource cap", () => {
    const body = "x ".repeat(100);
    const matches = engine.search(body, { terms: ["x"], options: { maxMatchesPerResource: 10 } });
    expect(matches).toHaveLength(10);
  });

  it("defaults maxMatchesPerResource to 50", () => {
    const body = "x ".repeat(100);
    const matches = engine.search(body, { terms: ["x"] });
    expect(matches).toHaveLength(50);
  });

  it("caseSensitive option respected when set true", () => {
    const body = "Quick Brown Fox";
    const matches = engine.search(body, { terms: ["quick"], options: { caseSensitive: true } });
    expect(matches).toEqual([]);
  });
});
```

- [ ] **Step 2.2: Run tests to verify they fail**

Run:
```bash
cd css/extensions/wiki-search && npx vitest run tests/RegexpSearchEngine.test.ts
```

Expected: FAIL with "Cannot find module" or "RegexpSearchEngine is not defined".

- [ ] **Step 2.3: Write the implementation**

Create `src/RegexpSearchEngine.ts`:

```typescript
import type { SearchEngine, SearchPattern, Match } from "./SearchEngine";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lineNumberAt(body: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < body.length; i++) {
    if (body.charCodeAt(i) === 10) line++;
  }
  return line;
}

export class RegexpSearchEngine implements SearchEngine {
  public search(body: string, pattern: SearchPattern): Match[] {
    const matches: Match[] = [];
    const flags = pattern.options?.caseSensitive ? "g" : "gi";
    const cap = pattern.options?.maxMatchesPerResource ?? 50;
    for (const term of pattern.terms) {
      const re = new RegExp(escapeRegExp(term), flags);
      let m: RegExpExecArray | null;
      while ((m = re.exec(body)) !== null) {
        matches.push({
          offset: m.index,
          length: m[0].length,
          line: lineNumberAt(body, m.index),
          term,
        });
        if (matches.length >= cap) return matches;
        // Guard against zero-width matches looping forever (defense-in-depth;
        // escapeRegExp prevents this in practice but pattern is paranoia-safe)
        if (m[0].length === 0) re.lastIndex++;
      }
    }
    return matches;
  }
}
```

- [ ] **Step 2.4: Run tests to verify they pass**

Run:
```bash
cd css/extensions/wiki-search && npx vitest run tests/RegexpSearchEngine.test.ts
```

Expected: all 9 tests pass.

- [ ] **Step 2.5: Commit**

```bash
git add css/extensions/wiki-search/src/RegexpSearchEngine.ts css/extensions/wiki-search/tests/RegexpSearchEngine.test.ts
git commit -m "[Agent: Claude] wiki-search: RegexpSearchEngine + unit tests

Pure-Node RegExp engine for Phase 1. Stateless, semantics-free, returns
all per-term matches; handler does AND-vs-OR combination. Escapes regex
metacharacters so terms are literal substrings.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: parseSearchTerms (strict OSLC §7.3) + tests

**Files:**
- Create: `css/extensions/wiki-search/src/parseSearchTerms.ts`
- Test: `css/extensions/wiki-search/tests/parseSearchTerms.test.ts`

- [ ] **Step 3.1: Write the failing tests**

Create `tests/parseSearchTerms.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseSearchTerms, MalformedSearchTermsError } from "../src/parseSearchTerms";

describe("parseSearchTerms (strict OSLC §7.3)", () => {
  it("parses one quoted term", () => {
    expect(parseSearchTerms('"progressive disclosure"')).toEqual(["progressive disclosure"]);
  });

  it("parses two comma-separated quoted terms", () => {
    expect(parseSearchTerms('"progressive disclosure","ESPRESSO"'))
      .toEqual(["progressive disclosure", "ESPRESSO"]);
  });

  it("allows optional whitespace around commas", () => {
    expect(parseSearchTerms('"a" , "b"')).toEqual(["a", "b"]);
  });

  it("handles escaped double-quote inside a term", () => {
    expect(parseSearchTerms('"say \\"hi\\""')).toEqual(['say "hi"']);
  });

  it("handles escaped backslash inside a term", () => {
    expect(parseSearchTerms('"path\\\\file"')).toEqual(["path\\file"]);
  });

  it("rejects unquoted input", () => {
    expect(() => parseSearchTerms("progressive disclosure"))
      .toThrow(MalformedSearchTermsError);
  });

  it("rejects mixed quoted/unquoted", () => {
    expect(() => parseSearchTerms('"a",b')).toThrow(MalformedSearchTermsError);
  });

  it("rejects empty input", () => {
    expect(() => parseSearchTerms("")).toThrow(MalformedSearchTermsError);
  });

  it("rejects empty term (empty quoted string)", () => {
    expect(() => parseSearchTerms('""')).toThrow(MalformedSearchTermsError);
  });

  it("rejects trailing comma", () => {
    expect(() => parseSearchTerms('"a",')).toThrow(MalformedSearchTermsError);
  });

  it("rejects unterminated quote", () => {
    expect(() => parseSearchTerms('"unterminated')).toThrow(MalformedSearchTermsError);
  });

  it("error carries the offending input for problem+json", () => {
    try {
      parseSearchTerms("unquoted");
    } catch (e) {
      expect(e).toBeInstanceOf(MalformedSearchTermsError);
      expect((e as MalformedSearchTermsError).input).toBe("unquoted");
    }
  });
});
```

- [ ] **Step 3.2: Run tests to verify they fail**

Run:
```bash
cd css/extensions/wiki-search && npx vitest run tests/parseSearchTerms.test.ts
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3.3: Write the implementation**

Create `src/parseSearchTerms.ts`:

```typescript
/**
 * Strict OSLC Query 3.0 §7.3 oslc.searchTerms parser.
 *
 *   searchTerms  := quotedString ( "," quotedString )*
 *   quotedString := '"' ( escapedChar | safeChar )* '"'
 *   escapedChar  := '\"' | '\\'
 *   safeChar     := any char except '"' and '\'
 *
 * Empty input → MalformedSearchTermsError. Empty quoted string → error.
 * Whitespace allowed around commas but not inside quotedString tokens
 * (whitespace inside a quoted string is part of the term).
 */

export class MalformedSearchTermsError extends Error {
  public readonly input: string;
  public constructor(message: string, input: string) {
    super(message);
    this.name = "MalformedSearchTermsError";
    this.input = input;
  }
}

export function parseSearchTerms(raw: string): string[] {
  const input = raw;
  let i = 0;
  const terms: string[] = [];

  const skipWs = () => {
    while (i < input.length && (input[i] === " " || input[i] === "\t")) i++;
  };

  const parseQuoted = (): string => {
    if (input[i] !== '"') {
      throw new MalformedSearchTermsError(
        `Expected '\"' at position ${i}`,
        input,
      );
    }
    i++; // consume opening quote
    let out = "";
    while (i < input.length && input[i] !== '"') {
      if (input[i] === "\\") {
        i++;
        if (i >= input.length) {
          throw new MalformedSearchTermsError(
            "Unterminated escape sequence",
            input,
          );
        }
        if (input[i] === '"' || input[i] === "\\") {
          out += input[i];
          i++;
        } else {
          throw new MalformedSearchTermsError(
            `Invalid escape \\${input[i]} at position ${i}`,
            input,
          );
        }
      } else {
        out += input[i];
        i++;
      }
    }
    if (i >= input.length) {
      throw new MalformedSearchTermsError("Unterminated quoted string", input);
    }
    i++; // consume closing quote
    if (out.length === 0) {
      throw new MalformedSearchTermsError("Empty quoted string", input);
    }
    return out;
  };

  if (input.length === 0) {
    throw new MalformedSearchTermsError("Empty searchTerms", input);
  }

  skipWs();
  terms.push(parseQuoted());
  skipWs();
  while (i < input.length) {
    if (input[i] !== ",") {
      throw new MalformedSearchTermsError(
        `Expected ',' at position ${i}`,
        input,
      );
    }
    i++; // consume comma
    skipWs();
    terms.push(parseQuoted());
    skipWs();
  }
  return terms;
}
```

- [ ] **Step 3.4: Run tests to verify they pass**

Run:
```bash
cd css/extensions/wiki-search && npx vitest run tests/parseSearchTerms.test.ts
```

Expected: all 12 tests pass.

- [ ] **Step 3.5: Commit**

```bash
git add css/extensions/wiki-search/src/parseSearchTerms.ts css/extensions/wiki-search/tests/parseSearchTerms.test.ts
git commit -m "[Agent: Claude] wiki-search: strict OSLC §7.3 searchTerms parser

MalformedSearchTermsError carries offending input for problem+json
error response shape. No URL decoding (caller's job).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: parseQuery (full querystring → SearchPattern + paging) + tests

**Files:**
- Create: `css/extensions/wiki-search/src/parseQuery.ts`
- Test: `css/extensions/wiki-search/tests/parseQuery.test.ts`

- [ ] **Step 4.1: Write the failing tests**

Create `tests/parseQuery.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseQuery, MalformedQueryError } from "../src/parseQuery";

describe("parseQuery", () => {
  it("parses minimum required searchTerms", () => {
    const result = parseQuery('?ext=search-grep&oslc.searchTerms=%22agent%22');
    expect(result.pattern.terms).toEqual(["agent"]);
    expect(result.pageSize).toBe(25);
    expect(result.startIndex).toBe(0);
  });

  it("parses multiple terms", () => {
    const result = parseQuery(
      '?ext=search-grep&oslc.searchTerms=%22progressive%20disclosure%22,%22ESPRESSO%22'
    );
    expect(result.pattern.terms).toEqual(["progressive disclosure", "ESPRESSO"]);
  });

  it("honors oslc.pageSize within range", () => {
    const result = parseQuery('?ext=search-grep&oslc.searchTerms=%22x%22&oslc.pageSize=50');
    expect(result.pageSize).toBe(50);
  });

  it("clamps oslc.pageSize to max 100", () => {
    const result = parseQuery('?ext=search-grep&oslc.searchTerms=%22x%22&oslc.pageSize=500');
    expect(result.pageSize).toBe(100);
  });

  it("rejects oslc.pageSize=0 with 400", () => {
    expect(() => parseQuery('?ext=search-grep&oslc.searchTerms=%22x%22&oslc.pageSize=0'))
      .toThrow(MalformedQueryError);
  });

  it("rejects negative oslc.pageSize", () => {
    expect(() => parseQuery('?ext=search-grep&oslc.searchTerms=%22x%22&oslc.pageSize=-1'))
      .toThrow(MalformedQueryError);
  });

  it("honors oslc.startIndex", () => {
    const result = parseQuery('?ext=search-grep&oslc.searchTerms=%22x%22&oslc.startIndex=25');
    expect(result.startIndex).toBe(25);
  });

  it("rejects negative oslc.startIndex", () => {
    expect(() => parseQuery('?ext=search-grep&oslc.searchTerms=%22x%22&oslc.startIndex=-1'))
      .toThrow(MalformedQueryError);
  });

  it("rejects missing oslc.searchTerms", () => {
    expect(() => parseQuery('?ext=search-grep')).toThrow(MalformedQueryError);
  });

  it("rejects empty oslc.searchTerms", () => {
    expect(() => parseQuery('?ext=search-grep&oslc.searchTerms=')).toThrow(MalformedQueryError);
  });

  it("rejects unquoted oslc.searchTerms (delegates to parseSearchTerms)", () => {
    expect(() => parseQuery('?ext=search-grep&oslc.searchTerms=agent'))
      .toThrow(MalformedQueryError);
  });

  it("flags 501-style params (where, select, orderBy, prefix) for handler to 501", () => {
    const result = parseQuery(
      '?ext=search-grep&oslc.searchTerms=%22x%22&oslc.where=foo'
    );
    expect(result.unsupported).toContain("oslc.where");
  });

  it("decodes URL-encoded searchTerms before parsing", () => {
    const result = parseQuery('?ext=search-grep&oslc.searchTerms=%22hello%20world%22');
    expect(result.pattern.terms).toEqual(["hello world"]);
  });

  it("error preserves underlying parseSearchTerms error", () => {
    try {
      parseQuery('?ext=search-grep&oslc.searchTerms=unquoted');
    } catch (e) {
      expect(e).toBeInstanceOf(MalformedQueryError);
      expect((e as MalformedQueryError).example).toContain("%22");
    }
  });
});
```

- [ ] **Step 4.2: Run tests to verify they fail**

Run:
```bash
cd css/extensions/wiki-search && npx vitest run tests/parseQuery.test.ts
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 4.3: Write the implementation**

Create `src/parseQuery.ts`:

```typescript
import { parseSearchTerms, MalformedSearchTermsError } from "./parseSearchTerms";
import type { SearchPattern } from "./SearchEngine";

export class MalformedQueryError extends Error {
  public readonly detail: string;
  public readonly example: string =
    'oslc.searchTerms=%22progressive%20disclosure%22,%22ESPRESSO%22';
  public constructor(detail: string) {
    super(detail);
    this.name = "MalformedQueryError";
    this.detail = detail;
  }
}

export interface ParsedQuery {
  pattern: SearchPattern;
  pageSize: number;
  startIndex: number;
  /** Deferred OSLC params present in the request (handler returns 501). */
  unsupported: string[];
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const DEFERRED_PARAMS = ["oslc.where", "oslc.select", "oslc.orderBy", "oslc.prefix"];

export function parseQuery(queryString: string): ParsedQuery {
  const qs = queryString.startsWith("?") ? queryString.slice(1) : queryString;
  const params = new URLSearchParams(qs);

  const rawTerms = params.get("oslc.searchTerms");
  if (rawTerms === null || rawTerms.length === 0) {
    throw new MalformedQueryError(
      "Missing required parameter: oslc.searchTerms",
    );
  }
  let terms: string[];
  try {
    terms = parseSearchTerms(rawTerms);
  } catch (e) {
    if (e instanceof MalformedSearchTermsError) {
      throw new MalformedQueryError(
        `Malformed oslc.searchTerms: ${e.message}. Got: ${e.input}`,
      );
    }
    throw e;
  }

  const pageSizeRaw = params.get("oslc.pageSize");
  let pageSize = DEFAULT_PAGE_SIZE;
  if (pageSizeRaw !== null) {
    const n = Number.parseInt(pageSizeRaw, 10);
    if (!Number.isInteger(n) || n < 1) {
      throw new MalformedQueryError(
        `Invalid oslc.pageSize: ${pageSizeRaw} (must be positive integer)`,
      );
    }
    pageSize = Math.min(n, MAX_PAGE_SIZE);
  }

  const startIndexRaw = params.get("oslc.startIndex");
  let startIndex = 0;
  if (startIndexRaw !== null) {
    const n = Number.parseInt(startIndexRaw, 10);
    if (!Number.isInteger(n) || n < 0) {
      throw new MalformedQueryError(
        `Invalid oslc.startIndex: ${startIndexRaw} (must be non-negative integer)`,
      );
    }
    startIndex = n;
  }

  const unsupported = DEFERRED_PARAMS.filter((p) => params.has(p));

  return {
    pattern: { terms },
    pageSize,
    startIndex,
    unsupported,
  };
}
```

- [ ] **Step 4.4: Run tests to verify they pass**

Run:
```bash
cd css/extensions/wiki-search && npx vitest run tests/parseQuery.test.ts
```

Expected: all 14 tests pass.

- [ ] **Step 4.5: Commit**

```bash
git add css/extensions/wiki-search/src/parseQuery.ts css/extensions/wiki-search/tests/parseQuery.test.ts
git commit -m "[Agent: Claude] wiki-search: parseQuery with paging + deferred params

Defaults: pageSize=25, max 100, startIndex=0. Flags oslc.where/select/
orderBy/prefix as unsupported for the handler to return 501.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: score.ts (density-based) + snippet.ts + tests

**Files:**
- Create: `css/extensions/wiki-search/src/score.ts`
- Create: `css/extensions/wiki-search/src/snippet.ts`
- Test: `css/extensions/wiki-search/tests/score.test.ts`
- Test: `css/extensions/wiki-search/tests/snippet.test.ts`

- [ ] **Step 5.1: Write the failing score tests**

Create `tests/score.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeScore } from "../src/score";

describe("computeScore (density-based)", () => {
  it("returns 0 when no matches", () => {
    expect(computeScore(0, 1000)).toBe(0);
  });

  it("returns higher score for higher density", () => {
    const lowDensity = computeScore(1, 10000);
    const highDensity = computeScore(10, 1000);
    expect(highDensity).toBeGreaterThan(lowDensity);
  });

  it("capped at 100", () => {
    expect(computeScore(1000, 100)).toBeLessThanOrEqual(100);
  });

  it("integer output", () => {
    expect(Number.isInteger(computeScore(3, 500))).toBe(true);
  });

  it("does not divide by zero on empty body", () => {
    expect(() => computeScore(0, 0)).not.toThrow();
    expect(computeScore(0, 0)).toBe(0);
  });
});
```

- [ ] **Step 5.2: Write the failing snippet tests**

Create `tests/snippet.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { snippet } from "../src/snippet";

describe("snippet", () => {
  it("returns halo around match in middle of body", () => {
    const body = "lorem ipsum ".repeat(20) + "TARGET" + " end of body";
    const offset = body.indexOf("TARGET");
    const result = snippet(body, offset, 6, 30);
    expect(result).toContain("TARGET");
    expect(result.startsWith("…")).toBe(true);
  });

  it("no leading ellipsis when match is at body start", () => {
    const result = snippet("TARGET appears here", 0, 6, 30);
    expect(result.startsWith("TARGET")).toBe(true);
  });

  it("no trailing ellipsis when match reaches body end", () => {
    const body = "ending with TARGET";
    const result = snippet(body, body.indexOf("TARGET"), 6, 30);
    expect(result.endsWith("TARGET")).toBe(true);
  });

  it("collapses whitespace", () => {
    const body = "before\n\n\nTARGET\n\nafter";
    const result = snippet(body, body.indexOf("TARGET"), 6, 30);
    expect(result).not.toMatch(/\n/);
    expect(result).not.toMatch(/\s\s/);
  });

  it("default halo is 80 chars", () => {
    const body = "x".repeat(200) + "TARGET" + "y".repeat(200);
    const result = snippet(body, body.indexOf("TARGET"), 6);
    expect(result.length).toBeLessThan(200);
  });
});
```

- [ ] **Step 5.3: Run tests to verify they fail**

Run:
```bash
cd css/extensions/wiki-search && npx vitest run tests/score.test.ts tests/snippet.test.ts
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 5.4: Write score.ts**

Create `src/score.ts`:

```typescript
/**
 * Density-based score formula (Refinement 2 v1 baseline).
 *
 * Under AND-semantics, uniqueTermsMatched == totalTerms is invariant, so
 * the original §4 formula degenerated. Density distinguishes "page name-
 * drops a term once" from "page genuinely about a term"; log dampening
 * stops a 10-KB body with 50 matches from monopolising the rank.
 *
 * RQ-Search-1 open: tune against Rung 1.5 eval evidence.
 */
export function computeScore(matchCount: number, bodyLength: number): number {
  if (matchCount === 0) return 0;
  const safeLen = Math.max(1, bodyLength);
  const matchesPerKB = (matchCount / safeLen) * 1000;
  const densityComponent = 20 * Math.log2(1 + matchesPerKB);
  const countComponent = 10 * Math.min(matchCount, 10);
  return Math.min(100, Math.round(densityComponent + countComponent));
}
```

- [ ] **Step 5.5: Write snippet.ts**

Create `src/snippet.ts`:

```typescript
/**
 * Halo-bounded snippet around a match offset, with whitespace collapsed
 * and ellipsis marking truncation. Output is one-line, single-spaced —
 * the consumer agent reads it inline in a Turtle response.
 */
export function snippet(
  body: string,
  offset: number,
  length: number,
  halo: number = 80,
): string {
  const start = Math.max(0, offset - halo);
  const end = Math.min(body.length, offset + length + halo);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < body.length ? "…" : "";
  const slice = body.slice(start, end).replace(/\s+/g, " ").trim();
  return prefix + slice + suffix;
}
```

- [ ] **Step 5.6: Run tests to verify they pass**

Run:
```bash
cd css/extensions/wiki-search && npx vitest run tests/score.test.ts tests/snippet.test.ts
```

Expected: all 10 tests pass.

- [ ] **Step 5.7: Commit**

```bash
git add css/extensions/wiki-search/src/score.ts css/extensions/wiki-search/src/snippet.ts css/extensions/wiki-search/tests/score.test.ts css/extensions/wiki-search/tests/snippet.test.ts
git commit -m "[Agent: Claude] wiki-search: density-based score + snippet helpers

Density-based score (Refinement 2) replaces the degenerate match-count
formula under AND semantics. snippet collapses whitespace and trims to
inline form for Turtle response embedding.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: uri.ts helpers + tests

**Files:**
- Create: `css/extensions/wiki-search/src/uri.ts`
- Test: `css/extensions/wiki-search/tests/uri.test.ts`

- [ ] **Step 6.1: Write the failing tests**

Create `tests/uri.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { isUnderBaseUrl, isInWikiSubtree, buildPagingUrl } from "../src/uri";

describe("uri helpers", () => {
  const baseUrl = "https://pod.vardeman.me";

  describe("isUnderBaseUrl", () => {
    it("true for URLs under base", () => {
      expect(isUnderBaseUrl("https://pod.vardeman.me/vault/wiki/", baseUrl)).toBe(true);
    });
    it("false for off-host URLs", () => {
      expect(isUnderBaseUrl("https://other.example/x", baseUrl)).toBe(false);
    });
    it("ignores trailing slash on base", () => {
      expect(isUnderBaseUrl("https://pod.vardeman.me/x", "https://pod.vardeman.me/")).toBe(true);
    });
  });

  describe("isInWikiSubtree", () => {
    it("true for /vault/wiki/ itself", () => {
      expect(isInWikiSubtree("https://pod.vardeman.me/vault/wiki/")).toBe(true);
    });
    it("true for /vault/wiki/pages/", () => {
      expect(isInWikiSubtree("https://pod.vardeman.me/vault/wiki/pages/")).toBe(true);
    });
    it("true for /vault/wiki/pages/foo.md", () => {
      expect(isInWikiSubtree("https://pod.vardeman.me/vault/wiki/pages/foo.md")).toBe(true);
    });
    it("false for /vault/profile/", () => {
      expect(isInWikiSubtree("https://pod.vardeman.me/vault/profile/")).toBe(false);
    });
    it("false for /vault/", () => {
      expect(isInWikiSubtree("https://pod.vardeman.me/vault/")).toBe(false);
    });
  });

  describe("buildPagingUrl", () => {
    it("preserves existing params, updates startIndex", () => {
      const url = buildPagingUrl(
        "https://pod.vardeman.me/vault/wiki/?ext=search-grep&oslc.searchTerms=%22x%22&oslc.pageSize=25",
        50,
      );
      expect(url).toContain("oslc.startIndex=50");
      expect(url).toContain("oslc.pageSize=25");
      expect(url).toContain("oslc.searchTerms=%22x%22");
      expect(url).toContain("ext=search-grep");
    });
    it("overwrites existing startIndex", () => {
      const url = buildPagingUrl(
        "https://pod.vardeman.me/vault/wiki/?ext=search-grep&oslc.searchTerms=%22x%22&oslc.startIndex=0",
        25,
      );
      expect(url).toMatch(/oslc\.startIndex=25/);
      expect(url).not.toMatch(/oslc\.startIndex=0/);
    });
  });
});
```

- [ ] **Step 6.2: Run tests to verify they fail**

Run:
```bash
cd css/extensions/wiki-search && npx vitest run tests/uri.test.ts
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 6.3: Write uri.ts**

Create `src/uri.ts`:

```typescript
const WIKI_PREFIX = "/vault/wiki/";

export function isUnderBaseUrl(url: string, baseUrl: string): boolean {
  const trimmedBase = baseUrl.replace(/\/$/, "");
  return url.startsWith(trimmedBase + "/") || url === trimmedBase;
}

/**
 * Path-prefix check used by both the handler (which containers can dispatch
 * search-grep?) and the MetadataWriter (which container GETs get the Link
 * header?). Matches /vault/wiki/ exactly OR any descendant path.
 */
export function isInWikiSubtree(url: string): boolean {
  try {
    const u = new URL(url);
    return u.pathname === WIKI_PREFIX || u.pathname.startsWith(WIKI_PREFIX);
  } catch {
    return false;
  }
}

/**
 * Build an oslc:nextPage URL by copying every query param of the current
 * request and overwriting oslc.startIndex. Preserves param order.
 */
export function buildPagingUrl(currentUrl: string, nextStartIndex: number): string {
  const u = new URL(currentUrl);
  u.searchParams.set("oslc.startIndex", String(nextStartIndex));
  return u.toString();
}
```

- [ ] **Step 6.4: Run tests to verify they pass**

Run:
```bash
cd css/extensions/wiki-search && npx vitest run tests/uri.test.ts
```

Expected: all 10 tests pass.

- [ ] **Step 6.5: Commit**

```bash
git add css/extensions/wiki-search/src/uri.ts css/extensions/wiki-search/tests/uri.test.ts
git commit -m "[Agent: Claude] wiki-search: uri helpers (subtree check, paging URL)

isInWikiSubtree is used by both handler dispatch and MetadataWriter
path-prefix check. buildPagingUrl emits oslc:nextPage targets.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: ResponseBuilder + tests

**Files:**
- Create: `css/extensions/wiki-search/src/ResponseBuilder.ts`
- Test: `css/extensions/wiki-search/tests/ResponseBuilder.test.ts`

- [ ] **Step 7.1: Write the failing tests**

Create `tests/ResponseBuilder.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildTurtleResponse, type ScoredResult } from "../src/ResponseBuilder";

describe("ResponseBuilder", () => {
  const requestUrl =
    "https://pod.vardeman.me/vault/wiki/?ext=search-grep&oslc.searchTerms=%22agent%22&oslc.pageSize=25";

  it("emits oslc:totalCount and ldp:contains for each result", () => {
    const results: ScoredResult[] = [
      {
        url: "https://pod.vardeman.me/vault/wiki/pages/agent-architecture.md",
        score: 87,
        line: 12,
        snippet: "…the [[Agent Architecture]] question is whether…",
      },
    ];
    const ttl = buildTurtleResponse(requestUrl, results, 1, 0, 25, "agent");
    expect(ttl).toContain("oslc:totalCount 1");
    expect(ttl).toContain("<https://pod.vardeman.me/vault/wiki/pages/agent-architecture.md>");
    expect(ttl).toContain("oslc:score 87");
    expect(ttl).toContain('vault:matchedLine 12');
    expect(ttl).toContain('vault:matchedContext');
  });

  it("emits oslc:nextPage when more results exist", () => {
    const ttl = buildTurtleResponse(requestUrl, [], 247, 0, 25, "agent");
    expect(ttl).toContain("oslc:nextPage");
    expect(ttl).toContain("oslc.startIndex=25");
  });

  it("omits oslc:nextPage on the last page", () => {
    const ttl = buildTurtleResponse(requestUrl, [], 30, 25, 25, "agent");
    expect(ttl).not.toContain("oslc:nextPage");
  });

  it("omits oslc:nextPage when startIndex+pageSize == totalCount exactly", () => {
    const ttl = buildTurtleResponse(requestUrl, [], 25, 0, 25, "agent");
    expect(ttl).not.toContain("oslc:nextPage");
  });

  it("orders ldp:contains by score descending", () => {
    const results: ScoredResult[] = [
      { url: "https://pod.vardeman.me/vault/wiki/pages/lo.md", score: 30, line: 1, snippet: "lo" },
      { url: "https://pod.vardeman.me/vault/wiki/pages/hi.md", score: 90, line: 1, snippet: "hi" },
    ];
    const ttl = buildTurtleResponse(requestUrl, results, 2, 0, 25, "x");
    const hiIdx = ttl.indexOf("/hi.md");
    const loIdx = ttl.indexOf("/lo.md");
    expect(hiIdx).toBeLessThan(loIdx);
  });

  it("handles empty result set", () => {
    const ttl = buildTurtleResponse(requestUrl, [], 0, 0, 25, "agent");
    expect(ttl).toContain("oslc:totalCount 0");
    expect(ttl).not.toContain("oslc:nextPage");
    expect(ttl).not.toContain("ldp:contains");
  });

  it("escapes special chars in snippet for Turtle string literal", () => {
    const results: ScoredResult[] = [
      {
        url: "https://pod.vardeman.me/vault/wiki/pages/q.md",
        score: 50,
        line: 1,
        snippet: 'with "quotes" and \\backslash',
      },
    ];
    const ttl = buildTurtleResponse(requestUrl, results, 1, 0, 25, "x");
    expect(ttl).toContain('\\"quotes\\"');
    expect(ttl).toContain("\\\\backslash");
  });

  it("includes a:ldp:BasicContainer and oslc:ResponseInfo types on the request URI", () => {
    const ttl = buildTurtleResponse(requestUrl, [], 0, 0, 25, "x");
    expect(ttl).toContain("a ldp:BasicContainer, oslc:ResponseInfo");
  });
});
```

- [ ] **Step 7.2: Run tests to verify they fail**

Run:
```bash
cd css/extensions/wiki-search && npx vitest run tests/ResponseBuilder.test.ts
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 7.3: Write ResponseBuilder.ts**

Create `src/ResponseBuilder.ts`:

```typescript
import { buildPagingUrl } from "./uri";

export interface ScoredResult {
  url: string;
  score: number;
  line: number;
  snippet: string;
}

/** Escape a string for a Turtle "..."-delimited literal (RFC 6906 / SPARQL 1.1 §19.7). */
function escapeTurtleLiteral(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

/**
 * Build the Turtle response body. Per OSLC Query 3.0 §6, the response is
 * an LDP BasicContainer carrying a typed oslc:ResponseInfo with paging
 * metadata. Members are ordered by score descending in the serialization
 * (RDF unordered, but the linear text order carries rank for clients
 * that don't parse).
 */
export function buildTurtleResponse(
  requestUrl: string,
  results: ScoredResult[],
  totalCount: number,
  startIndex: number,
  pageSize: number,
  termsDescription: string,
): string {
  const prefixes = [
    "@prefix oslc:  <http://open-services.net/ns/core#> .",
    "@prefix ldp:   <http://www.w3.org/ns/ldp#> .",
    "@prefix dct:   <http://purl.org/dc/terms/> .",
    "@prefix vault: <https://pod.vardeman.me/vault/ontology/wiki#> .",
    "",
  ].join("\n");

  const sortedResults = [...results].sort((a, b) => b.score - a.score);
  const memberList = sortedResults.length > 0
    ? sortedResults.map((r) => `        <${r.url}>`).join(" ,\n")
    : null;

  const hasNextPage = startIndex + pageSize < totalCount;
  const nextPageTriple = hasNextPage
    ? `    oslc:nextPage <${buildPagingUrl(requestUrl, startIndex + pageSize)}> ;\n`
    : "";

  const containsTriple = memberList
    ? `    ldp:contains\n${memberList} ;\n`
    : "";

  const head = [
    `<${requestUrl}>`,
    "    a ldp:BasicContainer, oslc:ResponseInfo ;",
    `    dct:title "Search results for: ${escapeTurtleLiteral(termsDescription)}" ;`,
    `    oslc:totalCount ${totalCount} ;`,
    nextPageTriple.trimEnd(),
    containsTriple ? containsTriple.trimEnd() : "    .",
  ]
    .filter((line) => line.length > 0)
    .join("\n");

  // If we have contains/nextPage, the head doesn't end with " ." — add it now.
  // The simplest sentinel is whether the last printed line ends with " ;".
  const headFinal = head.endsWith(";")
    ? head.slice(0, -1) + "."
    : head;

  const perResultBlocks = sortedResults.map((r) => {
    return [
      `<${r.url}>`,
      `    oslc:score ${r.score} ;`,
      `    vault:matchedLine ${r.line} ;`,
      `    vault:matchedContext "${escapeTurtleLiteral(r.snippet)}" .`,
    ].join("\n");
  });

  return [prefixes, headFinal, "", ...perResultBlocks].join("\n") + "\n";
}
```

- [ ] **Step 7.4: Run tests to verify they pass**

Run:
```bash
cd css/extensions/wiki-search && npx vitest run tests/ResponseBuilder.test.ts
```

Expected: all 8 tests pass.

- [ ] **Step 7.5: Commit**

```bash
git add css/extensions/wiki-search/src/ResponseBuilder.ts css/extensions/wiki-search/tests/ResponseBuilder.test.ts
git commit -m "[Agent: Claude] wiki-search: Turtle ResponseBuilder with OSLC paging

oslc:nextPage emitted iff startIndex+pageSize<totalCount. Members
ordered descending by score in the serialization. Turtle string
literals escaped per SPARQL 1.1 §19.7.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: walker (recursive BFS + WAC subtree-omission) + tests

**Files:**
- Create: `css/extensions/wiki-search/src/walker.ts`
- Test: `css/extensions/wiki-search/tests/walker.test.ts`

The walker is dependency-injection-friendly: it accepts a `ResourceStore` and `PermissionReader` injected by Components.js. For unit tests we mock both.

- [ ] **Step 8.1: Write the failing tests**

Create `tests/walker.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { walkContainer } from "../src/walker";

// Minimal fake ResourceStore + PermissionReader matching the shape walkContainer needs.
// Real implementations from CSS plug in at runtime via Components.js.

function makeFakeStore(layout: Record<string, { contentType: string; body?: string; contains?: string[] }>) {
  return {
    async getRepresentation(identifier: { path: string }): Promise<{
      metadata: { contentType: string };
      data: AsyncIterable<Buffer>;
    }> {
      const node = layout[identifier.path];
      if (!node) throw new Error(`not found: ${identifier.path}`);
      const body = node.contains
        ? node.contains.map((c) => `<${c}>`).join(" ldp:contains ") // crude
        : (node.body ?? "");
      const buf = Buffer.from(body);
      return {
        metadata: { contentType: node.contentType },
        data: (async function* () { yield buf; })(),
      };
    },
    // walker uses getChildren which we'll define on the store contract
    async getChildren(identifier: { path: string }): Promise<{ path: string }[]> {
      const node = layout[identifier.path];
      return (node?.contains ?? []).map((p) => ({ path: p }));
    },
  };
}

function makePermissionReader(allowed: Set<string>) {
  return {
    async handle({ resource }: { resource: { path: string } }): Promise<{ read: boolean }> {
      return { read: allowed.has(resource.path) };
    },
  };
}

describe("walkContainer", () => {
  it("yields all readable markdown descendants in a single-level container", async () => {
    const store = makeFakeStore({
      "https://pod.vardeman.me/vault/wiki/": {
        contentType: "text/turtle",
        contains: [
          "https://pod.vardeman.me/vault/wiki/a.md",
          "https://pod.vardeman.me/vault/wiki/b.md",
        ],
      },
      "https://pod.vardeman.me/vault/wiki/a.md": { contentType: "text/markdown", body: "alpha" },
      "https://pod.vardeman.me/vault/wiki/b.md": { contentType: "text/markdown", body: "beta" },
    });
    const perms = makePermissionReader(new Set([
      "https://pod.vardeman.me/vault/wiki/",
      "https://pod.vardeman.me/vault/wiki/a.md",
      "https://pod.vardeman.me/vault/wiki/b.md",
    ]));
    const found: string[] = [];
    for await (const { url, body } of walkContainer(
      "https://pod.vardeman.me/vault/wiki/",
      store as any,
      perms as any,
      { read: true } as any,
    )) {
      found.push(url);
      expect(typeof body).toBe("string");
    }
    expect(found.sort()).toEqual([
      "https://pod.vardeman.me/vault/wiki/a.md",
      "https://pod.vardeman.me/vault/wiki/b.md",
    ]);
  });

  it("recurses into subcontainers", async () => {
    const store = makeFakeStore({
      "https://pod.vardeman.me/vault/wiki/": {
        contentType: "text/turtle",
        contains: ["https://pod.vardeman.me/vault/wiki/pages/"],
      },
      "https://pod.vardeman.me/vault/wiki/pages/": {
        contentType: "text/turtle",
        contains: ["https://pod.vardeman.me/vault/wiki/pages/foo.md"],
      },
      "https://pod.vardeman.me/vault/wiki/pages/foo.md": { contentType: "text/markdown", body: "x" },
    });
    const perms = makePermissionReader(new Set([
      "https://pod.vardeman.me/vault/wiki/",
      "https://pod.vardeman.me/vault/wiki/pages/",
      "https://pod.vardeman.me/vault/wiki/pages/foo.md",
    ]));
    const found: string[] = [];
    for await (const r of walkContainer(
      "https://pod.vardeman.me/vault/wiki/",
      store as any,
      perms as any,
      { read: true } as any,
    )) {
      found.push(r.url);
    }
    expect(found).toEqual(["https://pod.vardeman.me/vault/wiki/pages/foo.md"]);
  });

  it("omits entire subtree when WAC denies subcontainer", async () => {
    const store = makeFakeStore({
      "https://pod.vardeman.me/vault/wiki/": {
        contentType: "text/turtle",
        contains: [
          "https://pod.vardeman.me/vault/wiki/public/",
          "https://pod.vardeman.me/vault/wiki/private/",
        ],
      },
      "https://pod.vardeman.me/vault/wiki/public/": {
        contentType: "text/turtle",
        contains: ["https://pod.vardeman.me/vault/wiki/public/a.md"],
      },
      "https://pod.vardeman.me/vault/wiki/private/": {
        contentType: "text/turtle",
        contains: ["https://pod.vardeman.me/vault/wiki/private/secret.md"],
      },
      "https://pod.vardeman.me/vault/wiki/public/a.md": { contentType: "text/markdown", body: "ok" },
      "https://pod.vardeman.me/vault/wiki/private/secret.md": { contentType: "text/markdown", body: "no" },
    });
    const perms = makePermissionReader(new Set([
      "https://pod.vardeman.me/vault/wiki/",
      "https://pod.vardeman.me/vault/wiki/public/",
      "https://pod.vardeman.me/vault/wiki/public/a.md",
      // private/ denied — descent never happens
    ]));
    const found: string[] = [];
    for await (const r of walkContainer(
      "https://pod.vardeman.me/vault/wiki/",
      store as any,
      perms as any,
      { read: true } as any,
    )) {
      found.push(r.url);
    }
    expect(found).toEqual(["https://pod.vardeman.me/vault/wiki/public/a.md"]);
  });

  it("skips non-markdown resources", async () => {
    const store = makeFakeStore({
      "https://pod.vardeman.me/vault/wiki/": {
        contentType: "text/turtle",
        contains: [
          "https://pod.vardeman.me/vault/wiki/style.css",
          "https://pod.vardeman.me/vault/wiki/note.md",
        ],
      },
      "https://pod.vardeman.me/vault/wiki/style.css": { contentType: "text/css", body: "css" },
      "https://pod.vardeman.me/vault/wiki/note.md": { contentType: "text/markdown", body: "md" },
    });
    const perms = makePermissionReader(new Set([
      "https://pod.vardeman.me/vault/wiki/",
      "https://pod.vardeman.me/vault/wiki/style.css",
      "https://pod.vardeman.me/vault/wiki/note.md",
    ]));
    const found: string[] = [];
    for await (const r of walkContainer(
      "https://pod.vardeman.me/vault/wiki/",
      store as any,
      perms as any,
      { read: true } as any,
    )) {
      found.push(r.url);
    }
    expect(found).toEqual(["https://pod.vardeman.me/vault/wiki/note.md"]);
  });
});
```

- [ ] **Step 8.2: Run tests to verify they fail**

Run:
```bash
cd css/extensions/wiki-search && npx vitest run tests/walker.test.ts
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 8.3: Write walker.ts**

Create `src/walker.ts`:

```typescript
import type {
  ResourceStore,
  PermissionReader,
  Credentials,
  ResourceIdentifier,
} from "@solid/community-server";

export interface WalkResult {
  url: string;
  body: string;
}

const MARKDOWN_TYPES = new Set(["text/markdown", "text/x-markdown"]);

async function readBody(data: AsyncIterable<Buffer>): Promise<string> {
  let out = "";
  for await (const chunk of data) {
    out += chunk.toString("utf-8");
  }
  return out;
}

/**
 * Recursive BFS over an LDP container. Yields { url, body } for every
 * descendant whose representation is text/markdown AND is read-allowed
 * for the supplied credentials. If WAC denies read on a subcontainer,
 * the entire subtree is omitted (no descent) — substrate-level omit-
 * don't-deny extending to structure.
 *
 * NOTE: CSS exposes container children via `ResourceStore.getRepresentation`
 * returning an LDP container with ldp:contains triples in its metadata.
 * The handler enumerates by re-parsing those triples; in this walker we
 * model the same shape as an async iterator for test isolation.
 *
 * Real implementations of CSS's ResourceStore return container listings
 * via the representation's metadata. The handler's wiring layer (Task 9)
 * extracts ldp:contains members from the metadata of a fetched container.
 */
export async function* walkContainer(
  startUrl: string,
  store: ResourceStore,
  permissionReader: PermissionReader,
  credentials: Credentials,
): AsyncGenerator<WalkResult> {
  const queue: string[] = [startUrl];

  while (queue.length > 0) {
    const currentUrl = queue.shift()!;
    const identifier: ResourceIdentifier = { path: currentUrl };

    // Check read permission on the current node (container or resource).
    // If denied, skip — and for containers, the omission prunes the subtree.
    const permission = await permissionReader.handle({
      credentials,
      requestedModes: new Map([[identifier, new Set(["read" as any])]]) as any,
    } as any);
    const allowed = isReadAllowed(permission, currentUrl);
    if (!allowed) continue;

    const isContainer = currentUrl.endsWith("/");

    let rep: any;
    try {
      rep = await store.getRepresentation(identifier, {});
    } catch {
      continue;
    }

    if (isContainer) {
      // Enumerate ldp:contains members from rep.metadata.
      const children = extractContainerChildren(rep);
      for (const child of children) queue.push(child);
      // Drain the data stream to release the resource.
      for await (const _ of rep.data) { /* discard */ }
    } else {
      const ct = rep.metadata?.contentType ?? "";
      if (!MARKDOWN_TYPES.has(ct.split(";")[0].trim())) {
        for await (const _ of rep.data) { /* discard */ }
        continue;
      }
      const body = await readBody(rep.data);
      yield { url: currentUrl, body };
    }
  }
}

const LDP_CONTAINS = "http://www.w3.org/ns/ldp#contains";

function extractContainerChildren(rep: any): string[] {
  // CSS's container representations carry ldp:contains in their metadata.
  // metadata.getAll(namedNode(LDP_CONTAINS)) returns Term[]; .value is the IRI.
  try {
    if (typeof rep.metadata?.getAll === "function") {
      const terms = rep.metadata.getAll(LDP_CONTAINS);
      return terms.map((t: any) => t.value);
    }
  } catch { /* fall through */ }
  return [];
}

function isReadAllowed(permission: any, url: string): boolean {
  // CSS's PermissionReader returns a PermissionMap keyed by identifier.
  // Handle both the structured map and a simpler { read: true } shape used by mocks.
  if (permission?.read === true) return true;
  if (permission?.read === false) return false;
  try {
    if (typeof permission?.get === "function") {
      const p = permission.get({ path: url });
      return p?.read === true;
    }
  } catch { /* fall through */ }
  return false;
}
```

Note: the CSS PermissionReader API is more elaborate than this walker pretends; the handler in Task 9 wires it through correctly. The walker accepts the abstraction `permissionReader.handle({...})` and `permission.get(...)`/`permission.read` so unit tests can mock cleanly while the real wiring works.

- [ ] **Step 8.4: Run tests to verify they pass**

Run:
```bash
cd css/extensions/wiki-search && npx vitest run tests/walker.test.ts
```

Expected: all 4 tests pass. (Mocks intentionally bypass the strictly-typed CSS API; real wiring is verified in integration tests at Task 13.)

- [ ] **Step 8.5: Build full TS to ensure no other tests broke**

```bash
cd css/extensions/wiki-search && npm run build:ts && npx vitest run
```

Expected: tsc clean; all unit tests pass.

- [ ] **Step 8.6: Commit**

```bash
git add css/extensions/wiki-search/src/walker.ts css/extensions/wiki-search/tests/walker.test.ts
git commit -m "[Agent: Claude] wiki-search: recursive walker with WAC subtree-omission

BFS over ldp:contains; yields { url, body } for every text/markdown
descendant readable by the supplied credentials. WAC denial on a
subcontainer prunes the entire subtree from enumeration — omit-
don't-deny extended to structure.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: WikiSearchHttpHandler (orchestrator) + Components.js wiring

**Files:**
- Create: `css/extensions/wiki-search/src/WikiSearchHttpHandler.ts`
- Modify: `css/extensions/wiki-search/src/index.ts`
- Create: `css/config/wiki-search.json`
- Modify: `css/config/solid-config.json` (add lsd context + import)
- Modify: `css/Dockerfile` (add wiki-search build block)

Unit-test the handler at the level above the engine seam: query parsing, AND filtering, score/sort/paginate, ResponseBuilder invocation. Full WAC + recursion is exercised by the integration tests in Task 13.

- [ ] **Step 9.1: Write a handler unit test (query parsing + orchestration)**

Create `tests/WikiSearchHttpHandler.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { WikiSearchHttpHandler } from "../src/WikiSearchHttpHandler";

// The handler's canHandle is path-only — easy to test without injecting CSS.
// canHandle never touches the engine/store/permissionReader/credentialsExtractor;
// the empty placeholders are safe for these path-only unit tests. Full
// orchestration is exercised by the integration tests in Task 12.
describe("WikiSearchHttpHandler.canHandle", () => {
  const handler = new WikiSearchHttpHandler(
    {} as any,  // engine
    {} as any,  // store
    {} as any,  // permissionReader
    {} as any,  // credentialsExtractor
    "https://pod.vardeman.me",
  );

  it("claims GET with ?ext=search-grep on a container URL", async () => {
    const input = {
      request: {
        method: "GET",
        url: "/vault/wiki/?ext=search-grep&oslc.searchTerms=%22x%22",
      } as any,
      response: {} as any,
    };
    await expect(handler.canHandle(input as any)).resolves.toBeUndefined();
  });

  it("rejects GET on resource URL (no trailing slash)", async () => {
    const input = {
      request: {
        method: "GET",
        url: "/vault/wiki/foo.md?ext=search-grep",
      } as any,
      response: {} as any,
    };
    await expect(handler.canHandle(input as any)).rejects.toThrow();
  });

  it("rejects POST", async () => {
    const input = {
      request: {
        method: "POST",
        url: "/vault/wiki/?ext=search-grep",
      } as any,
      response: {} as any,
    };
    await expect(handler.canHandle(input as any)).rejects.toThrow();
  });

  it("rejects when ?ext=search-grep is absent", async () => {
    const input = {
      request: { method: "GET", url: "/vault/wiki/" } as any,
      response: {} as any,
    };
    await expect(handler.canHandle(input as any)).rejects.toThrow();
  });

  it("rejects container outside /vault/wiki/ subtree", async () => {
    const input = {
      request: { method: "GET", url: "/vault/profile/?ext=search-grep" } as any,
      response: {} as any,
    };
    await expect(handler.canHandle(input as any)).rejects.toThrow();
  });
});
```

- [ ] **Step 9.2: Run tests to verify they fail**

Run:
```bash
cd css/extensions/wiki-search && npx vitest run tests/WikiSearchHttpHandler.test.ts
```

Expected: FAIL — handler not implemented.

- [ ] **Step 9.3: Write the handler**

Create `src/WikiSearchHttpHandler.ts`:

```typescript
import {
  HttpHandler,
  type HttpHandlerInput,
  NotImplementedHttpError,
  type ResourceStore,
  type PermissionReader,
  type CredentialsExtractor,
} from "@solid/community-server";
import { getLoggerFor } from "global-logger-factory";

import type { SearchEngine, Match } from "./SearchEngine";
import { parseQuery, MalformedQueryError } from "./parseQuery";
import { walkContainer } from "./walker";
import { computeScore } from "./score";
import { snippet } from "./snippet";
import { buildTurtleResponse, type ScoredResult } from "./ResponseBuilder";
import { isInWikiSubtree } from "./uri";

interface PerResource {
  url: string;
  body: string;
  matches: Match[];
}

export class WikiSearchHttpHandler extends HttpHandler {
  private readonly logger = getLoggerFor(this);
  private readonly engine: SearchEngine;
  private readonly store: ResourceStore;
  private readonly permissionReader: PermissionReader;
  private readonly credentialsExtractor: CredentialsExtractor;
  private readonly baseUrl: string;

  public constructor(
    engine: SearchEngine,
    store: ResourceStore,
    permissionReader: PermissionReader,
    credentialsExtractor: CredentialsExtractor,
    baseUrl: string,
  ) {
    super();
    this.engine = engine;
    this.store = store;
    this.permissionReader = permissionReader;
    this.credentialsExtractor = credentialsExtractor;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  public async canHandle(input: HttpHandlerInput): Promise<void> {
    const url = input.request.url ?? "";
    const method = input.request.method ?? "GET";
    if (method !== "GET") {
      throw new NotImplementedHttpError("not a search-grep GET");
    }
    if (!url.includes("?ext=search-grep") && !url.includes("&ext=search-grep")) {
      throw new NotImplementedHttpError("not search-grep");
    }
    const fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
    const pathOnly = fullUrl.split("?")[0];
    if (!pathOnly.endsWith("/")) {
      throw new NotImplementedHttpError("search-grep targets containers");
    }
    if (!isInWikiSubtree(fullUrl)) {
      throw new NotImplementedHttpError("search-grep is /vault/wiki/-scoped");
    }
  }

  public async handle(input: HttpHandlerInput): Promise<void> {
    const { request, response } = input;
    const requestUrl = (request.url ?? "").startsWith("http")
      ? (request.url ?? "")
      : this.baseUrl + (request.url ?? "");
    const queryString = "?" + (requestUrl.split("?")[1] ?? "");

    // Parse query (strict OSLC).
    let parsed;
    try {
      parsed = parseQuery(queryString);
    } catch (e) {
      if (e instanceof MalformedQueryError) {
        this.writeProblemJson(response, 400, e.detail, e.example);
        return;
      }
      throw e;
    }
    if (parsed.unsupported.length > 0) {
      this.writeProblemJson(
        response,
        501,
        `Unsupported parameters: ${parsed.unsupported.join(", ")}`,
        "Use only oslc.searchTerms, oslc.pageSize, oslc.startIndex in Phase 7a.",
      );
      return;
    }

    // Resolve requester credentials. Anonymous if none.
    const credentials = await this.credentialsExtractor.handleSafe(request as any);

    // Walk + match + AND filter (single pass, retains body for snippet rendering).
    const perResource: PerResource[] = [];
    for await (const { url, body } of walkContainer(
      requestUrl.split("?")[0],
      this.store,
      this.permissionReader,
      credentials,
    )) {
      const matches = this.engine.search(body, parsed.pattern);
      const distinct = new Set(matches.map((m) => m.term));
      if (distinct.size < parsed.pattern.terms.length) continue;
      perResource.push({ url, body, matches });
    }

    // Score using body length retained from the walk.
    const scored: ScoredResult[] = perResource.map((r) => {
      const first = r.matches[0];
      return {
        url: r.url,
        score: computeScore(r.matches.length, r.body.length),
        line: first?.line ?? 1,
        snippet: snippet(r.body, first?.offset ?? 0, first?.length ?? 0),
      };
    });

    // Sort globally then paginate (so score ordering is stable across pages).
    const totalCount = scored.length;
    const sorted = [...scored].sort((a, b) => b.score - a.score);
    const page = sorted.slice(parsed.startIndex, parsed.startIndex + parsed.pageSize);

    const ttl = buildTurtleResponse(
      requestUrl,
      page,
      totalCount,
      parsed.startIndex,
      parsed.pageSize,
      parsed.pattern.terms.join(", "),
    );

    response.statusCode = 200;
    response.setHeader("Content-Type", "text/turtle");
    response.setHeader(
      "Link",
      '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type", ' +
        '<http://open-services.net/ns/core#ResponseInfo>; rel="type"',
    );
    response.end(ttl);
  }

  private writeProblemJson(
    response: any,
    status: number,
    detail: string,
    example?: string,
  ): void {
    response.statusCode = status;
    response.setHeader("Content-Type", "application/problem+json");
    response.end(
      JSON.stringify({
        type: "https://pod.vardeman.me/vault/ontology/errors#malformed-search-terms",
        title: status === 400 ? "Malformed search request" : "Unsupported parameter",
        status,
        detail,
        ...(example ? { example } : {}),
      }),
    );
  }
}
```

- [ ] **Step 9.4: Update src/index.ts to re-export public classes**

```typescript
export { WikiSearchHttpHandler } from "./WikiSearchHttpHandler";
export { WikiSearchLinkMetadataWriter } from "./WikiSearchLinkMetadataWriter";
export { RegexpSearchEngine } from "./RegexpSearchEngine";
export type { SearchEngine, SearchPattern, Match, SearchOptions } from "./SearchEngine";
```

Note: `WikiSearchLinkMetadataWriter` doesn't exist yet (Task 10). For now, drop that line; add it back at Task 10.

```typescript
export { WikiSearchHttpHandler } from "./WikiSearchHttpHandler";
export { RegexpSearchEngine } from "./RegexpSearchEngine";
export type { SearchEngine, SearchPattern, Match, SearchOptions } from "./SearchEngine";
```

- [ ] **Step 9.5: Run unit tests + build**

```bash
cd css/extensions/wiki-search && npm run build:ts && npx vitest run
```

Expected: tsc clean; all 7 unit-test files pass.

- [ ] **Step 9.6: Generate Components.js metadata**

```bash
cd css/extensions/wiki-search && npm run build:components
```

Expected: writes `dist/components/components.jsonld`, `dist/components/context.jsonld`, per-class `.jsonld` files.

- [ ] **Step 9.7: Create `css/config/wiki-search.json`**

```json
{
  "@context": [
    "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^8.0.0/components/context.jsonld",
    "https://linkedsoftwaredependencies.org/bundles/npm/@cogitarelink/wiki-search/^0.1.0/components/context.jsonld"
  ],
  "@graph": [
    {
      "comment": "Phase 1 RegExp engine; Phase 7b will Override @type to a BM25/ripgrep engine without touching the handler.",
      "@id": "urn:cogitarelink:WikiSearchEngine",
      "@type": "RegexpSearchEngine"
    },
    {
      "comment": "Wiki-search HTTP handler. Intercepts container GETs with ?ext=search-grep. Recursive over /vault/wiki/. WAC-enforced. Paginated per OSLC Query 3.0.",
      "@id": "urn:cogitarelink:WikiSearchHttpHandler",
      "@type": "WikiSearchHttpHandler",
      "engine": { "@id": "urn:cogitarelink:WikiSearchEngine" },
      "store": { "@id": "urn:solid-server:default:ResourceStore" },
      "permissionReader": { "@id": "urn:solid-server:default:PermissionReader" },
      "credentialsExtractor": { "@id": "urn:solid-server:default:CredentialsExtractor" },
      "baseUrl": { "@id": "urn:solid-server:default:variable:baseUrl" }
    },
    {
      "comment": "Insert WikiSearchHttpHandler before LdpHandler. Pattern matches MementoHttpHandler insertion in memento.json.",
      "@type": "Override",
      "overrideInstance": { "@id": "urn:solid-server:default:BaseHttpHandler" },
      "overrideSteps": [{
        "@type": "OverrideListInsertBefore",
        "overrideParameter": { "@id": "css:dist/util/handlers/StatusWaterfallHandler.jsonld#StatusWaterfallHandler_handlers" },
        "overrideTarget": { "@id": "urn:solid-server:default:LdpHandler" },
        "overrideValue": { "@id": "urn:cogitarelink:WikiSearchHttpHandler" }
      }]
    }
  ]
}
```

- [ ] **Step 9.8: Modify `css/config/solid-config.json`**

Add to the `@context` array:
```json
"https://linkedsoftwaredependencies.org/bundles/npm/@cogitarelink/wiki-search/^0.1.0/components/context.jsonld"
```

Add to the `import` array:
```json
"./wiki-search.json"
```

- [ ] **Step 9.9: Modify `css/Dockerfile` — add wiki-search build block**

Append (after the profile-link block):

```dockerfile
# ============================================================================
# wiki-search — full-text grep affordance over /vault/wiki/ markdown bodies
# (Phase 7a, D87). HttpHandler intercepts ?ext=search-grep; MetadataWriter
# adds Link: rel="queryBase" headers. Pure-Node RegExp engine for Phase 1;
# pluggable behind SearchEngine interface (Phase 7b BM25/ripgrep swap).
# ============================================================================

COPY extensions/wiki-search /community-server/extensions/wiki-search

RUN cd extensions/wiki-search && npm install --ignore-scripts

RUN cd extensions/wiki-search && npm run build

RUN rm -rf /community-server/extensions/wiki-search/node_modules/@solid/community-server && \
    ln -sf /community-server /community-server/extensions/wiki-search/node_modules/@solid/community-server

RUN mkdir -p /community-server/node_modules/@cogitarelink && \
    ln -sf /community-server/extensions/wiki-search \
       /community-server/node_modules/@cogitarelink/wiki-search
```

- [ ] **Step 9.10: Smoke test: docker build**

```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
docker compose build css
```

Expected: build completes; wiki-search COPY + npm install + npm run build + symlinks all succeed.

- [ ] **Step 9.11: Smoke test: stack starts and handler resolves**

```bash
docker compose up -d
sleep 5
docker compose logs css 2>&1 | grep -i 'wiki-search\|error\|failed' | head -20
```

Expected: no "Could not load class" errors; CSS reports startup complete.

- [ ] **Step 9.12: Smoke test: 400 on malformed request**

```bash
curl -sk -o /tmp/resp.json -w "%{http_code}\n" \
  "https://pod.vardeman.me/vault/wiki/?ext=search-grep" \
  --resolve pod.vardeman.me:443:127.0.0.1
cat /tmp/resp.json
```

Expected: HTTP 400; `application/problem+json` body with the example URL form.

- [ ] **Step 9.13: Commit**

```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
git add css/extensions/wiki-search/src/WikiSearchHttpHandler.ts \
        css/extensions/wiki-search/tests/WikiSearchHttpHandler.test.ts \
        css/extensions/wiki-search/src/index.ts \
        css/config/wiki-search.json \
        css/config/solid-config.json \
        css/Dockerfile
git commit -m "[Agent: Claude] wiki-search: HttpHandler + Components.js wiring

Orchestrator wires parseQuery + walker + engine + AND post-filter +
score/sort/paginate + ResponseBuilder. Inserted before LdpHandler via
StatusWaterfallHandler Override. Dockerfile builds + symlinks the
extension. Smoke test: 400 on malformed request returns problem+json.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: WikiSearchLinkMetadataWriter + Components.js wiring

**Files:**
- Create: `css/extensions/wiki-search/src/WikiSearchLinkMetadataWriter.ts`
- Test: `css/extensions/wiki-search/tests/WikiSearchLinkMetadataWriter.test.ts`
- Modify: `css/extensions/wiki-search/src/index.ts` (re-export)
- Modify: `css/config/wiki-search.json` (add writer + Override step)

- [ ] **Step 10.1: Write the failing test**

Create `tests/WikiSearchLinkMetadataWriter.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { WikiSearchLinkMetadataWriter } from "../src/WikiSearchLinkMetadataWriter";

function makeFakeInput(id: string, recordedHeaders: Record<string, string[]>) {
  return {
    metadata: { identifier: { value: id } },
    response: {
      _headers: recordedHeaders,
      getHeader(name: string) {
        return recordedHeaders[name.toLowerCase()];
      },
      setHeader(name: string, value: string | string[]) {
        recordedHeaders[name.toLowerCase()] = Array.isArray(value) ? value : [value];
      },
    },
  };
}

describe("WikiSearchLinkMetadataWriter", () => {
  const baseUrl = "https://pod.vardeman.me";
  const writer = new WikiSearchLinkMetadataWriter(baseUrl);

  it("emits Link rel=queryBase for /vault/wiki/", async () => {
    const headers: Record<string, string[]> = {};
    const input = makeFakeInput("https://pod.vardeman.me/vault/wiki/", headers);
    await writer.handle(input as any);
    expect(headers.link?.[0]).toContain('?ext=search-grep');
    expect(headers.link?.[0]).toContain('rel="http://open-services.net/ns/core#queryBase"');
  });

  it("emits header for /vault/wiki/pages/", async () => {
    const headers: Record<string, string[]> = {};
    const input = makeFakeInput("https://pod.vardeman.me/vault/wiki/pages/", headers);
    await writer.handle(input as any);
    expect(headers.link?.[0]).toContain('?ext=search-grep');
  });

  it("skips /vault/profile/", async () => {
    const headers: Record<string, string[]> = {};
    const input = makeFakeInput("https://pod.vardeman.me/vault/profile/", headers);
    await writer.handle(input as any);
    expect(headers.link).toBeUndefined();
  });

  it("skips off-base URLs", async () => {
    const headers: Record<string, string[]> = {};
    const input = makeFakeInput("https://other.example/vault/wiki/", headers);
    await writer.handle(input as any);
    expect(headers.link).toBeUndefined();
  });

  it("appends to existing Link header (additive composition)", async () => {
    const headers: Record<string, string[]> = { link: ['<https://existing>; rel="x"'] };
    const input = makeFakeInput("https://pod.vardeman.me/vault/wiki/", headers);
    await writer.handle(input as any);
    expect(headers.link).toHaveLength(2);
    expect(headers.link[0]).toContain("existing");
    expect(headers.link[1]).toContain("?ext=search-grep");
  });
});
```

- [ ] **Step 10.2: Run tests to verify they fail**

Run:
```bash
cd css/extensions/wiki-search && npx vitest run tests/WikiSearchLinkMetadataWriter.test.ts
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 10.3: Write the implementation**

Create `src/WikiSearchLinkMetadataWriter.ts`:

```typescript
import { MetadataWriter, type MetadataWriterInput, addHeader } from "@solid/community-server";
import { isUnderBaseUrl, isInWikiSubtree } from "./uri";

/**
 * Adds a Link: rel="queryBase" header to GET responses for containers
 * at or under /vault/wiki/. Closes the cold-start discovery loop: an
 * agent reading only HTTP headers (D55 Tier 1) finds the wiki-search
 * affordance without first reading the D83 capability catalog.
 *
 * Path-prefix dispatch — not rdf:type scan — because we cannot afford
 * to read every child's .meta on every container GET just for header
 * decoration. Path matching aligns with the affordance descriptor's
 * wiki:targetContainer </vault/wiki/> claim.
 */
export class WikiSearchLinkMetadataWriter extends MetadataWriter {
  private readonly baseUrl: string;
  private readonly queryBaseUrl: string;

  public constructor(baseUrl: string) {
    super();
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.queryBaseUrl = `${this.baseUrl}/vault/wiki/?ext=search-grep`;
  }

  public async handle(input: MetadataWriterInput): Promise<void> {
    const id = input.metadata?.identifier?.value;
    if (!id) return;
    if (!isUnderBaseUrl(id, this.baseUrl)) return;
    if (!isInWikiSubtree(id)) return;
    if (!id.endsWith("/")) return; // containers only

    addHeader(
      input.response,
      "Link",
      `<${this.queryBaseUrl}>; rel="http://open-services.net/ns/core#queryBase"; title="wiki-search"`,
    );
  }
}
```

- [ ] **Step 10.4: Update src/index.ts**

Add back the export:

```typescript
export { WikiSearchHttpHandler } from "./WikiSearchHttpHandler";
export { WikiSearchLinkMetadataWriter } from "./WikiSearchLinkMetadataWriter";
export { RegexpSearchEngine } from "./RegexpSearchEngine";
export type { SearchEngine, SearchPattern, Match, SearchOptions } from "./SearchEngine";
```

- [ ] **Step 10.5: Run tests + build**

```bash
cd css/extensions/wiki-search && npm run build:ts && npx vitest run
```

Expected: tsc clean; all unit tests pass.

- [ ] **Step 10.6: Regenerate Components.js metadata**

```bash
cd css/extensions/wiki-search && npm run build:components
```

- [ ] **Step 10.7: Modify `css/config/wiki-search.json` — add writer + Override step**

Add to `@graph`:

```json
{
  "comment": "Adds Link: rel=\"queryBase\" header to /vault/wiki/* container GETs so Tier-1 (header-only) agents discover the search affordance without reading the capability catalog.",
  "@id": "urn:cogitarelink:WikiSearchLinkMetadataWriter",
  "@type": "WikiSearchLinkMetadataWriter",
  "baseUrl": { "@id": "urn:solid-server:default:variable:baseUrl" }
},
{
  "comment": "Insert WikiSearchLinkMetadataWriter into the MetadataWriter ParallelHandler. Append after the last existing writer so it composes additively with describedby + MementoLink + ProfileLink.",
  "@type": "Override",
  "overrideInstance": { "@id": "urn:solid-server:default:MetadataWriter" },
  "overrideSteps": [{
    "@type": "OverrideListInsertAfter",
    "overrideParameter": { "@id": "ah:dist/ParallelHandler.jsonld#ParallelHandler_handlers" },
    "overrideTarget": { "@id": "urn:cogitarelink:ProfileLinkMetadataWriter" },
    "overrideValue": { "@id": "urn:cogitarelink:WikiSearchLinkMetadataWriter" }
  }]
}
```

**CAUTION:** Components.js forbids multiple `Override` declarations against the same component instance (K1). The MetadataWriter has an existing `Override` in `memento.json`. Two choices: (a) consolidate the new Override step into `memento.json`'s `overrideSteps` list, OR (b) confirm Components.js v8+ permits multiple Override objects when their `overrideSteps` are non-conflicting.

**Verify with a test build first.** If Components.js complains, move the wiki-search MetadataWriter Override step into `memento.json` (alongside MementoLink and ProfileLink Override steps).

- [ ] **Step 10.8: Add `ah:` context to wiki-search.json**

The `ah:dist/ParallelHandler.jsonld` shorthand requires the asynchronous-handlers context. Update the `@context` array in `wiki-search.json` to include:

```json
"https://linkedsoftwaredependencies.org/bundles/npm/asynchronous-handlers/^1.0.0/components/context.jsonld"
```

- [ ] **Step 10.9: Rebuild and verify CSS starts cleanly**

```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
docker compose build css
docker compose up -d
sleep 5
docker compose logs css 2>&1 | grep -i 'error\|failed\|wiki-search' | head -30
```

Expected: no errors. If Components.js fails on the Override with a "more than one key" or "duplicate Override" message, apply the workaround in Step 10.7: move the Override step into `memento.json` and remove the standalone Override object from `wiki-search.json`.

- [ ] **Step 10.10: Verify Link header on /vault/wiki/ GET**

```bash
curl -skI "https://pod.vardeman.me/vault/wiki/" \
  --resolve pod.vardeman.me:443:127.0.0.1 \
  | grep -i '^link' | head -5
```

Expected: a `Link:` header line containing `?ext=search-grep` and `rel="http://open-services.net/ns/core#queryBase"`.

- [ ] **Step 10.11: Verify NO Link header on /vault/profile/**

```bash
curl -skI "https://pod.vardeman.me/vault/profile/" \
  --resolve pod.vardeman.me:443:127.0.0.1 \
  | grep -i '^link'
```

Expected: no Link header with `queryBase` rel (other Link headers may exist).

- [ ] **Step 10.12: Commit**

```bash
git add css/extensions/wiki-search/src/WikiSearchLinkMetadataWriter.ts \
        css/extensions/wiki-search/tests/WikiSearchLinkMetadataWriter.test.ts \
        css/extensions/wiki-search/src/index.ts \
        css/config/wiki-search.json \
        css/config/memento.json
git commit -m "[Agent: Claude] wiki-search: Link rel=queryBase MetadataWriter

Closes the Tier-1 cold-start discovery loop (D55). Emits Link header
on /vault/wiki/* container GETs so agents reading only headers find
the affordance without reading the capability catalog. Additive
composition via addHeader (D67).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Capability + affordance descriptors + overlay manifest

**Files:**
- Create: `overlays/wiki-memory/capabilities/wiki-search-substrate.ttl`
- Create: `overlays/wiki-memory/affordances/wiki-search-grep.ttl`
- Modify: `overlays/wiki-memory/manifest.ttl`

- [ ] **Step 11.1: Create the capability descriptor**

Create `overlays/wiki-memory/capabilities/wiki-search-substrate.ttl`:

```turtle
@prefix cap:   <https://pod.vardeman.me/vault/ontology/capability#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .

<>  a cap:Capability ;
    cap:name "wiki-search-substrate" ;
    cap:version "1.0" ;
    rdfs:label "Wiki Full-Text Search Substrate" ;
    rdfs:comment "Full-text literal-substring search over wiki-memory L3 markdown bodies. GET /vault/wiki/?ext=search-grep&oslc.searchTerms=<terms> recursively walks the container subtree, AND-filters resources where every term appears, returns an LDP container of matches ranked by oslc:score per OSLC Query 3.0 (OASIS Standard, 2021), paginated via oslc:nextPage. WAC/ACP enforced server-side at result construction (omit-don't-deny extended to subtree omission). Phase 1 engine is Node RegExp behind a SearchEngine interface for future BM25/ripgrep upgrades. See docs/plans/2026-05-17-wiki-search-design.md + docs/superpowers/specs/2026-05-18-wiki-search-refinement-design.md." ;
    cap:providedBy <https://pod.vardeman.me/vault/ontology/overlay#wiki-memory> ;
    cap:hostedAt <https://pod.vardeman.me/vault/meta/affordances/wiki-search-grep.ttl> .
```

- [ ] **Step 11.2: Create the affordance descriptor**

Create `overlays/wiki-memory/affordances/wiki-search-grep.ttl`:

```turtle
@prefix wiki:     <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix oslc:     <http://open-services.net/ns/core#> .
@prefix rdfs:     <http://www.w3.org/2000/01/rdf-schema#> .
@prefix dct:      <http://purl.org/dc/terms/> .
@prefix sh:       <http://www.w3.org/ns/shacl#> .
@prefix prof:     <http://www.w3.org/ns/dx/prof/> .
@prefix wikirole: <https://pod.vardeman.me/vault/ontology/wikirole#> .

<>  a wiki:SearchAffordance ,
       prof:ResourceDescriptor ;
    dct:conformsTo <http://www.w3.org/TR/dx-prof/> ,
                   <https://docs.oasis-open-projects.org/oslc-op/query/v3.0/oslc-query.html> ;
    prof:hasRole wikirole:search-affordance ;
    rdfs:label "Wiki Grep Search" ;
    rdfs:comment "Recursive literal-substring AND-search over all readable text/markdown descendants of the target container. Paginated per OSLC Query 3.0 — see oslc:nextPage in responses." ;
    wiki:targetContainer </vault/wiki/> ;
    wiki:dispatchPattern "?ext=search-grep" ;
    wiki:installedBy <https://pod.vardeman.me/vault/ontology/overlay#wiki-memory> ;
    sh:agentInstruction """
      Recursive literal-witness search over wiki-memory pages.

      Wire form (HTTP GET):
        /vault/wiki/?ext=search-grep&oslc.searchTerms=%22<phrase>%22[,%22<phrase>%22…]&oslc.pageSize=<n>&oslc.startIndex=<n>

      Required: oslc.searchTerms — comma-separated double-quoted phrases per
      OSLC Query 3.0 §7.3. URL-encode the quote characters. Multiple terms
      are AND'd: a resource matches iff every term appears in its body at
      least once.

      Optional: oslc.pageSize (default 25, max 100), oslc.startIndex
      (default 0). Response includes oslc:totalCount (full match count) and
      oslc:nextPage when more pages exist.

      WAC enforced server-side: matches the requester cannot read are
      omitted, not denied. Subcontainer-level WAC denial omits the entire
      subtree from enumeration.

      Best for: exact phrases, named entities, citation keys, code
      identifiers, URLs. For paraphrase/synthesis queries follow up with
      wiki-meta-query (SPARQL over .meta).

      Consumer CLI:
        solid-pod wiki-search <container-url> "phrase 1" "phrase 2" …
    """ ;
    wiki:queryParameter [
        wiki:parameter "oslc.searchTerms" ;
        rdfs:comment "Comma-separated quoted phrases per OSLC Query 3.0 §7.3. URL-encoded. Required." ;
        wiki:required true
    ] , [
        wiki:parameter "oslc.pageSize" ;
        rdfs:comment "Max results per page. Default 25, server cap 100." ;
        wiki:required false
    ] , [
        wiki:parameter "oslc.startIndex" ;
        rdfs:comment "0-based result offset. Default 0." ;
        wiki:required false
    ] .
```

- [ ] **Step 11.3: Modify `overlays/wiki-memory/manifest.ttl`**

In the `overlay:providesCapability` block, append:

```turtle
,
        [ cap:capability <https://pod.vardeman.me/vault/meta/capabilities/wiki-search-substrate.ttl> ;
          cap:version "1.0" ;
          cap:descriptor "capabilities/wiki-search-substrate.ttl" ]
```

In the `overlay:installsAffordance` block, append:

```turtle
,
        </vault/meta/affordances/wiki-search-grep.ttl>
```

- [ ] **Step 11.4: Apply the overlay**

```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
~/uvws/.venv/bin/python scripts/overlay/apply.py overlays/wiki-memory
```

Expected: idempotent — uploads new affordance + capability files; pre-existing artifacts are no-ops.

- [ ] **Step 11.5: Verify the affordance is dereferenceable**

```bash
curl -sk "https://pod.vardeman.me/vault/meta/affordances/wiki-search-grep.ttl" \
  --resolve pod.vardeman.me:443:127.0.0.1 \
  -H "Accept: text/turtle" | head -10
```

Expected: Turtle output containing `wiki:SearchAffordance` and `wiki:dispatchPattern "?ext=search-grep"`.

- [ ] **Step 11.6: Verify the capability is dereferenceable**

```bash
curl -sk "https://pod.vardeman.me/vault/meta/capabilities/wiki-search-substrate.ttl" \
  --resolve pod.vardeman.me:443:127.0.0.1 \
  -H "Accept: text/turtle" | head -10
```

Expected: Turtle output containing `cap:name "wiki-search-substrate"`.

- [ ] **Step 11.7: Commit**

```bash
git add overlays/wiki-memory/capabilities/wiki-search-substrate.ttl \
        overlays/wiki-memory/affordances/wiki-search-grep.ttl \
        overlays/wiki-memory/manifest.ttl
git commit -m "[Agent: Claude] wiki-search: capability + affordance descriptors

D87 wiki-search-substrate capability + wiki-search-grep affordance
declared via the existing overlay machinery. apply.py uploads
idempotently; tier-2 agents discover via /vault/meta/capabilities/.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Integration tests (Python pytest, against docker-compose pod)

**Files:**
- Create: `tests/integration/test_wiki_search_e2e.py`
- Create (test fixtures): some markdown files under `/vault/wiki/` in the running pod's content directory

This task validates end-to-end: TLS, OIDC, recursion, AND filtering, WAC, paging, error responses, Link header.

- [ ] **Step 12.1: Create the test scaffolding**

Create `tests/integration/test_wiki_search_e2e.py`:

```python
"""End-to-end integration tests for Phase 7a wiki-search.

Assumes the docker-compose stack is running with CSS at
https://pod.vardeman.me (TLS via mkcert dev cert). Reuses the test
helpers from existing integration tests.
"""

from __future__ import annotations

import os
import re
import subprocess
import time
from pathlib import Path
from urllib.parse import quote

import httpx
import pytest

BASE_URL = "https://pod.vardeman.me"
WIKI_BASE = f"{BASE_URL}/vault/wiki/"

# Fixtures use the dev-allow-all config (no auth); private/public WAC
# scenarios use a per-resource ACL drop.

@pytest.fixture(scope="module")
def client():
    ca = subprocess.check_output(["mkcert", "-CAROOT"], text=True).strip()
    verify = Path(ca) / "rootCA.pem"
    with httpx.Client(verify=str(verify), base_url=BASE_URL) as c:
        yield c

@pytest.fixture(scope="module")
def seeded_pages(client: httpx.Client):
    """PUT a small known set of markdown pages and tear down afterward."""
    pages = {
        "pages/wsearch-alpha.md": "# alpha\n\nthis page discusses progressive disclosure deeply.\n",
        "pages/wsearch-beta.md": "# beta\n\nESPRESSO is the access-control system.\nProgressive disclosure is also mentioned.\n",
        "pages/wsearch-gamma.md": "# gamma\n\nnothing relevant here at all.\n",
        "working/wsearch-delta.md": "# delta\n\nworking note about progressive disclosure and ESPRESSO together.\n",
    }
    headers = {"Content-Type": "text/markdown"}
    for path, body in pages.items():
        url = f"{WIKI_BASE}{path}"
        r = client.put(url, content=body, headers=headers)
        assert r.status_code in (201, 205), f"PUT {url} → {r.status_code}: {r.text}"
    # Give the projection listener a beat to settle
    time.sleep(1.0)
    yield pages
    # Teardown
    for path in pages:
        client.delete(f"{WIKI_BASE}{path}")

def _grep(client, terms: list[str], **params) -> httpx.Response:
    quoted = ",".join(f'"{t}"' for t in terms)
    qp = {"ext": "search-grep", "oslc.searchTerms": quoted, **{f"oslc.{k}": v for k, v in params.items()}}
    qs = "&".join(f"{k}={quote(str(v), safe='\"%,')}" for k, v in qp.items())
    return client.get(f"{WIKI_BASE}?{qs}")

class TestWiringAndSmoke:
    def test_link_header_advertises_querybase_on_wiki_root(self, client: httpx.Client):
        r = client.get(WIKI_BASE)
        link = r.headers.get("link", "")
        assert "ext=search-grep" in link
        assert 'rel="http://open-services.net/ns/core#queryBase"' in link

    def test_link_header_absent_on_profile(self, client: httpx.Client):
        r = client.get(f"{BASE_URL}/vault/profile/")
        link = r.headers.get("link", "")
        assert "ext=search-grep" not in link

    def test_400_on_missing_search_terms(self, client: httpx.Client):
        r = client.get(f"{WIKI_BASE}?ext=search-grep")
        assert r.status_code == 400
        assert r.headers["content-type"].startswith("application/problem+json")
        body = r.json()
        assert "example" in body
        assert "%22" in body["example"]

    def test_400_on_unquoted_terms(self, client: httpx.Client):
        r = client.get(f"{WIKI_BASE}?ext=search-grep&oslc.searchTerms=agent")
        assert r.status_code == 400

    def test_501_on_oslc_where(self, client: httpx.Client):
        r = client.get(f'{WIKI_BASE}?ext=search-grep&oslc.searchTerms={quote("\"x\"")}&oslc.where=foo')
        assert r.status_code == 501

class TestRecursion:
    def test_finds_markdown_in_subcontainers(self, client: httpx.Client, seeded_pages):
        r = _grep(client, ["progressive disclosure"])
        assert r.status_code == 200
        ttl = r.text
        # Three resources should match: alpha (pages/), beta (pages/), delta (working/)
        assert "wsearch-alpha.md" in ttl
        assert "wsearch-beta.md" in ttl
        assert "wsearch-delta.md" in ttl
        assert "wsearch-gamma.md" not in ttl

class TestAndSemantics:
    def test_and_filter_omits_resources_missing_a_term(self, client: httpx.Client, seeded_pages):
        # Only beta and delta mention both phrases
        r = _grep(client, ["progressive disclosure", "ESPRESSO"])
        ttl = r.text
        assert "wsearch-beta.md" in ttl
        assert "wsearch-delta.md" in ttl
        assert "wsearch-alpha.md" not in ttl  # missing ESPRESSO

class TestResponseShape:
    def test_total_count_reflects_post_filter(self, client: httpx.Client, seeded_pages):
        r = _grep(client, ["progressive disclosure"])
        m = re.search(r"oslc:totalCount\s+(\d+)", r.text)
        assert m, "no oslc:totalCount found"
        assert int(m.group(1)) >= 3

    def test_results_sorted_descending_by_score(self, client: httpx.Client, seeded_pages):
        r = _grep(client, ["progressive disclosure"])
        # Extract resource URL → score pairs from the perResult blocks
        pairs = re.findall(r"<([^>]+wsearch-[^>]+)>\s+oslc:score\s+(\d+)", r.text)
        scores = [int(s) for _, s in pairs]
        assert scores == sorted(scores, reverse=True)

    def test_includes_matched_context_snippet(self, client: httpx.Client, seeded_pages):
        r = _grep(client, ["progressive disclosure"])
        assert "vault:matchedContext" in r.text
        assert "vault:matchedLine" in r.text

class TestPaging:
    def test_next_page_emitted_when_more_results(self, client: httpx.Client, seeded_pages):
        r = _grep(client, ["progressive disclosure"], pageSize=1)
        ttl = r.text
        assert "oslc:nextPage" in ttl
        assert "oslc.startIndex=1" in ttl

    def test_no_next_page_on_final_page(self, client: httpx.Client, seeded_pages):
        r = _grep(client, ["progressive disclosure"], pageSize=1, startIndex=10)
        # totalCount is < 10, so the page is empty and no nextPage
        assert "oslc:nextPage" not in r.text

    def test_start_index_beyond_total(self, client: httpx.Client, seeded_pages):
        r = _grep(client, ["progressive disclosure"], startIndex=999)
        # Should return 200 with empty ldp:contains, totalCount reflects truth
        assert r.status_code == 200
        m = re.search(r"oslc:totalCount\s+(\d+)", r.text)
        assert m

class TestWac:
    """Validates omit-don't-deny + subtree omission.

    Each test re-applies an ACL to a specific subdirectory before running.
    """
    def test_anonymous_request_gets_empty_when_all_resources_private(self, client: httpx.Client, seeded_pages):
        # This test depends on the dev config. If dev-allow-all is on, anonymous
        # reads succeed and this test should be skipped. Real WAC tests run in
        # a separate fixture with an authenticated WebID.
        pytest.skip("dev-allow-all config; WAC scenarios covered by Phase 7a follow-up auth fixture")
```

- [ ] **Step 12.2: Run the integration tests**

```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
docker compose up -d
sleep 5
~/uvws/.venv/bin/python -m pytest tests/integration/test_wiki_search_e2e.py -v
```

Expected: all non-skipped tests pass. The WAC scenario is skipped under dev-allow-all (real WAC is exercised in Task 12.3).

- [ ] **Step 12.3: Write the WAC test fixture and the four required scenarios**

Add to `test_wiki_search_e2e.py` (append a new test class):

```python
class TestWacScenarios:
    """The four scenarios from §7 of the original plan + the subtree-omission
    addition from Refinement 1.

    These tests require an authenticated client. The pattern follows
    tests/integration/test_addressbook_e2e.py — read that file before
    implementing; reuse its OIDC + DPoP helpers.

    Skip these in the smoke-test pass; implement them once the base
    plan is green and the authenticated-client harness is in place.
    """

    def test_a_full_access(self):
        """WebID A has read on all wiki content → search returns all matches."""
        pytest.skip("auth fixture pending — implement after smoke green")

    def test_b_partial_access(self):
        """WebID B has read on /vault/wiki/pages/public/ only → search returns
        only that subtree; totalCount reflects post-filter count."""
        pytest.skip("auth fixture pending — implement after smoke green")

    def test_c_container_denied(self):
        """WebID C cannot read /vault/wiki/ → 403 on search GET."""
        pytest.skip("auth fixture pending — implement after smoke green")

    def test_d_container_ok_no_matches_readable(self):
        """WebID D can read container, no matching resource is readable →
        200 + empty ldp:contains + oslc:totalCount 0."""
        pytest.skip("auth fixture pending — implement after smoke green")

    def test_e_subtree_omission(self):
        """Deny WebID E read on /vault/wiki/pages/private/. Place a matching
        markdown under it. Confirm: results don't include private/* AND
        totalCount excludes the private resource."""
        pytest.skip("auth fixture pending — implement after smoke green")
```

Implement these properly once the authenticated-client harness lands (see test_addressbook_e2e.py for the DPoP/OIDC pattern; the wiki-search harness can reuse it directly).

- [ ] **Step 12.4: Run the full integration test file**

```bash
~/uvws/.venv/bin/python -m pytest tests/integration/test_wiki_search_e2e.py -v
```

Expected: ≥10 tests pass, 5 WAC tests skipped with the explicit message.

- [ ] **Step 12.5: Commit**

```bash
git add tests/integration/test_wiki_search_e2e.py
git commit -m "[Agent: Claude] wiki-search: e2e integration tests

Validates Link header advertisement, 400 on malformed input, 501 on
deferred params, recursive walk, AND filtering, score-sorted output,
paging metadata, and oslc:totalCount semantics against the live pod.
WAC scenarios stubbed pending the authenticated-client harness shared
with test_addressbook_e2e.py.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Consumer skill in `solid-agent-skills`

**Files (in sibling repo `~/dev/git/LA3D/agents/solid-agent-skills/`):**
- Create: `src/commands/wikiSearch.ts`
- Modify: `src/cli.ts`
- Create: `skills/wiki-search/SKILL.md`

- [ ] **Step 13.1: Create `src/commands/wikiSearch.ts`**

```typescript
import { fetchResource } from "../lib/http.js";
import { output } from "../lib/jsonld.js";
import N3 from "n3";

export interface WikiSearchOptions {
  pageSize?: string;
  startIndex?: string;
}

interface ResultRow {
  url: string;
  score: number;
  line: number;
  context: string;
}

const OSLC_SCORE = "http://open-services.net/ns/core#score";
const VAULT_LINE = "https://pod.vardeman.me/vault/ontology/wiki#matchedLine";
const VAULT_CONTEXT = "https://pod.vardeman.me/vault/ontology/wiki#matchedContext";
const OSLC_TOTAL = "http://open-services.net/ns/core#totalCount";
const OSLC_NEXT_PAGE = "http://open-services.net/ns/core#nextPage";

/**
 * Issue a wiki-search query against a Pod container.
 *
 *   solid-pod wiki-search <container-url> "phrase 1" "phrase 2" --page-size 25
 *
 * Wraps OSLC §7.3 quoting + URL encoding so the agent never writes the
 * raw URL. Parses the Turtle response, emits JSON with results sorted by
 * score descending plus paging metadata.
 */
export async function wikiSearch(
  containerUrl: string,
  terms: string[],
  opts: WikiSearchOptions = {},
): Promise<void> {
  if (terms.length === 0) {
    output({ error: "at least one search term required" });
    process.exitCode = 1;
    return;
  }
  const quoted = terms.map((t) => `"${t.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",");
  const params = new URLSearchParams({
    ext: "search-grep",
    "oslc.searchTerms": quoted,
  });
  if (opts.pageSize) params.set("oslc.pageSize", opts.pageSize);
  if (opts.startIndex) params.set("oslc.startIndex", opts.startIndex);
  const url = `${containerUrl.replace(/\/?$/, "/")}${"?" + params.toString()}`;

  const res = await fetchResource(url, "text/turtle");
  if (res.status === 400 || res.status === 501) {
    output({ error: `pod returned ${res.status}`, body: tryJson(res.body) ?? res.body });
    process.exitCode = 1;
    return;
  }
  if (res.status !== 200) {
    output({ error: `unexpected status ${res.status}`, body: res.body });
    process.exitCode = 1;
    return;
  }

  const parser = new N3.Parser({ baseIRI: url });
  const quads = parser.parse(res.body);
  const byResource = new Map<string, Partial<ResultRow>>();
  let totalCount: number | null = null;
  let nextPage: string | null = null;

  for (const q of quads) {
    if (q.predicate.value === OSLC_TOTAL && q.subject.value === url) {
      totalCount = Number.parseInt(q.object.value, 10);
    } else if (q.predicate.value === OSLC_NEXT_PAGE && q.subject.value === url) {
      nextPage = q.object.value;
    } else if (q.predicate.value === OSLC_SCORE) {
      const row = byResource.get(q.subject.value) ?? { url: q.subject.value };
      row.score = Number.parseInt(q.object.value, 10);
      byResource.set(q.subject.value, row);
    } else if (q.predicate.value === VAULT_LINE) {
      const row = byResource.get(q.subject.value) ?? { url: q.subject.value };
      row.line = Number.parseInt(q.object.value, 10);
      byResource.set(q.subject.value, row);
    } else if (q.predicate.value === VAULT_CONTEXT) {
      const row = byResource.get(q.subject.value) ?? { url: q.subject.value };
      row.context = q.object.value;
      byResource.set(q.subject.value, row);
    }
  }

  const results: ResultRow[] = Array.from(byResource.values())
    .filter((r): r is ResultRow => r.score !== undefined && r.url !== undefined)
    .sort((a, b) => b.score - a.score);

  output({
    totalCount,
    nextPage,
    pageSize: results.length,
    results,
  });
}

function tryJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}
```

- [ ] **Step 13.2: Register the command in `src/cli.ts`**

Add the import:
```typescript
import { wikiSearch, WikiSearchOptions } from './commands/wikiSearch.js'
```

Add the command (after `program.command('properties …)`):

```typescript
program
  .command('wiki-search <container-url> [terms...]')
  .description('Recursive literal-substring AND-search over wiki-memory markdown pages (Phase 7a, D87)')
  .option('--page-size <n>', 'Max results per page (default 25, max 100)')
  .option('--start-index <n>', '0-based result offset (default 0)')
  .action((url: string, terms: string[], opts: WikiSearchOptions) => wikiSearch(url, terms, opts))
```

- [ ] **Step 13.3: Build the CLI**

```bash
cd ~/dev/git/LA3D/agents/solid-agent-skills
npm run build
```

Expected: clean tsc build.

- [ ] **Step 13.4: Smoke test the CLI against the live pod**

```bash
cd ~/dev/git/LA3D/agents/solid-agent-skills
node dist/cli.js wiki-search "https://pod.vardeman.me/vault/wiki/" "progressive disclosure"
```

Expected: JSON output with `totalCount`, `nextPage`, `pageSize`, `results` (array of `{url, score, line, context}` sorted by descending score).

- [ ] **Step 13.5: Create the skill descriptor**

Create `~/dev/git/LA3D/agents/solid-agent-skills/skills/wiki-search/SKILL.md`:

```markdown
---
name: wiki-search
description: Recursive literal-substring AND-search over wiki-memory L3 markdown pages on a Solid Pod. Returns ranked matches with snippets, paginated per OSLC Query 3.0. Use for literal-witness queries (exact phrases, citation keys, named entities). For paraphrase/synthesis queries, escalate to wiki-meta-query (SPARQL over .meta).
---

# wiki-search

## When to use

Literal-witness search over wiki-memory pages. Best for:
- Exact phrases ("progressive disclosure", "ESPRESSO PG4")
- Named entities (people, projects, citation keys like `@sen-2026-grep-harnesses`)
- Code identifiers, URLs, dates
- Multi-term boolean intersection (AND across all terms — every term must appear)

NOT good for paraphrase or synthesis. If grep returns nothing or low-confidence
matches, escalate to wiki-meta-query.

## Pre-flight — TLS dev cert

If running against a Pod with a mkcert dev cert (D85): ensure `NODE_EXTRA_CA_CERTS` is set to
the mkcert root CA: `export NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem"`. The CLI
auto-detects mkcert at startup and registers the CA via undici, so this is usually a
silent no-op in dev. NEVER set `NODE_TLS_REJECT_UNAUTHORIZED=0`.

## Invocation

```bash
solid-pod wiki-search <container-url> "phrase 1" ["phrase 2" …] [--page-size N] [--start-index N]
```

Example:
```bash
solid-pod wiki-search https://pod.vardeman.me/vault/wiki/ "progressive disclosure" "ESPRESSO"
```

## Response shape

JSON object:
- `totalCount` — full WAC-filtered AND-filtered match count
- `nextPage` — URL of the next page, or `null` on the final page
- `pageSize` — count of results in the current response
- `results` — `[{url, score, line, context}]` sorted by descending score

Score is 0–100, density-based (v1; tuned against Rung 1.5 eval evidence).
`line` is 1-indexed; `context` is a halo-bounded snippet around the first match.

## WAC semantics

The Pod enforces WAC server-side: matches the requester cannot read are
**omitted, not denied**. If a subcontainer is denied, its entire subtree is
absent from the results — agents cannot infer the existence of denied
subcontainers from response shape.

## Limitations (Phase 7a)

- Single Pod only. Federation is Round 4.
- Score formula is v1 — RQ-Search-1 tunes during Rung 1.5 eval.
- `oslc.where` / `oslc.select` / `oslc.orderBy` / `oslc.prefix` return 501.
- No transactional consistency across paginated requests if the Pod is
  being written to mid-query.

## Cross-references

- Affordance descriptor: `/vault/meta/affordances/wiki-search-grep.ttl`
- Capability descriptor: `/vault/meta/capabilities/wiki-search-substrate.ttl`
- Pod-side design: `cogitarelink-solid/docs/plans/2026-05-17-wiki-search-design.md` + refinement
- Decision: D87
```

- [ ] **Step 13.6: Commit (in solid-agent-skills repo)**

```bash
cd ~/dev/git/LA3D/agents/solid-agent-skills
git add src/commands/wikiSearch.ts src/cli.ts skills/wiki-search/SKILL.md
git commit -m "[Agent: Claude] wiki-search: consumer CLI command + Claude skill

Thin HTTP wrapper around the Pod's ?ext=search-grep affordance. Handles
OSLC §7.3 quoting + URL encoding so agents never write the raw URL.
Parses Turtle response with N3.js; emits JSON sorted by score with
paging metadata. SKILL.md frontmatter discoverable by Claude Code.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Performance smoke + p95 latency check

**Files:**
- Create: `tests/integration/test_wiki_search_perf.py`

D87 success criterion: p95 latency < 500ms for representative queries.

- [ ] **Step 14.1: Write the perf smoke test**

Create `tests/integration/test_wiki_search_perf.py`:

```python
"""Phase 7a wiki-search performance smoke.

D87 success criterion: p95 < 500ms for representative queries against a
realistic vault import (~1000 pages). If exceeded, log a follow-up to
swap RegexpSearchEngine for @vscode/ripgrep or WASM ripgrep (Phase 7b).
"""

from __future__ import annotations

import statistics
import subprocess
from pathlib import Path
from time import perf_counter
from urllib.parse import quote

import httpx
import pytest

BASE_URL = "https://pod.vardeman.me"
WIKI_BASE = f"{BASE_URL}/vault/wiki/"

REPRESENTATIVE_QUERIES = [
    ["progressive disclosure"],
    ["ESPRESSO"],
    ["agent"],
    ["context graph"],
    ["RDF"],
    ["wiki"],
    ["progressive disclosure", "ESPRESSO"],
    ["memory", "agent"],
    ["WAC"],
    ["citation"],
]

@pytest.fixture(scope="module")
def client():
    ca = subprocess.check_output(["mkcert", "-CAROOT"], text=True).strip()
    verify = Path(ca) / "rootCA.pem"
    with httpx.Client(verify=str(verify), base_url=BASE_URL) as c:
        yield c

def _grep_url(terms: list[str]) -> str:
    quoted = ",".join(f'"{t}"' for t in terms)
    return f"{WIKI_BASE}?ext=search-grep&oslc.searchTerms={quote(quoted, safe='')}&oslc.pageSize=25"

@pytest.mark.perf
def test_p95_latency_under_500ms(client: httpx.Client):
    """Issue each representative query 5 times; assert p95 across all 50 < 500ms."""
    latencies: list[float] = []
    for terms in REPRESENTATIVE_QUERIES:
        url = _grep_url(terms)
        for _ in range(5):
            t0 = perf_counter()
            r = client.get(url)
            elapsed = (perf_counter() - t0) * 1000.0
            assert r.status_code == 200, f"{terms} → {r.status_code}"
            latencies.append(elapsed)

    latencies.sort()
    p95 = latencies[int(len(latencies) * 0.95)]
    median = statistics.median(latencies)
    print(f"\nlatencies: median={median:.1f}ms  p95={p95:.1f}ms  n={len(latencies)}")

    # D87 success criterion
    assert p95 < 500, f"p95 {p95:.1f}ms exceeded 500ms ceiling"
```

- [ ] **Step 14.2: Run the perf smoke**

```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
~/uvws/.venv/bin/python -m pytest tests/integration/test_wiki_search_perf.py -v -s -m perf
```

Expected output: median + p95 printed; p95 < 500ms.

If p95 exceeds 500ms, do NOT skip the assertion — instead, append a follow-up to `FOLLOWUPS.md`:

```markdown
- [ ] **wiki-search p95 latency regression**: p95 measured at <value>ms (D87 ceiling 500ms). Profile RegexpSearchEngine vs filesystem read cost. Likely action: swap engine to @vscode/ripgrep or WASM ripgrep. See Phase 7b scope in the original plan.
```

- [ ] **Step 14.3: Commit**

```bash
git add tests/integration/test_wiki_search_perf.py
git commit -m "[Agent: Claude] wiki-search: p95 latency smoke (D87 success criterion)

10 representative queries × 5 runs = 50 samples. Asserts p95 < 500ms.
If exceeded, follow-up logged for Phase 7b engine swap.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Update FOLLOWUPS + vault notes; close Phase 7a entry

**Files:**
- Modify: `FOLLOWUPS.md`
- Modify (vault): `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md` — ratify D87
- Modify (vault): `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-PLAN.md` — mark Phase 7a complete

- [ ] **Step 15.1: Edit `FOLLOWUPS.md`**

Replace the Phase 7a entry with a closeout block:

```markdown
## Phase 7a wiki-search — shipped (2026-05-XX)

D87 ratified. Wiki-search CSS extension + Link MetadataWriter + capability
+ affordance descriptors + consumer CLI + Claude skill all shipped. Pod
returns OSLC Query 3.0 responses with WAC-filtered, AND-filtered,
score-sorted, paginated matches over recursive `/vault/wiki/` walks.

### Deferred to Phase 7b/c/d (out of scope for 7a)

- [ ] **Engine swap to BM25 or ripgrep** (Phase 7b). Decision criterion: if
  Rung 1.5 eval shows literal-witness recall < 90% on representative tasks,
  or p95 latency regresses past 500ms.
- [ ] **`oslc.where` structured filter** (RQ-Search-2). Either post-filter via
  Comunica over `.meta`, or push the structured filter into a pre-scan step.
  Defer until eval shows a real workload.
- [ ] **Hybrid RRF orchestrator** (Phase 7c). ~200 LOC; combines literal + BM25.
- [ ] **WebID-partitioned in-pod index** (Phase 7d, ESPRESSO pattern).
- [ ] **`_profile=alt` introspection** for the search response (low-priority).

### Deferred from Phase 7a implementation

- [ ] **WAC scenario integration tests** (test_a–test_e in
  `tests/integration/test_wiki_search_e2e.py`). Stubbed pending the
  authenticated-client harness shared with `test_addressbook_e2e.py`. Implement
  once that harness lands.
- [ ] **Score formula tuning** (RQ-Search-1). v1 baseline is density + log
  dampening; tune against Rung 1.5 eval evidence.
- [ ] **Whether to embed `.meta` triples in search responses** (RQ-Search-4).
  Phase 1 omits; revisit if Rung 1.5 shows agents repeatedly fetching `.meta`
  after a search hit.
- [ ] **Snapshot tokens for transactional pagination consistency**. Phase 1
  documents "stable-within-instant only"; revisit only if Rung 1.5 shows
  pagination drift hurts.
```

(Delete the old "Phase 7a wiki-search — design plan ready" entry — it's superseded.)

- [ ] **Step 15.2: Edit the vault decisions log**

In `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md`, locate D87 and add a "Status: ratified 2026-05-XX (date of Phase 7a ship commit)" line with a pointer to the shipped commit.

- [ ] **Step 15.3: Edit the phase plan**

In `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-PLAN.md`, mark Phase 7a as shipped with a link to the FOLLOWUPS closeout block + key commit SHAs.

- [ ] **Step 15.4: Commit FOLLOWUPS changes**

```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
git add FOLLOWUPS.md
git commit -m "[Agent: Claude] followups: Phase 7a wiki-search closeout

D87 ratified. Deferred items moved to Phase 7b/c/d backlog: engine swap,
oslc.where, hybrid RRF, in-pod index. Sprint-deferred items: WAC
integration tests (auth harness pending), score formula tuning, .meta
embedding decision, snapshot-token pagination.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 15.5: Commit vault changes (in the vault repo)**

```bash
cd ~/Obsidian/obsidian
git add "01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md" \
        "01 - Projects/SOLID Pod Integration/SOLID-Pod-PLAN.md"
git commit -m "[Agent: Claude] solid: D87 ratified — Phase 7a wiki-search shipped

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Final Verification

- [ ] **Step F.1: All unit tests green**

```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/css/extensions/wiki-search
npx vitest run
```

Expected: 7+ test files, all pass.

- [ ] **Step F.2: Integration tests green**

```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
~/uvws/.venv/bin/python -m pytest tests/integration/test_wiki_search_e2e.py tests/integration/test_wiki_search_perf.py -v
```

Expected: e2e tests pass (WAC tests skipped); perf p95 < 500ms.

- [ ] **Step F.3: Pod artifacts dereferenceable**

```bash
for path in \
  /vault/meta/affordances/wiki-search-grep.ttl \
  /vault/meta/capabilities/wiki-search-substrate.ttl
do
  echo "--- $path"
  curl -sk "https://pod.vardeman.me$path" --resolve pod.vardeman.me:443:127.0.0.1 -H "Accept: text/turtle" | head -3
done
```

Expected: all return 200 + Turtle.

- [ ] **Step F.4: CLI smoke**

```bash
cd ~/dev/git/LA3D/agents/solid-agent-skills
node dist/cli.js wiki-search "https://pod.vardeman.me/vault/wiki/" "progressive disclosure" --page-size 5
```

Expected: JSON output with results.

- [ ] **Step F.5: Confirm git state**

```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid && git status
cd ~/dev/git/LA3D/agents/solid-agent-skills && git status
```

Expected: both repos clean.

---

## Open Questions to Surface During Implementation

These are flagged in the refinement spec §5; they don't block shipping but should be noted in the closeout:

- **RQ-Search-1** — density-based score formula tuning (v1 baseline shipped; tune against Rung 1.5 eval evidence).
- **RQ-Search-4** — whether to embed `.meta` triples per match. Phase 1 omits.
- **RQ-Search-2** — when to add `oslc.where`. Phase 1 returns 501.
- **Pagination consistency** — Phase 1 documents "stable-within-instant" only; no snapshot token.
- **Components.js Override multiplicity** (K1) — if `wiki-search.json`'s standalone Override against MetadataWriter conflicts with `memento.json`'s Override on the same instance, consolidate the wiki-search step into `memento.json`. Watched for in Step 10.9.

---

## Reading Order for Implementer

Before writing any code, read in this order:

1. This plan (you're here)
2. `docs/superpowers/specs/2026-05-18-wiki-search-refinement-design.md`
3. `docs/plans/2026-05-17-wiki-search-design.md` (original; refined by #2)
4. `css/extensions/memento/src/MementoHttpHandler.ts` (canHandle/handle pattern)
5. `css/extensions/profile-link/src/ProfileLinkMetadataWriter.ts` (MetadataWriter pattern)
6. `css/extensions/memento/package.json` + `tsconfig.json` (scaffold reference)
7. `css/config/memento.json` (Components.js wiring reference)
8. `overlays/addressbook/affordances/contact-find-by-name.ttl` (affordance descriptor reference)
9. `overlays/wiki-memory/manifest.ttl` (overlay manifest reference)
10. `tests/integration/test_addressbook_e2e.py` (Python pytest + httpx integration test pattern)
11. `~/dev/git/LA3D/agents/solid-agent-skills/src/commands/read.ts` (CLI command pattern)

Total reading: ~45 minutes. Pre-reading saves multiples of that during implementation.
