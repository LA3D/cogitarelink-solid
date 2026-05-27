---
skos:prefLabel: "Two-Hierarchy Memory Addressing"
---

# Two-Hierarchy Memory Addressing

> **Note on these URLs:** the `wiki` path segment names the **wiki-memory profile** (an L3 reference profile in this Pod's L1/L2/L3 stratification), **not** a wiki application. This Pod is a general Solid/LDP substrate; wiki-memory is one profile built on it. Read `concepts/` etc. as *profile* containers, and resolve a resource's `<#this> a …` for its actual class.

A memory about how this memory works. When you write a typed link in a page, two
different hierarchies are doing two different jobs — and conflating them is the most
common way agents misread the substrate.

## The two hierarchies

- **RDFS subsumption is the *addressing* axis.** `rdfs:subClassOf` (class → superclass)
  decides **where a resource lives** (which container, via the Type Index), **which SHACL
  shape governs it**, and **which predicates the substrate manages**. The substrate reasons
  over the class hierarchy to answer "what kind of thing is this, and where does it go?"
- **SKOS `broader` is the *navigation* axis.** `skos:broader` / `skos:narrower` /
  `skos:related` organize *topics* for reading and traversal. `broader` deliberately carries
  **no** instance subsumption (W3C *SKOS Reference* §4) — a narrower topic is not a subclass.

They are **never substituted for each other.** The only bridge is one axiom
(`<#this> a` something that is `rdfs:subClassOf skos:Concept`) plus the Type Index. Use
RDFS to *address*; use SKOS to *navigate*.

## The wikilink form

A typed body link is `[[Title]]{.hint}`. The `{.hint}` is the **edge type** — it picks the
**predicate**, not the target's type:

- `Works at [[Notre Dame]]{.affiliation}` → `<#this> schema:affiliation <…/organizations/notre-dame.md#this>`
- `Builds on [[Progressive Disclosure]]{.extends}` → `cito:extends`
- `[[Karpathy LLM Wiki]]{.broader}` → `skos:broader` (navigation, not subsumption)

The link's **container** is resolved from the **predicate's range class** via the Type Index
(`schema:affiliation` ranges over `schema:Organization`, which the Type Index routes to the
organizations container). It is **not** read off the hint, and the hint never asserts the
target's type.

## What you must NOT infer from a link

The hint tells you the *relationship*. It does **not** tell you the target's class. The
predicate's range is the substrate's **addressing expectation** and your **prefetch hint** —
never a fact. The target's authoritative type is whatever the target's own `<#this> a …`
says (a page only ever asserts about itself). So: **to claim anything about a target's type,
resolve `<target#this>`** — don't entail it from the edge. A link to a not-yet-created target
is a normal, reconcilable state, not an error.

## Extending the type system

New application types join by declaring `rdfs:subClassOf skos:Concept` (ESCO "Pattern C") when
their instances are navigable topics — each instance is then both a `skos:Concept` (taxonomy)
and a domain-typed individual (container/shape) — and by registering a Type Index entry.
Cross-scheme correspondence uses `skos:exactMatch` / `skos:broadMatch`, **never**
`owl:equivalentClass` or OWL punning (tooling hazards, OWL-Full).

## How to check your work

- The container an edge points into encodes the *expected* class (its path). Resolve the
  target to confirm its *actual* class before relying on it.
- The substrate's `routing.jsonld` is the source of truth for which predicate routes to which
  class; the Type Index is the source of truth for which class lives in which container.

## Prior art

This pattern follows the W3C guidance on using OWL and SKOS together and the ESCO data model's
class/concept split.
