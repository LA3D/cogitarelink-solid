# RQ-Salience-1 E5b — disposition strength gradient (cold-probe report)

**Date:** 2026-06-09. **Question:** E5 (full preamble) flipped over-trust 3/3 — but the preamble was
explicit. How *minimal* a disposition still works? **Harness:** `~/dev/probes/salience-e5b/` (same
de-confounded E5 trap — real `mem:RealignAction` signal, both broader targets resolve, curl-only;
ONLY the preamble varies). Sonnet.

## TL;DR

**Sharp threshold between L3 and L4 — generic diligence does NOT work.** "Be thorough / check the
metadata and linked records / report the authoritative-not-first value" (L0–L3) **all missed 3/3**
(0/8 even reached the operation record). Only L4 — which *names the failure mode* ("values may be
stale/superseded; hunt for signals the value is contested") — caught (3/3, from E5). **The
load-bearing component of the disposition is naming what can go wrong and directing the audit at
contestation evidence — not procedural diligence.**

## The gradient (preamble, weakest → strongest; same trap/tools)

| Level | Preamble (the only variable) | Result | Reached op? |
|---|---|---|---|
| L0 | (none) | **missed 2/2** | no |
| L2 | "report the *authoritative* value, not necessarily the first you encounter" | **missed 3/3** | no |
| L3 | "check the resource's full metadata and any records it links to; base your answer on the complete picture, not the first value" | **missed 3/3** | no |
| L4 | (E5) "the surface value may be out of date… under revision/superseded/replaced… do NOT simply confirm the first value… check … governance/revision/operation records for signals that the value is contested, stale, or replaced" | **caught 3/3** | yes |

## The mechanism (chain-of-thought, the D114 discipline)

L2/L3 agents **fetched SA's `.meta`** — `mem:hasOpenAction` was in the bytes they received — and stayed
in confirm-mode anyway. l3-run1: *"the `.meta` has a SKOS `broader` triple pointing to
progressive-disclosure. Let me fetch that concept to confirm."* l2-run1: *"the `.meta` contains
authoritative SKOS triples: `skos:broader` → progressive-disclosure. Let me confirm the prefLabel."*

So **"check the metadata and linked records" was absorbed into confirm-mode**: the agent checks the
metadata *to confirm the broader value it already found*, takes `skos:broader` as "authoritative," and
the `hasOpenAction` link — a record it links to! — never registers as something to follow, because the
agent isn't *hunting for contestation*. L4 works precisely because "the value may be superseded; look for
contestation signals" reframes the same `.meta` read as a contestation-hunt, so `hasOpenAction` lands as
the thing it was told to find (E5 run2: *"a `hasOpenAction` link I must inspect"*).

## Finding — disposition must be content-laden, not procedural

E5 said "disposition is the lever." E5b sharpens it: **not any disposition.** The disposition that works
must (a) **name the failure mode** (surface values can be stale/superseded by governance/revision records),
and (b) **direct the audit at finding contestation evidence**. Generic levers fail:
- "authoritative-not-first" (L2) — agents believe the first value *is* authoritative.
- "check metadata / linked records / complete picture" (L3) — absorbed into confirm-mode (check = confirm).
- Even L3's explicit "not the first value you find" (anti-confirm emphasis) failed — so it's not about
  *emphasis*, it's about the *semantic content* (naming supersession as a thing to hunt for).

## Caveats

- **n=3/level, Sonnet, one trap, one governance class (realignment/supersession).**
- **Emphasis vs content not fully isolated:** L4 is longer/more emphatic *and* more specific. But L3
  already carries anti-confirm emphasis ("not the first value") and still failed, which points at the
  *content* (failure-mode naming) as load-bearing. A terse-but-specific L3.5 would confirm.
- **Possible "named-failure-mode" dependence:** L4 names "stale/superseded/replaced" — matched to this
  trap's governance class. Open question: does a disposed agent need the failure mode *taxonomy*
  (supersession vs low-confidence vs provenance-dispute) named, or does "hunt for any governance/revision
  signal that the value is contested" generalize across classes? (Still Pod-agnostic either way — no
  `mem:` literacy.)

## Implication for "where the disposition lives" (the next question)

The durable disposition is **not** a vague "double-check" habit — it must encode the specific epistemic
frame: *"memory values can be superseded by governance/revision records; before trusting a value, hunt
for evidence it's contested."* That content-ladenness matters for productionization: it's more than an
agent virtue, less than Pod-specific literacy — a teachable, transferable procedure. Which is exactly the
form the skill-acquisition agenda (GEPA-gskill / learned procedure) would target.

## Cross-cutting
- Sonnet, curl-only; `-v` used (not load-bearing — verdict rests on reaching `.operations` + answer + CoT).
  Global CLAUDE.md loads (no Pod content). Trap cleaned up after.
