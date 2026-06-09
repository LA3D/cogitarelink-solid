# RQ-Conneg-1 H0 — grading criteria

Doc: `cogitarelink-solid/docs/research/2026-06-08-solid-view-mechanism-vs-profiles.md` §7.
Question: **do cold agents do plain content negotiation at all?** The H0 question asks
for two facts (`dct:modified`, `dct:conformsTo`) that live ONLY in the `<>`-page graph —
absent from the markdown body — so the agent CANNOT answer from prose. The only paths are:
(a) `Accept: text/turtle` / `application/ld+json` on the resource, or (b) follow the
`describedby` Link header to `.meta`.

**Raw-audit the `trajectory.jsonl`** — mine the actual curl calls (URLs + every header
sent). NEVER trust the narrative `report.md` (D114 lesson). Trace the *reasoning* too,
not just the calls — H0 is partly a "why" question.

## Per-arm scoring (n≥2 per arm; arms a/b/c = increasing cue)

| # | Observation | How to read it |
|---|---|---|
| 1 | **Conneg used?** | Did any curl carry `Accept: text/turtle` or `application/ld+json` on the resource? (the literal conneg signal) |
| 2 | **describedby followed?** | Did it `-i`/`-I`/`-v` the resource, find `rel="describedby"`, and GET `.meta`? (the Solid-native graph path) |
| 3 | **Default-GET body first?** | Did it start with a plain `GET` of the body? Then: did it RECOVER into conneg/describedby when prose lacked the answer, or hallucinate / give up / report "not found"? |
| 4 | **Got the right facts?** | Did ANSWER state a plausible `modified` time + a conformance shape/contract URL actually present in the graph? |
| 5 | **Reasoning (the why)** | From the trace: did it choose conneg deliberately ("this is RDF, request turtle") or stumble into it? Did the cue (arm b/c) change the *plan* or just the wording? |

## What the result means (per RQ-Conneg-1 §6/§10)

- **H0 = "no" (default-GET body, no recovery, can't answer)** → the whole conneg-by-profile
  edifice is on sand (reason #3); "select graph view via Accept" is also dead as a salience
  lever. Strongest possible simplification signal.
- **H0 = "only with cue"** (a fails, b/c succeed) → agents *can* conneg but won't *discover*
  it cold → the gap is instruction/grounding, not capability (informs RQ-Salience-1 tension #5).
- **H0 = "yes, even bare"** → conneg is a viable foundation → H2 (does conneg-by-profile add
  value over plain conneg) becomes the live question.

## Cross-cutting (same discipline as d114)
- Sonnet. Global `~/.claude/CLAUDE.md` loads (vault/style, no Pod content) — disclose.
- **Watch the `-v`/`-i` confound:** an agent that reflexively `-i`s every call will SEE the
  `describedby` + Link headers without "deciding" to conneg. Note each arm's actual flags;
  distinguish "connegged on purpose" from "saw headers because it dumps them anyway."
- Snapshot Pod state isn't needed (read-only probe, clean concept). `cleanup` = DELETE the
  planted `h0-conneg.md` after all arms.
