// Cross-language slug golden vectors (R-T7, audit R3).
//
// wikiUrl.ts:slug() is THE live wiki-memory L3 URL minter (R-T2). The Python
// importer (scripts/lib/rdf_gen.py:slug) is RECONCILED to it. This test runs the
// TS slug over the SHARED fixture tests/fixtures/slug-vectors.json; pytest
// tests/test_slug_golden_vectors.py runs the Python slug over the SAME file.
// Both must agree on every `expected`, so the two language implementations can't
// drift on the minted URL (the bug: importer writes orphan/colliding resources).
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { slug, stripCitekeyMarker } from "./wikiUrl.js";

const here = dirname(fileURLToPath(import.meta.url));
// shared/markdown-parsing/src → repo root is five levels up.
const FIXTURE = join(here, "..", "..", "..", "..", "..", "tests", "fixtures", "slug-vectors.json");
const fixture = JSON.parse(readFileSync(FIXTURE, "utf8"));

describe("slug golden vectors (TS side; pytest runs the same fixture)", () => {
    for (const v of fixture.vectors as Array<{ input: string; expected: string; note: string }>) {
        it(`slug(${JSON.stringify(v.input)}) === ${JSON.stringify(v.expected)} — ${v.note}`, () => {
            expect(slug(v.input)).toBe(v.expected);
        });
    }

    for (const v of fixture.citekeyVectors as Array<{ input: string; expected: string; note: string }>) {
        it(`slug(stripCitekeyMarker(${JSON.stringify(v.input)})) === ${JSON.stringify(v.expected)} — ${v.note}`, () => {
            expect(slug(stripCitekeyMarker(v.input))).toBe(v.expected);
        });
    }
});
