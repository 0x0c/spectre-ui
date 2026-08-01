---
name: implement
model: opus
description: Ship one roadmap (SU) item's product code, from an accepted design to a green, reviewed change. Use when a proposal is ready to be built, never to author or revise the proposal itself.
---

# Claude adapter

Read `.agent-workflows/implement/workflow.md` completely, then follow it — every guardrail in it
is load-bearing, not optional. Use the repository's designated branch for the session.

Run the self-review loop (workflow step 8) to convergence: a fresh pass that finds nothing, not a
fixed number of passes. Prefer spawning a fresh subagent for that pass over re-reading your own
diff in the same context — it has no memory of why you wrote the code that way, so it reviews it
rather than your reasoning for it. Do the same for the correctness/simplification/security lenses
in that step: run them as independent passes rather than one pass wearing three hats.

Open a pull request only when the user asks for one. If the session's existing PR-watching
behavior is available and a pull request exists for this change, keep it green under that behavior
rather than a separate loop here.
