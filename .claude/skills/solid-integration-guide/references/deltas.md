# Project deltas — solid-integration-guide

## D29 — General-purpose Solid Pod CLI (sibling repo)

D29: General-purpose Solid Pod CLI — `solid-agent-skills` repo under LA3D, built on Bashlib + Comunica; not tied to cogitarelink

**Authoritative artifact**: sibling repo `~/dev/git/LA3D/agents/solid-agent-skills/` — 11 CLI commands (`solid-pod info`, `solid-pod read`, `solid-pod sparql`, etc.) plus 5 Claude Code skills (`/pod-discover`, `/pod-browse`, `/pod-query`, `/pod-create`, `/pod-validate`).

## D14 — alsoKnownAs DID-WebID bridge

D14: `alsoKnownAs` DID-WebID bridge — identity bridge in first WebID profile (Phase 1 foundation)

**Authoritative artifact**: WebID profile in `css/config/pod-templates/`. Identity bridges from this Pod's WebID to a `did:webvh` identifier for VC-aware operations.

## N3.js RDF-star tooling state (2026-05-15 probe)

N3.js 1.26.0 (bundled with CSS 8.0.0-alpha.3) parses RDF-star **only with explicit format flags** like `format: "text/turtle-star"`. Default `text/turtle` rejects `<<...>>` syntax. The N3 Writer always emits RDF-star syntax for quoted-triple quads regardless of format flag — no downgrade-to-classical-reification serializer exists upstream.

Implications for this Pod:
- CSS conneg pipeline currently advertises `text/turtle` for `.meta`; would need Components.js overrides in `mapping/`, `patching.json`, `quad-to-rdf.json` to advertise `text/turtle-star`
- Python clients (rdflib 7.6.0) cannot parse RDF-star at all — hard blocker for downstream `.meta` readers
- Full design exploration: `docs/plans/2026-05-15-rdf-star-provenance-exploration.md` (candidate D82 for RQ-Listener-1)
