# Typed-Wikilink Syntax — Provenance & Reference (D36)

**What this documents:** where the `[[Target]]{.hint}` typed-Markdown syntax this Pod uses
comes from — the standard it derives from, the prior art that gave us the idea, and where it
is implemented in this repo. Companion to decision **D36** (`decisions.md`).

---

## 1. The syntax

```markdown
[[Context Graphs]]                  → wikilink, default predicate (skos:related)
[[Context Graphs]]{.related}        → typed: predicate = skos:related
[[@zhang-2025-rlm]]{.source}        → typed: predicate = dct:source
[[Note Title|display label]]        → display alias; target = "Note Title"
[[Note Title|display]]{.source}     → alias + type
```

It is a **deliberate composition of two existing syntaxes**, not an invention:

| Part | Origin | What it is |
|---|---|---|
| `[[Target]]` / `[[Target\|alias]]` | **MediaWiki → Obsidian wikilinks** | De-facto wiki internal-link convention (no W3C/CommonMark spec). |
| `{.hint}` | **Pandoc attribute syntax** | A class attribute inside Pandoc's `{#id .class key=val}` attribute block; `.foo` = a class named `foo`. |

So `[[X]]{.broader}` reads as: *"an Obsidian wikilink to X, carrying the Pandoc class
attribute `broader`,"* which the substrate maps to the RDF predicate `skos:broader`.

---

## 2. The standard it derives from

- **Pandoc Markdown — attribute syntax.** The `{ … }` attribute block with `.class`
  shorthand is defined in the Pandoc Manual (the `bracketed_spans`, `link_attributes`,
  and "Divs and Spans" extensions). <https://pandoc.org/MANUAL.html>
  This lineage descends from **PHP Markdown Extra**'s attribute blocks, which Pandoc
  generalized. `kramdown` supports the same `{:.class}`/`{.class}` form.
- **There is NO W3C standard** for carrying linked-data typing inside Markdown. A survey
  (vault, April 2026) found ~7 independent "semantic Markdown" attempts, none widely adopted.
  We chose Pandoc attributes as the carrier because they are production-grade, already parsed
  by remark/kramdown, and visually low-ceremony.

---

## 3. The prior art that gave us the idea

The original idea — *carry the RDF type inline via a `{.class}` attribute, where the leading
`.` denotes a type/class* — comes from **Sparna's "Semantic Markdown Spec (Alpha Draft)"**
(Sparna / Thomas Francart): <https://hackmd.io/@sparna/semantic-markdown-draft>. The vault
survey note *Markdown-LD Landscape* flags it as the approach **"closest to our typed wikilink
idea."**

**What the spec actually proposes** (verified at source, 2026-06-01): bracketed-span + Pandoc
attribute, mapping directly to RDFa —

| Sparna syntax | Generates (RDFa) | Meaning |
|---|---|---|
| `[text]{.foaf:Person}` | `typeof` | **type/class** (leading `.`) |
| `[text]{foaf:name}` | `property` | predicate |
| `[text]{=wdt:Q42}` | `resource` | subject IRI (leading `=`) |

Verbatim: *"My name is `[Manu Sporny]{:name}` and you can give me a ring via
`[1-800-555-0199]{:telephone}`."*

**Relationship to D36 (the precise lineage):** we share the **core convention — a Pandoc
`{.class}` attribute whose leading-`.` carries an RDF type**, rendered to RDFa. The one
difference is the *carrier*: Sparna annotates **inline bracketed spans** (`[text]{.class}`,
prose-level); we annotate **Obsidian wikilinks** (`[[Target]]{.class}`), because our links are
global pod-URI references between resources, not inline prose annotations. So D36 = *Sparna's
`{.class}`-as-type idea applied to wikilinks instead of spans*. (NB: an earlier characterization
in the vault note as wiki-style `[[S::O]]` was a conflation with a separate older "semantic
wiki" lineage; the actual Sparna spec is the bracketed-span/`{.class}` form documented here.)

Surrounding prior art surveyed before settling on D36 (all in the vault landscape note):

| Approach | Author / project | Relation to ours |
|---|---|---|
| **Semantic Markdown Spec (Alpha Draft)** | **Sparna / Thomas Francart** | **Closest ancestor** — shares the `{.class}`-attribute-carries-an-RDF-type convention (→ RDFa `typeof`). Difference: Sparna annotates bracketed spans `[text]{.class}`; we annotate wikilinks `[[Target]]{.class}`. <https://hackmd.io/@sparna/semantic-markdown-draft> |
| Markdown-LD (literate Turtle) | ozekik | Inline `{Alice}(ex:Alice)` annotations → Turtle. Richer but cluttered; breaks vanilla render. |
| YAML-LD | W3C (standards track) | The only standards-track effort; frontmatter-as-JSON-LD. We use it for the *frontmatter* layer, not the inline-link layer. |
| Nanotation | Kingsley Idehen (OpenLink) | Turtle in backticks; needs a browser extension. |
| DOT-LD | AWS Samples (Lassila) | `::config`/`::rel` fenced blocks + `[[wikilinks]]`. Block-structured rather than inline-attribute. |
| CURIE-in-Markdown | CommonMark discussion | **Rejected** there ("feels like code" — readability). |
| `.meta` sidecar | Solid / CSS | Our authoritative RDF layer; the typed wikilink is the lightweight inline complement. |

**Empirical grounding (the "paper"):** **Volpini et al. 2026, *Structured Linked Data as a
Memory Layer for Agent-Orchestrated Retrieval*** (arXiv:2603.10700, WordLift). A controlled
2,443-query study showing that **making linked-data structure *visible* in the document**
(their "Enhanced Entity Page": materialized NL + dereferenceable typed links + agent
instructions) yields large RAG-accuracy gains (+29.6%, d≈0.60), whereas embedded JSON-LD alone
barely moves flat-text pipelines (+0.17, d=0.18). This is the empirical case for our choice:
**inline, visible typed links beat invisible embedded structure** for agent consumers — exactly
what `[[X]]{.broader}` provides over a JSON-LD island the agent never parses. Vault note:
`@volpini-2026-structured-linked-data`.

**Conceptual home (vault):** the design rationale lives in the vault concept note
**`Linked Data Affordances in Markdown`** (`03 - Resources/Agentic Memory Systems/Core
Concepts/`), which frames the multi-layer affordance model (`.meta` sidecar + typed wikilinks
+ RDFa render + `sh:agentInstruction`) and surveys the prior art above.

---

## 4. Where it lives in this repo

- **Decision of record:** `D36` — *"Typed wikilinks via Pandoc attribute syntax — `[[Note]]{.class}`
  maps to RDF predicates"* (`.claude/skills/decision-lookup/decisions.md`); sharpened by **D58/D71**
  (body wikilinks projected to `.meta` by `MarkdownProjectionListener` — dual-layer linking at
  single-request cost).
- **Parser:** `css/extensions/shared/markdown-parsing/src/wikilinks.ts`
  — regex `/\[\[([^\]\|]+?)(?:\|([^\]]+?))?\]\](?:\{\.([a-zA-Z][\w-]*)\})?/g`; header comment
  documents the Obsidian-wikilink + Pandoc-attribute composition.
- **Two consumption paths from the same `{.class}` source (D58/D71):**
  1. **Projection path** → `.meta` Turtle triple (the queryable graph view).
  2. **Render path** → RDFa `property` CURIE on the `<a>` (the HTML view for humans/web agents).

### Drift caveat (flagged for Front-2 cleanup)

The hint→predicate mapping exists in **two places that have drifted**:

- `css/extensions/shared/markdown-parsing/src/predicates.ts` (the **render path**) — still uses
  the legacy `vault:` namespace (`vault:extends`, `vault:criticizes`, `vault:supports`), 6 entries.
- The **projection path** — `markdown-projection`'s `governedPredicates.ts` + the served JSON-LD
  context (`/vault/meta/context.jsonld`) + each shape's `sh:agentInstruction` — uses the current
  `cito:` / `skos:` vocabulary (`{.extends}`→`cito:extends`, `{.cites}`→`cito:cites`,
  `{.source}`→`dct:source`, `{.author}`→`dct:contributor`, …).

**Canonical, current source = the JSON-LD context + shape `sh:agentInstruction`** (the
projection path the cold-probe agents actually hit), NOT the older `predicates.ts` render map.
This is the same "two maps, one source" hazard the D106 review flagged for the routing kernel;
reconcile during the D108 Front-2 work.

---

## 5. References

- Pandoc Manual — attribute syntax (`bracketed_spans`, `link_attributes`, Divs/Spans):
  <https://pandoc.org/MANUAL.html>
- Sparna — *Semantic Markdown Spec (Alpha Draft)* (Thomas Francart):
  <https://hackmd.io/@sparna/semantic-markdown-draft> — the `{.class}`-carries-an-RDF-type
  ancestor (bracketed spans; we apply the same convention to wikilinks).
- Volpini, Raad, Gamba, Riccitelli (2026), *Structured Linked Data as a Memory Layer for
  Agent-Orchestrated Retrieval*, arXiv:2603.10700 — visible-structure empirical case.
  Datasets/templates: <https://github.com/wordlift/seo3-reasoning-web>
- Vault: `Linked Data Affordances in Markdown` (design rationale + prior-art survey);
  `Markdown-LD Landscape - Semantic Markup for Markdown` (the ~7-approach survey);
  `@volpini-2026-structured-linked-data` (literature note); `DOT-LD - Markdown Knowledge Graph Syntax`.
- Repo: `D36`, `D58`, `D71` in `.claude/skills/decision-lookup/decisions.md`.
