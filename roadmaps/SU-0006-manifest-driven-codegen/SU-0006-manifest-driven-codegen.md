**English** · [日本語](SU-0006-manifest-driven-codegen-ja.md)

# SU-0006 — Manifest-driven code generation

<!-- SU-METADATA -->
| Field | Value |
|---|---|
| Proposal | [SU-0006](SU-0006-manifest-driven-codegen.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **In progress** |
| Topic | Tooling |
| Related | [SU-0001](../SU-0001-m0-specification-freeze/SU-0001-m0-specification-freeze.md), [SU-0003](../SU-0003-m2-wysiwyg-editor/SU-0003-m2-wysiwyg-editor.md), [SU-0007](../SU-0007-conformance-corpus/SU-0007-conformance-corpus.md) |
<!-- /SU-METADATA -->

## Introduction

This item builds the generator that turns `spec/component-manifest.json` into everything derived
from it: the JSON Schema used for validation, the TypeScript types the editor and server consume,
the Swift and Kotlin types the client software development kits (SDKs) consume, and the component
documentation. The editor's palette and property inspector are not generated as files; they read the
manifest at run time.

## Motivation

One component definition otherwise appears in six places at once — the schema, two client type sets,
the palette, the inspector, and the documentation — and hand-maintained copies drift apart as soon
as one of them changes.

Generation converts that drift from something reviewers must catch into something that cannot occur.
It also removes the per-component cost in the editor: because the inspector is rendered from
manifest metadata at run time, **adding a component requires no editor code**, which is what keeps
the catalog cheap to grow.

## Detailed design

1. **The meta-schema for the manifest**, defining what a component entry may declare: its
   properties and their types, permitted children, defaults, and the editor metadata (category,
   icon, inspector widget kind).
2. **The manifest loader and validator**, in `packages/manifest`, which both the generator and the
   server use.
3. **The generator** in `packages/codegen`, emitting JSON Schema, TypeScript, Swift `Codable` types,
   and Kotlin `kotlinx.serialization` types from one manifest.
4. **Documentation generation** for the component catalog page.
5. **The regeneration check in continuous integration**, which regenerates every artifact and fails
   when the result differs from what is committed.

Generated artifacts are committed to the repository so that iOS and Android developers can build
without a Node toolchain.

## Alternatives considered

- **Write the definitions in TypeScript and generate the other languages from those types.**
  Rejected in
  [ADR-0002](../../docs/adr/ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source.md):
  the editor metadata cannot be expressed in a type system, so it would have to be maintained
  separately — the original problem under a new name.
- **Generate at build time instead of committing the output.** Rejected: it puts a Node toolchain on
  the critical path of every client build, which is a daily cost paid by the people least served by
  it.

## Progress

> Keep this current as work proceeds. The checklist mirrors the breakdown in *Detailed design*;
> the log records what changed and when, oldest first.

- [ ] The meta-schema for the manifest
- [ ] The manifest loader and validator, in `packages/manifest`
- [x] The generator, `packages/codegen`: Swift and Kotlin types
- [x] The generator: TypeScript types
- [ ] The generator: JSON Schema
- [ ] Documentation generation for the component catalog page
- [x] The regeneration check in continuous integration

**Log**

- This repository entered its client-implementation phase with the generator already in place.
- The generator was already emitting Swift and Kotlin types.
- This item's `Status` field never caught up to that work.
- This change adds the missing TypeScript output.
- `packages/manifest` now holds `generated.ts`.
- It covers every component's props, the token types, the node and document shapes.
- It covers the resource limits too.
- CI now type-checks that output, alongside the existing regeneration-drift check.
- `packages/manifest` today holds the generated types alone.
- The loader-and-validator module the Detailed design calls for still doesn't exist.
- The JSON Schema output, the meta-schema, and documentation generation stay open too.
- This item stays `In progress` until those land.

## References

- [ADR-0002 — The component manifest as the single source of truth](../../docs/adr/ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source.md) — the decision this item implements.
- [`spec/component-manifest.json`](../../spec/component-manifest.json) — the manifest itself.
- [`spec/schema/document.schema.json`](../../spec/schema/document.schema.json) — a hand-written sample of what the generator will emit.
- [SU-0001 — M0, freeze the specification](../SU-0001-m0-specification-freeze/SU-0001-m0-specification-freeze.md) — the milestone this generator has to be working by.
