# metadata-card

Sample B (fallback converter) for cogitarelink-solid Phase 2b.

Renders a Solid Pod resource's `.meta` Turtle sidecar as a self-contained HTML
"index card." Works for **any** content type because it only reads `.meta` —
markdown, PDF, image, dataset, office doc, generic binary. This is the
shared-drive fallback view for the pod: when no content-type-specific
converter is available, the human still gets a useful page.

## What you get

- **Title** — `dct:title` / `skos:prefLabel` / `rdfs:label` (first hit)
- **Type chips** — `rdf:type` short names
- **Description** — `dct:description` / `rdfs:comment` / `skos:note`
- **Metadata fields** — format, created, modified, contributor, source
- **Typed relationships** grouped by label — Related, Source, Extends, Criticizes, Supports, Part of, Derived from
- **Open underlying resource** download/link button
- **Collapsed "all other triples"** detail section for transparency

Light + dark mode via CSS color-scheme + system colors. No JavaScript required.

## Usage

```bash
npm install
npm run build

# From a local Turtle file
node dist/cli.js sample.ttl --out card.html

# Pull straight from the running pod (.meta sidecar URL)
node dist/cli.js --url http://pod.vardeman.me:3000/vault/resources/concepts/context-graphs.md.meta \
  --resource http://pod.vardeman.me:3000/vault/resources/concepts/context-graphs.md \
  --out card.html

# Run via tsx (no build step)
npm run render -- sample.ttl --out card.html

# Tests
npm test
```

## Status

Standalone — not yet wrapped as a CSS `RepresentationConverter`. The intent
(see SOLID-Pod-PLAN.md Phase 2b) is to register this as the **fallback**
converter in CSS so any GET with `Accept: text/html` against a resource that
has no specific converter falls back to the metadata card.

Companion to `markdown-rdfa` (Sample A): markdown notes get the full
remark/rehype pipeline; everything else gets the metadata card.
