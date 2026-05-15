# Project deltas — solid-spec

This Pod diverges from upstream Solid defaults in three places. Each delta links back to the canonical decision number in `.claude/rules/decisions-index.md`.

## D14 — alsoKnownAs DID-WebID bridge

D14: `alsoKnownAs` DID-WebID bridge — identity bridge in first WebID profile (Phase 1 foundation)

**Authoritative artifact**: WebID profile in `css/config/pod-templates/`.

## D44 — Storage description replaces `.well-known/void`

D44: Storage Description Resource replaces `.well-known/void` — spec-mandated slot via `solid:storageDescription` Link header. Router, not manifest — points to browseable catalog containers via `rdfs:seeAlso`

**Authoritative artifact**: Storage description endpoint, configured via CSS extension. See sibling skill `solid-storage-description` (when created in Task 10).

## D75 — RDFa drop (revises D37)

D75: Rendered HTML serves humans; no RDFa embedding (REVISES D37) — keep the remark/rehype pipeline for converting markdown to HTML for browser viewing, but drop the rehype-rdfa step. Rendered HTML carries semantic CSS classes only (`<a class="wikilink wikilink-{type}">`), no `property="vault:concept"` or other RDFa attributes. The data layer is exclusively `.meta` Turtle, projected from the same body by the `MarkdownProjectionListener` (D58 sharpened). RDFa would be a redundant third surface nobody reads — LLM agents read raw markdown, SPARQL agents query `.meta`, humans use Obsidian/IDE/browser-rendered HTML. The Obsidian Preview model is the reference. Implies a rename: `css/extensions/markdown-rdfa/` → `markdown-render/`.

**Authoritative artifact**: `css/extensions/markdown-render/` (renamed from markdown-rdfa). See `docs/superpowers/specs/2026-05-15-rung-1-4-wiki-memory-l3-implementation-design.md` for full reasoning.
