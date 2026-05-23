---
type: procedure
created: 2026-05-23T00:00:00Z
modified: 2026-05-23T00:00:00Z
maturity: draft
---

# How to Ingest a Source

A procedure for processing a new source into the wiki-memory corpus. Implements the Karpathy "Ingest" operation with the fan-out discipline that drives [[compounding-knowledge]]{.related}.

## Steps

1. Read the source. Identify the primary concept(s) it discusses.
2. For each concept mentioned, check whether a [[wiki-memory]]{.related} page already exists.
3. If yes: update that page with a cross-reference to the source and any new claims it introduces. Pay attention to whether claims agree or disagree with what is already there.
4. If no: create a new concept page using the appropriate L3 shape — Concept for definitions, Person for individuals, Organization for institutions, HowTo for procedures.
5. Create an entity page for the source itself if it represents a distinct work worth referencing.
6. Append an entry to the ingest log capturing what was added and what was updated.

The fan-out — one source producing multiple page updates plus new entity pages — is what distinguishes ingest from accumulation. Without fan-out, sources pile up but the corpus does not compound. With fan-out, every source becomes navigation hooks for future sources.

Validation: after ingest, every claim in the source should be reachable by typed-edge traversal from the existing corpus. If a claim is unreachable, the fan-out was incomplete and the corresponding cross-reference is missing.
