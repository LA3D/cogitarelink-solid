# markdown-rdfa

Sample A for cogitarelink-solid Phase 2b.

Renders Solid Pod markdown notes to semantically-annotated HTML with resolved
wikilinks and RDFa attributes. Standalone TypeScript pipeline — not yet wired
into CSS as a `RepresentationConverter`.

## What it does

```
text/markdown
  → remark-parse
  → remark-frontmatter           (strip YAML)
  → remark-typed-wikilinks       (parse [[Note]]{.class}, custom)
  → remark-rehype
  → rehype-document              (wrap in <html>)
  → rehype-prefix-decl           (add CURIE prefixes, custom)
  → rehype-rdfa                  (add property/typeof/resource on <a>, custom)
  → rehype-format
  → rehype-stringify
```

Typed wikilinks follow [D36](../../../../../Obsidian/obsidian/01\ -\ Projects/SOLID\ Pod\ Integration/SOLID-Pod-Decisions.md):

| Markdown | RDFa property |
|---|---|
| `[[Note]]` | `skos:related` (default) |
| `[[Note]]{.related}` | `skos:related` |
| `[[Note]]{.source}` | `dct:source` |
| `[[Note]]{.extends}` | `vault:extends` |
| `[[Note]]{.criticizes}` | `vault:criticizes` |
| `[[Note]]{.supports}` | `vault:supports` |
| `[[Note]]{.partof}` | `dct:isPartOf` |

## Usage

```bash
npm install
npm run build

# Render a markdown file to stdout
node dist/cli.js path/to/note.md

# Render to a file
node dist/cli.js note.md --out note.html --title "Context Graphs"

# Run via tsx (no build step)
npm run render -- note.md --out note.html

# Tests
npm test
```

## Status

Standalone, exercising the unified pipeline directly. Wikilink resolver is
hardcoded — slugs the title and points at `/vault/resources/concepts/`. The
next step (Phase 2b Step 3) is to swap in a live Type Index resolver that
queries the running pod.

Will eventually be wrapped as a CSS `RepresentationConverter` component
(Components.js packaging, like `shape-validator`) — see D37 for the design.
