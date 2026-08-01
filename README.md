**English** · [日本語](README-ja.md)

# Spectre UI

Spectre UI is a cross-platform library for server-driven user interfaces (SDUI).

A server delivers a **user-interface definition document** in JavaScript Object Notation (JSON).
Native software development kits (SDKs) on iOS and Android render that document. A button tap
travels back as a declarative **action**. Authors edit the same document in a
what-you-see-is-what-you-get (WYSIWYG) editor on the web. The editor composes a screen out of a
predefined **component catalog**.

The repository is in its **design phase**: no implementation code exists yet. The documents here
record the technology selection and the specification.

**Roadmap index: https://0x0c.github.io/spectre-ui/**

One list, filtered by status and by topic. The item bodies live in `roadmaps/`. MkDocs serves the
design documents at https://0x0c.github.io/spectre-ui/docs/.

---

## Documents

| Document | Contents |
| --- | --- |
| [docs/adr/](docs/adr/README.md) | Architecture decision records (ADRs). One decision per directory, in both languages |
| [roadmaps/](roadmaps/README.md) | Roadmap items. One item per directory, in both languages |
| [docs/tech-selection.md](docs/tech-selection.md) | Index of the technology selection: the constraints assumed, and the decision records |
| [docs/architecture.md](docs/architecture.md) | Overall architecture, the components it divides into, and the data flow |
| [docs/spec/schema.md](docs/spec/schema.md) | Schema specification v0.1 for the user-interface definition document |
| [docs/spec/components.md](docs/spec/components.md) | Component catalog v0.1 and the design tokens |
| [docs/spec/expression.md](docs/spec/expression.md) | The SpectreExpr expression language and data binding |
| [docs/spec/actions.md](docs/spec/actions.md) | Action specification and the server response protocol |
| [docs/editor.md](docs/editor.md) | Design of the web WYSIWYG editor |
| [docs/compatibility.md](docs/compatibility.md) | Versioning, forward compatibility, and the delivery and rollback strategy |
| [docs/roadmap.md](docs/roadmap.md) | Milestone overview, estimates, open questions, and risks |

Architecture decision records and roadmap items carry a permanent number. Each one occupies a
directory holding the English `X.md` beside its Japanese mirror `X-ja.md`. The numbering and
formatting rules live in [docs/adr/README.md](docs/adr/README.md) and
[roadmaps/README.md](roadmaps/README.md). The prose norm and the drafting procedure live in
[.agent-workflows/](.agent-workflows/README.md). The adapters under `.claude/skills/` load that
norm for Claude Code.

English leads and the mirror follows it. The documents under `docs/` outside `docs/adr/` are the
exception, with no English version today.

## Deliverables (design samples)

| File | Contents |
| --- | --- |
| [spec/component-manifest.json](spec/component-manifest.json) | Component manifest, the single source of truth behind everything generated |
| [spec/schema/document.schema.json](spec/schema/document.schema.json) | JSON Schema for the document (a hand-written sample of what the manifest will generate) |
| [examples/screens/product-detail.json](examples/screens/product-detail.json) | Sample user-interface definition for a product detail screen |

---

## The design in three points

1. **The component manifest is the single source of truth**. From that one file we generate the
   JSON Schema and the TypeScript, Swift, and Kotlin types. The editor's palette and inspector come
   from the same file.
2. **Each renderer is native to its platform** (SwiftUI, Jetpack Compose, and React). The platforms
   share a specification and a conformance test corpus rather than code.
3. **Forward compatibility comes first**. The language specification itself carries capability
   negotiation and per-node fallback. An older application version survives a component it does not
   recognize.

## Repository layout (planned for the implementation phase)

```
spectre-ui/
├── docs/adr/                   # Architecture decision records (one per directory, English and Japanese)
├── roadmaps/                   # Roadmap items (one per directory, English and Japanese)
├── .agent-workflows/           # Shared agent procedures (.claude/skills reads these)
├── spec/                       # Single source of truth for the specification
│   ├── component-manifest.json #   Component definitions
│   ├── tokens.json             #   Design tokens
│   ├── schema/                 #   Generated JSON Schema
│   └── conformance/            #   Conformance test corpus (shared by every runtime)
├── packages/                   # TypeScript monorepo (pnpm workspace)
│   ├── manifest/               #   Manifest loader and validation
│   ├── codegen/                #   TypeScript, Swift, and Kotlin code generation
│   ├── core/                   #   TypeScript expression evaluation and patch application (editor and server)
│   ├── editor/                 #   React WYSIWYG editor
│   └── server/                 #   Authoring API and delivery service (Fastify)
├── clients/
│   ├── ios/                    # Swift package: SpectreUI
│   └── android/                # Gradle module: spectre-ui
└── examples/
```

---

## The site

GitHub Actions deploys the site to GitHub Pages. The site is two artifacts.

| URL | Contents | Built by |
| --- | --- | --- |
| `/` | The roadmap index | `scripts/build_roadmap_index.py` |
| `/docs/` | The design documents and the decision records | MkDocs (Material) |

The index groups the items by category (topic). Bars carry the progress of an item, of a category,
and of the roadmap as a whole. A toggle switches between cards and a list. Filters cover status and
category. The full-text search reaches the ID and title of an item, plus its summary, category, and
status. Pressing `/` moves the cursor to the search box. The index reads each item's `SU-METADATA`,
opening paragraph, and progress checklist. Adding an item needs no hand edit of the index. The item
bodies stay off the site, which links to the Markdown in the repository instead.

The denominator of the progress bar is the item's **progress checklist**. An item that has not
started carries a single "Not started" box. In that case alone, the number of **Detailed design**
steps stands in as the estimate.

```sh
pip install -r requirements-docs.txt

mkdocs build --strict                        # the documents  -> site/docs/
python3 scripts/build_roadmap_index.py site  # the index      -> site/index.html

mkdocs serve                                 # preview the documents alone
```
