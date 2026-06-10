# generalization — does the disclosure discipline generalize to OPERATION-shaped apps?

The SP2-gating probe (spec §3/§11/§12). All prior behavioral evidence is navigation-shaped
(wiki E5/E7 traps, the idxview index). The addressbook is **query-shaped**: the right move is
not "browse an index," it is "discover the declared affordance and run it." This probe tests
whether ONE general skill (`pod-navigate`) routes a cold agent to an operation-shaped app's
access pattern — or whether each app needs its own thin skill.

**Task:** "Which person has ORCID `https://orcid.org/0000-0001-0000-0005`?" Six synthetic
contacts are seeded into `/vault/contacts/Person/` (ORCID via `owl:sameAs`); the
name↔ORCID mapping exists ONLY in the Pod. The `contact-find-by-orcid` affordance
(`SELECT ?person WHERE { ?person owl:sameAs $orcid }`) answers it; brute-force = GET all six.

**Arms (7 runs):**
- `bare-curl` n=1 — no skill, curl only (baseline: brute-force? wrong store?)
- `skill-curl` n=3 — pod-navigate, curl only (does the skill route + can curl reach the pattern?)
- `skill-cli` n=3 — pod-navigate + the `solid-pod` CLI (does it route + execute via the CLI?)

**Note — parameterized affordance.** `contact-find-by-orcid` is `$orcid`-parameterized, NOT
`%RESOURCE%`-scoped, so `solid-pod invoke` (resource-scoped) will NOT run it. The agent must
discover the affordance and run its SPARQL via `solid-pod sparql` (CLI arm) or emulate via curl
(curl arm). Whether the agent adapts is part of what's measured (a CLI-coverage finding for SP2).

Run from a COPY outside any repo (no CLAUDE.md leakage):

    cp -R evals/generalization ~/dev/probes/
    export SOLID_AGENT_SKILLS=~/dev/git/LA3D/agents/solid-agent-skills
    cd ~/dev/probes/generalization && ./setup/plant_contacts.sh
    ./run_gen.sh bare-curl  run1
    ./run_gen.sh skill-curl run1   # n=3
    ./run_gen.sh skill-cli  run1   # n=3
    python3 audit.py runs/*

**Verdict reads (per the audit signals + the ANSWER sections):**
- skill-curl + skill-cli both route to `contact-find-by-orcid` and answer correctly →
  **one general skill generalizes** (SP2 proceeds with one skill).
- skill arms flail (brute-force / wrong store / wrong answer) → **per-app thin skills needed.**
- curl flails but CLI succeeds → **the CLI/MCP tier is load-bearing for operation-shaped apps.**

`runs/` is gitignored. Seeded contacts are disposable (cleared on next `make reset`).
