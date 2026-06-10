# skill-nav — SP1 gate (skill-delivered disposition vs prompt-injected gold)

Tests the spec §12 row "skill-delivered disposition reproduces prompt-injected gold."
Same de-confounded E5 trap (`../salience-e5/setup/plant_e5.sh`); NEUTRAL prompt (no
disposition preamble — H1 conditions); the only variable is the `pod-navigate` skill
copied into the workdir's `.claude/skills/`.

Run from a COPY outside any repo (no CLAUDE.md leakage):

    cp -R evals/skill-nav evals/salience-e5 ~/dev/probes/
    export SOLID_AGENT_SKILLS=~/dev/git/LA3D/agents/solid-agent-skills
    cd ~/dev/probes/salience-e5 && ./setup/plant_e5.sh
    cd ~/dev/probes/skill-nav
    ./run_skillnav.sh bare  run1            # baseline sanity (expect miss, per H1 4:1)
    ./run_skillnav.sh skill run1            # n=3: run1 run2 run3
    python3 audit.py runs/*

Two measurements per skill run (both matter — consumption is the open channel):
1. **Trigger**: did the agent invoke pod-navigate at all? (`skill invoked` in audit)
2. **Catch**: contestation surfaced + ledger reached (the E5 gold criteria)

GATE: skill arm 3/3 catch. If trigger fails (skill never invoked), that IS the
finding — record it, revise the skill `description:`, and re-run as run-N+1 with the
revision documented in the report. Do not silently tune mid-eval.

`runs/` is gitignored (machine-local artifacts). Pod prerequisites: `make reset`
recommended before planting; trap concepts are disposable (cleared on next reset).
