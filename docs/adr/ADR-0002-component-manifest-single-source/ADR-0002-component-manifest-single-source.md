**English** · [日本語](ADR-0002-component-manifest-single-source-ja.md)

# ADR-0002 — The component manifest as the single source of truth

<!-- ADR-METADATA -->
| Field | Value |
|---|---|
| Record | [ADR-0002](ADR-0002-component-manifest-single-source.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **Accepted** |
| Date | 2026-07-31 |
| Topic | Specification |
| Related | [ADR-0001](../ADR-0001-client-rendering-strategy/ADR-0001-client-rendering-strategy.md), [ADR-0003](../ADR-0003-ui-document-format/ADR-0003-ui-document-format.md), [ADR-0005](../ADR-0005-editor-stack/ADR-0005-editor-stack.md), [SU-0006](../../../roadmaps/SU-0006-manifest-driven-codegen/SU-0006-manifest-driven-codegen.md) |
<!-- /ADR-METADATA -->

## Context

The same component definition surfaces in six places: the JSON Schema that validates a document,
the iOS types, the Android types, the editor's palette, the editor's property inspector, and the
documentation. Kept by hand, six copies of one definition drift — not as a risk but as a certainty,
because a component gains a property in one place and the other five are updated later or not at
all.

## Options considered

- **A. Hand-write each place and hold the copies together through review.**
- **B. Write the type definitions in one language, TypeScript for instance, and generate the rest
  from those.**
- **C. Make a language-neutral declarative manifest, expressed in JSON, the source of truth, and
  generate everything from it.**

## Decision

We adopt **option C**. [`spec/component-manifest.json`](../../../spec/component-manifest.json) is
the source of truth, and the following are generated from it:

```
spec/component-manifest.json
   ├─→ spec/schema/document.schema.json   (validation on the server and in the editor)
   ├─→ packages/manifest/src/types.ts     (types for the editor and the server)
   ├─→ clients/ios/.../Generated/*.swift  (Codable types and enumerations)
   ├─→ clients/android/.../generated/*.kt (kotlinx.serialization types and enumerations)
   ├─→ the editor's palette and property inspector (which read the manifest at run time)
   └─→ docs/spec/components.md
```

Generated artifacts are committed to the repository, and continuous integration verifies that
regenerating them produces no diff.

## Rationale

The manifest has to carry more than type information. It also carries editor metadata: the
category a component appears under, its icon, the widget kind its inspector field uses, which
children it accepts, and the default value of each property. A TypeScript type system cannot
express that, so option B would leave the metadata to be maintained separately — which is the
original problem with one of the six copies renamed.

Generating the inspector form from the manifest at run time is what pays off most in daily
operation: **adding a component requires no editor code at all**. The palette entry, the inspector
fields, and the validation all follow from the manifest entry.

Generation stops at types and decoders. The renderer itself stays hand-written, because a generator
expressive enough to emit rendering code would have to model layout, animation, and accessibility —
at which point the generator becomes the harder thing to maintain.

## Consequences

The manifest's own schema — the meta-schema — becomes something to design and maintain, and it is
the one artifact with no generator above it.

Committing generated code is a deliberate trade. It lets iOS and Android developers build without a
Node toolchain, at the cost of a regeneration check in continuous integration and a slightly noisier
diff on every manifest change. We take that trade: the toolchain-free build matters more to the
people who work in the client repositories every day.

## Revisit triggers

We reconsider committing generated artifacts if the regeneration check becomes a routine source of
failed builds, or if the generated tree grows large enough that its diffs obscure hand-written
changes under review.

## References

- [ADR-0001 — Client rendering strategy](../ADR-0001-client-rendering-strategy/ADR-0001-client-rendering-strategy.md) — the two-implementation decision this generation makes affordable.
- [ADR-0003 — The wire format of a user-interface definition](../ADR-0003-ui-document-format/ADR-0003-ui-document-format.md) — the JSON Schema generated here validates that format.
- [ADR-0005 — The WYSIWYG editor's technology stack](../ADR-0005-editor-stack/ADR-0005-editor-stack.md) — the editor that reads the manifest at run time.
- [SU-0006 — Manifest-driven code generation](../../../roadmaps/SU-0006-manifest-driven-codegen/SU-0006-manifest-driven-codegen.md) — the work that builds the generator.
- [`docs/spec/components.md`](../../spec/components.md) — the component catalog this manifest describes.
