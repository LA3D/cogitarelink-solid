---
type: concept
created: 2026-05-23T00:00:00Z
modified: 2026-05-23T00:00:00Z
maturity: draft
---

# Harness Engineering

Harness engineering is the practice of building evaluation infrastructure for agent systems. Extends [[agentic-engineering]]{.extends} into the measurement and observability domain.

A good harness gives engineers signal on what agents actually do — not just whether outputs pass assertions. Key affordances:

- **Trajectory capture** — every tool call, every dead-end, attributable to the layer of the substrate the agent was working at
- **Behavior judgment** — LLM-as-judge over trajectories, separate from output graders
- **Round-trip consistency tests** — paired creation and retrieval as a diagnostic axis (verifies [[compounding-knowledge]]{.related} directly)
- **Cost accounting** — tokens, tool calls, wall-clock
- **Cold-start subagent isolation** — fresh contexts, no leaked state from the driving session

The skill-creator harness pattern (with-skill vs without-skill spawned in parallel, output graders, eval-viewer for human review) is the foundation this project builds on. Phoenix observability via OTEL traces provides ground-truth tool-call instrumentation when self-logged trajectories are too thin.

Without harness engineering, [[agentic-engineering]]{.related} decisions stay opinion-driven. The harness is what converts intuitions about agent behavior into evidence about agent behavior.
