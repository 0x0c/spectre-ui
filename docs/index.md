**English** · [日本語](index-ja.md)

# Spectre UI

A cross-platform library for server-driven user interfaces (SDUI, Server-Driven UI).

Native SDKs on iOS and Android interpret and render the **UI definition document (JSON)** a server
delivers. They treat a tap on a button, and every other interaction, as a declarative **action**.
Authors edit and publish the same UI definition from a web **WYSIWYG editor**. A screen is a
composition of a predefined **component catalog**.

!!! info "Current phase: client implementation"
    Product code lives under `clients/`, `packages/`, and `spec/`. It sits beside the design
    documents, the architecture decision records (ADRs), and the roadmap.
    [The roadmap and its open questions](roadmap.md) records what each area has today.
    [The roadmap index](../) lists each individual work proposal.
    [The editor](https://0x0c.github.io/spectre-ui/editor/) runs in a browser, with no server to set up.

## The design in three points

1. **The component manifest is the single source of truth.** From it, we generate the JSON Schema;
   the TypeScript, Swift, and Kotlin types; and the editor's palette and inspector.
2. **Each renderer is native to its platform** (SwiftUI, Jetpack Compose, and React). What the
   platforms share is not code but a specification plus a conformance test corpus.
3. **Forward compatibility comes first.** The language specification itself carries capability
   negotiation and per-node fallback. An older application version survives a component it does not
   recognize.

## Where to start

<div class="grid cards" markdown>

- **Learn how a decision came to be**

    [Tech selection](tech-selection.md) is the index; each individual decision lives in the
    [ADR list](adr/README.md). Each record reads context, options considered, decision, rationale,
    consequences, and revisit triggers, in that order.

- **Check the specification**

    [Schema](spec/schema.md) / [Components](spec/components.md) /
    [Expression language](spec/expression.md) / [Actions](spec/actions.md).

- **See what to build and when**

    [The roadmap and its open questions](roadmap.md) gives the overview; the
    [roadmap index](../) gives each individual proposal.

- **The single point that matters most**

    [Compatibility and delivery strategy](compatibility.md). When SDUI fails, the cause almost
    always traces back here.

- **Compose a screen right now**

    [Open the editor](https://0x0c.github.io/spectre-ui/editor/). The published build runs in the
    browser alone. Drag components onto the canvas, edit actions, and export the document as JSON.

</div>

## Documents

| Document | Contents |
| --- | --- |
| [Tech selection](tech-selection.md) | The constraints assumed as a premise, and the index of decisions |
| [ADR list](adr/README.md) | Technical decisions, one record per decision (English and Japanese) |
| [Architecture](architecture.md) | Overall structure, the components it divides into, and the data flow |
| [Schema specification v0.1](spec/schema.md) | The schema of the UI definition document |
| [Component catalog v0.1](spec/components.md) | The catalog and the design tokens |
| [Expression language SpectreExpr](spec/expression.md) | Expressions and data binding |
| [Action specification](spec/actions.md) | Actions and the server response protocol |
| [Editor design](editor.md) | The web WYSIWYG editor |
| [The editor itself](https://0x0c.github.io/spectre-ui/editor/) | The published build, running in the browser |
| [Compatibility and delivery strategy](compatibility.md) | Versioning, forward compatibility, delivery, and rollback |
| [The roadmap and its open questions](roadmap.md) | Milestones, estimates, open questions, and risks |
| [Roadmap index](../) | The list of individual work proposals; each body lives in the repository |

The four specification documents above remain Japanese until milestone M0 freezes the specification
([SU-0011](../roadmaps/SU-0011-english-first-documentation/SU-0011-english-first-documentation.md)).

## Deliverables (design samples)

Files in the repository.

| File | Contents |
| --- | --- |
| [spec/component-manifest.json](../spec/component-manifest.json) | The component manifest, the single source of truth behind every generated artifact |
| [spec/schema/document.schema.json](../spec/schema/document.schema.json) | JSON Schema for the document (a hand-written sample of what the manifest will generate) |
| [examples/screens/product-detail.json](../examples/screens/product-detail.json) | A sample UI definition for a product detail screen |

## Repository layout (planned for the implementation phase)

```
spectre-ui/
├── docs/                       # Design documents
│   └── adr/                    #   Architecture decision records (one per directory, English and Japanese)
├── roadmaps/                   # Roadmap items (one per directory, English and Japanese)
├── spec/                       # Single source of truth for the specification
│   ├── component-manifest.json #   Component definitions
│   ├── tokens.json             #   Design tokens
│   ├── schema/                 #   Generated JSON Schema
│   └── conformance/            #   Conformance test corpus (shared by every runtime)
├── packages/                   # TypeScript monorepo (pnpm workspace)
│   ├── manifest/               #   Manifest loader and validation
│   ├── codegen/                #   TypeScript, Swift, and Kotlin code generation
│   ├── core/                   #   TypeScript expression evaluation and patch application (shared by the editor and the server)
│   ├── editor/                 #   React WYSIWYG editor
│   └── server/                 #   Authoring API and delivery service (Fastify)
├── clients/
│   ├── ios/                    # Swift package: SpectreUI
│   └── android/                # Gradle module: spectre-ui
└── examples/
```
