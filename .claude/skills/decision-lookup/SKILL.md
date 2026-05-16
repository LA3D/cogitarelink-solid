---
name: decision-lookup
description: Look up architectural decisions (D1-D86, K1-K3, RQ-*) for cogitarelink-solid — full prose, supersessions, cross-references, and the skill-to-decision mapping. Invoke when you need the rationale or status of a specific decision ID, when a code change touches a decision area and you need to verify alignment, or when reconciling supersessions (e.g., "is D32 still in force?").
---

# Decision Lookup

Full architectural decisions log + cross-reference index lives in `decisions.md` next to this SKILL.md. Vault canonical source: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md`.

## When to invoke

- A query mentions a decision ID (`D7`, `D44`, `K1`, `RQ-Listener-1`).
- A code change touches an area governed by a decision cluster (Memento, URI conformance, TLS, wiki-memory L3, projection listener, capability catalog).
- Reconciling a supersession ("does D32 still apply?" → check the index for revised-by markers).
- Mapping a topic to its skill (URI conformance → `solid-uri-conformance`; affordances → `solid-affordance-descriptors`; etc.).

## Lookup workflow

1. **Read `decisions.md`** in this directory — it's the full index (D1–D86, K1–K3, RQs).
2. **Filter by ID or topic**:
   - Direct ID: grep the doc for `^D{N}:` or `^K{N}:` or `^RQ-`.
   - Topic: use the "Skill cross-reference" table at the top to find the topic-coherent D-cluster, then its dedicated skill.
3. **Check supersessions**: many decisions have been revised. The index marks these inline (e.g., "REVISED by D75", "SUPERSEDED by D70/D71/D72"). Trust the latest unrevoked entry.
4. **Cross-reference**:
   - Most D-clusters have a dedicated skill at `.claude/skills/<name>/SKILL.md`. Invoke it for full detail beyond the one-line index entry.
   - Vault `SOLID-Pod-Decisions.md` is canonical — read it directly for any decision that lacks a dedicated skill.

## Output shape

When reporting a decision back to the user, include:

- Decision ID + one-line summary
- Status (active / superseded-by / revised-by)
- Related skill (if any)
- Cross-references (which other decisions cite or revise this one)

## Skill-to-decision map

See the table at the top of `decisions.md` ("Skill cross-reference"). Topic-coherent D-clusters surface as Claude Code skills; this skill is the index of last resort when no specific skill matches.
