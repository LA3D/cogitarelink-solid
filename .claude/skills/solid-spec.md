# /solid-spec

Solid Protocol reference — Solid Protocol, WebID Profile, Solid-OIDC, ACP, WAC. Routes to the vendored upstream `solid/spec.md` plus this repo's deltas where we diverge from defaults.

## Primary reference

Read `vendor/solid-llm-skills/solid/spec.md` for: protocol concepts, request/response patterns, WebID profile schema, Solid-OIDC token flow, ACP matchers, WAC modes. Synced from upstream commit `9a1cab17`.

## Where we diverge from upstream defaults

### Storage description (D44)

Upstream's `spec.md` reflects the Solid Protocol's `solid:storageDescription` Link header pattern. Our implementation places the descriptor at the standard slot but **adds Memento + LDES + AS + PROV-O `void:vocabulary` declarations** (D49) and links to browseable catalog containers via `rdfs:seeAlso` rather than embedding everything inline. See D44 + D48 in `.claude/rules/decisions-index.md`.

### WAC + ACP coexistence

CSS v8 ships `@solidlab/policy-engine`. We default to **WAC for dev** (`dev-allow-all.json`) and **ACP for production paths that need VC-gated operations** (D25, D62, D64 — see `/components-override` for the policy-engine override). Rung 1.3 will pin the boundary.

### Solid-OIDC right now

Upstream `spec.md` cites Solid-OIDC drafts. Our practical reality:
- CSS v8.0.0-alpha.3 implements Solid-OIDC with `@inrupt/solid-client-authn-node` interop on the client side
- For agent identity, we use a `did:webvh` ↔ WebID bridge via `alsoKnownAs` per D14
- Production VC enforcement plan: D25 ACP `acp:vc` matchers + Credo-TS sidecar (Rung 1.3 territory)

### Type Index (D8)

Per spec, the Type Index maps RDF class to container URL for class-discovery. We use it as the **primary machine-actionable navigation surface** alongside the storage description (D8 expanded by D45/D48 as view catalog). The `MetadataWriter_LinkRel` linkRelMap (overridden in `css/config/solid-config.json`) emits Link headers per Type Index registration so agents can follow-your-nose from any resource.

## Quick lookups

| Question | File / section |
|---|---|
| WebID profile structure | `vendor/solid-llm-skills/solid/spec.md` § WebID |
| Solid-OIDC token flow | `vendor/solid-llm-skills/solid/spec.md` § Solid-OIDC |
| ACP matcher syntax | `vendor/solid-llm-skills/solid/spec.md` § ACP |
| WAC mode semantics | `vendor/solid-llm-skills/solid/spec.md` § WAC |
| Type Index registration shape | `vendor/solid-llm-skills/solid/spec.md` § Type Index |
| Storage description (our delta) | D44, D48 in `.claude/rules/decisions-index.md` |
| Memento on top of Solid Protocol (our extension) | D61–D64 in same file |

## What's NOT in upstream

- Memento integration design (D61–D68): only in our decisions log + `Memento Vocabulary Alignment.md` (vault)
- Tombstone semantics for LDP DELETE (D64): only in our decisions log
- Affordance descriptor architecture (D52, D55, D58): only in our decisions log
- The `shape-validator` write-time validator pattern: only in this repo + `/shacl-shapes` skill
- MonitoringStore CDC pattern (D65): only in our decisions log + `/monitoring-store` skill

## Sync to upstream

Re-run the vendor sync (see `vendor/solid-llm-skills/README.md`) periodically. Upstream is marked 100% complete in their STATUS.md as of 2026-05-14; expect slow drift, not rapid churn.

## Related skills

- `/solid-integration` — `@inrupt/solid-client` and authn library specifics
- `/shacl-shapes` — Solid's SHACL conventions in this Pod
- `/components-override` — when implementing protocol features as CSS extensions
- `/decision-lookup` — pull specific D-numbered decisions from the canonical log
