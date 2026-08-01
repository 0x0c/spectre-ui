# Shared agent workflows

This directory is the source of truth for procedures shared by coding agents. Each workflow defines
one task sequence with its safety constraints and completion criteria. The runtime adapters under
[`.claude/skills`](../.claude/skills/) expose each workflow to Claude Code.

Agent runtimes do not discover `.agent-workflows` directly. A runtime adapter must load the entire
workflow before applying its runtime-specific tool mapping.

The structure and several of these workflows are adapted from
[bajutsu](https://github.com/bajutsu-e2e/bajutsu), which is where the split between shared workflows
and per-runtime adapters comes from.

## Directory structure

```text
.agent-workflows/
└── <name>/
    ├── workflow.md
    └── <portable resources>
```

`workflow.md` is the authoritative procedure. A workflow may keep portable scripts, references,
templates, or validation resources beside it. For example, `document-writing/textlint` holds the
shared prose validation runtime.

## The workflows

| Workflow | Purpose |
| --- | --- |
| [`document-writing`](document-writing/workflow.md) | The language-agnostic prose norm for every document here, plus the textlint runtime |
| [`english-document-writing`](english-document-writing/workflow.md) | The English mechanics layer beneath `document-writing` |
| [`japanese-document-writing`](japanese-document-writing/workflow.md) | The Japanese prose layer beneath `document-writing` |
| [`roadmap-item`](roadmap-item/workflow.md) | Author or revise a numbered bilingual roadmap item |
| [`adr`](adr/workflow.md) | Author or supersede a numbered bilingual architecture decision record |
| [`roadmap-filter`](roadmap-filter/workflow.md) | Survey roadmap items by status, read-only |
| [`implement`](implement/workflow.md) | Ship a roadmap item's product code, from accepted design to a reviewed, green change |

Spectre UI's client-implementation phase is underway: real product code lives under `clients/`,
`packages/`, and `spec/`, alongside the specification, ADRs, and roadmap. `implement` is the first
of the upstream repository's implementation-side workflows to be ported, adapted to this
repository's per-area checks rather than the single unified test gate the upstream repository
assumes. Port the remaining ones — the pull-request follow-up loop chief among them — as the parts
of the repository they depend on (a tracking-issue convention, a unified gate) come to exist.

## What belongs here

Store content here when every supported agent should follow the same rule:

- task steps and decision points;
- safety constraints and escalation conditions;
- required inputs, outputs, and verification;
- repository commands that do not depend on an agent runtime; and
- scripts, references, and templates used by the shared procedure.

Keep these runtime-specific details out of shared workflows:

- model choices and tool names;
- slash commands, hooks, and plugins; and
- interface metadata.

Runtime-specific details belong in the corresponding adapter.

When changing behavior, update `workflow.md` first. Update an adapter only when the shared change
needs a different runtime mapping or selection hint. Following this order keeps the procedures from
drifting apart as more runtimes are added.
