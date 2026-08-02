[English](README.md) · **日本語**

# Spectre UI

Spectre UI は、サーバードリブンUI（Server-Driven UI、SDUI）のためのクロスプラットフォームライブラリです。

サーバは、JSON（JavaScript Object Notation）で書かれた**UI定義ドキュメント**を配信します。iOS と
Android のネイティブSDK（Software Development Kit、ソフトウェア開発キット）は、そのドキュメントを
解釈して画面を描画します。ボタンのタップは、宣言的な**アクション**として処理します。同じドキュメント
は、Web の**WYSIWYG（What You See Is What You Get、見たままが得られる）エディタ**から編集して公開
できます。画面は、あらかじめ定義された**コンポーネントカタログ**の組み合わせで作ります。

本リポジトリは**クライアント実装フェーズ**にあります。技術選定と仕様を記録したドキュメントに加えて、
iOS と Android のランタイムと、プラットフォームごとのレンダラを置いています。オーサリング・配信API
（マイルストーンM3、`packages/server`）もここにあります。サーバを立てずに UI定義ドキュメントを描画する
サンプルアプリもあります。エディタ（マイルストーンM2）は未着手です。各部分が何を含み、どう検証している
かは [docs/roadmap.md](docs/roadmap-ja.md) に記録しています。

## デモ

`./scripts/demo.sh <target>` は、動くデモを1つ起動します。`editor`（WYSIWYGエディタ。Node.js と pnpm
だけで動きます）、`server`（オーサリング・配信API。`curl` で一連の流れをたどれます）、`ios`、
`android` のいずれかを指定してください。それぞれが何を見せるか、何が必要か、うまくいかないときの対処
法は [docs/demo.md](docs/demo-ja.md) にまとめています。

## 動かす

適合性コーパスとランタイムのテストは Android SDK を必要としないので、チェックアウトしただけの状態で
ライブラリのロジックを検証できます。それ以外のコマンドは、各プラットフォームのツールチェインを必要と
します。

```bash
# 適合性コーパスとランタイムのテスト（Android SDK 不要）
cd clients/android && ./gradlew :spectre-core:test

# 生成されたカタログがコンポーネントマニフェストと一致しているか（node が必要）
node packages/codegen/generate.mjs --check

# Android サンプルアプリ（Android SDK が必要）
cd clients/android && ./gradlew :sample:installDebug

# iOS のランタイムテスト（Xcode が必要）
cd clients/ios && swift test

# iOS サンプルアプリ（XcodeGen が必要）
cd clients/ios/SampleApp && xcodegen generate && open SpectreSample.xcodeproj

# iOS APNsサンプルアプリ（XcodeGen が必要）
cd clients/ios/APNsSample && xcodegen generate && open SpectreAPNsSample.xcodeproj

# TypeScript版 SpectreExpr。Kotlin/Swift と同じ適合性コーパスで検証する（pnpm が必要）
pnpm install
pnpm --filter @spectre-ui/core run typecheck && pnpm --filter @spectre-ui/core run test

# オーサリング・配信API: 型検査と統合テスト（pnpm と PostgreSQL が必要）
pnpm --filter @spectre-ui/manifest run typecheck && pnpm --filter @spectre-ui/manifest run test
cd packages/server && pnpm run typecheck && TEST_DATABASE_URL=<url> pnpm run test
```

CI（Continuous Integration、継続的インテグレーション）は、上記のすべてのコマンドをプルリクエストごと
に実行します。ジョブの定義は [.github/workflows/ci.yml](.github/workflows/ci.yml) にあります。

**ロードマップ項目一覧: https://0x0c.github.io/spectre-ui/**

状態とトピックで絞り込める1枚のリストです。項目の本文は `roadmaps/` にあります。設計ドキュメントは
MkDocs で https://0x0c.github.io/spectre-ui/docs/ に置いています。

---

## ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| [docs/adr/](docs/adr/README-ja.md) | ADR（アーキテクチャ決定記録）。1決定1ディレクトリ、英語と日本語の両方 |
| [roadmaps/](roadmaps/README-ja.md) | ロードマップ項目。1項目1ディレクトリ、英語と日本語の両方 |
| [docs/tech-selection.md](docs/tech-selection-ja.md) | 技術選定の索引。前提とする制約と、ADRの一覧 |
| [docs/architecture.md](docs/architecture-ja.md) | 全体アーキテクチャ、コンポーネント構成、データフロー |
| [docs/spec/schema.md](docs/spec/schema.md) | UI定義ドキュメントのスキーマ仕様 v0.1 |
| [docs/spec/components.md](docs/spec/components.md) | コンポーネントカタログ v0.1 とデザイントークン |
| [docs/spec/expression.md](docs/spec/expression.md) | 式言語 SpectreExpr とデータバインディング |
| [docs/spec/actions.md](docs/spec/actions.md) | アクション仕様とサーバ応答プロトコル |
| [docs/editor.md](docs/editor-ja.md) | Web WYSIWYGエディタの設計 |
| [docs/compatibility.md](docs/compatibility-ja.md) | バージョニング、前方互換、配信とロールバックの戦略 |
| [docs/roadmap.md](docs/roadmap-ja.md) | マイルストーンの概観、見積もり、未決事項、リスク |
| [docs/demo.md](docs/demo-ja.md) | `scripts/demo.sh` の4つの対象。それぞれが何を見せるか、何が必要か、対処法 |

ADRとロードマップ項目は永続的な番号を持ち、1件につき1ディレクトリを占めます。各ディレクトリには、
英語版 `X.md` と日本語版 `X-ja.md` を組で置きます。採番と書式の規則は
[docs/adr/README-ja.md](docs/adr/README-ja.md) と [roadmaps/README-ja.md](roadmaps/README-ja.md) に
あります。執筆時の文章規範と手順は [.agent-workflows/](.agent-workflows/README.md) にあり、
`.claude/skills/` のアダプタがそれを Claude Code へ読み込みます。

英語が主、日本語が従です。例外は `docs/spec/` 以下の仕様4文書で、マイルストーンM0が仕様を凍結する
まで日本語だけが残ります（[SU-0011](roadmaps/SU-0011-english-first-documentation/SU-0011-english-first-documentation-ja.md)）。

## 成果物（設計サンプル）

| ファイル | 内容 |
| --- | --- |
| [spec/component-manifest.json](spec/component-manifest.json) | コンポーネントマニフェスト。生成物すべての単一の情報源 |
| [spec/schema/document.schema.json](spec/schema/document.schema.json) | ドキュメント用 JSON Schema（マニフェストから生成する想定の手書きサンプル） |
| [examples/screens/product-detail.json](examples/screens/product-detail.json) | 商品詳細画面のUI定義サンプル |

---

## 設計の要点

1. **コンポーネントマニフェストを単一の情報源とします。** JSON Schema と、TypeScript型、Swift型、
   Kotlin型は、その1ファイルから生成します。エディタのパレットとインスペクタも同じです。
2. **レンダラは各プラットフォームのネイティブ実装です**（SwiftUI、Jetpack Compose、React）。
   プラットフォーム間で共有するのはコードではなく、仕様と適合性テストコーパスです。
3. **前方互換性を最優先します。** ケイパビリティネゴシエーションとノード単位のフォールバックは、
   言語仕様そのものに組み込みます。古いアプリバージョンが未知のコンポーネントを受け取っても、
   壊れません。

## リポジトリ構成（目指す形。`packages/editor` はまだ存在しません）

```
spectre-ui/
├── docs/adr/                   # ADR（1決定1ディレクトリ、英語と日本語の両方）
├── roadmaps/                   # ロードマップ項目（1項目1ディレクトリ、英語と日本語の両方）
├── .agent-workflows/           # 共有のエージェント手順（.claude/skills がこれを読む）
├── spec/                       # 仕様の単一の情報源
│   ├── component-manifest.json #   コンポーネント定義
│   ├── tokens.json             #   デザイントークン
│   ├── schema/                 #   生成された JSON Schema
│   └── conformance/            #   適合性テストコーパス（全ランタイム共通）
├── packages/                   # TypeScript モノレポ（pnpm workspace）
│   ├── manifest/               #   マニフェストのローダと検証
│   ├── codegen/                #   TypeScript、Swift、Kotlin のコード生成
│   ├── core/                   #   TypeScript版 SpectreExpr。3実装目のパーサ
│   ├── editor/                 #   React WYSIWYG エディタ
│   └── server/                 #   オーサリングAPI と配信サービス（Fastify）
├── clients/
│   ├── ios/                    # Swift パッケージ: SpectreUI
│   └── android/                # Gradle モジュール: spectre-ui
└── examples/
```

---

## サイト

サイトは GitHub Actions から GitHub Pages へデプロイします。成果物は2つです。

| URL | 中身 | 作るもの |
| --- | --- | --- |
| `/` | ロードマップ項目一覧 | `scripts/build_roadmap_index.py` |
| `/docs/` | 設計ドキュメントとADR | MkDocs（Material） |

一覧はカテゴリ（トピック）ごとに項目をまとめます。項目、カテゴリ、ロードマップ全体の進捗は、それぞれ
バーで示します。表示はカードとリストを切り替えられます。絞り込みは状態とカテゴリで行い、全文検索は
ID、タイトル、要約、カテゴリ、状態を対象とします（`/` で検索欄へ移ります）。一覧の生成元は、各項目の
`SU-METADATA`、冒頭の1段落、進捗チェックリストです。そのため、項目を追加しても一覧を手で更新する
必要はありません。項目の本文はサイトには載せず、リポジトリ上の Markdown へリンクします。

進捗バーの分母は、その項目の**進捗チェックリスト**です。未着手の項目はチェックリストが「未着手」の
箱1つだけなので、その場合に限り**詳細設計**の分解数を見込みとして使います。

```sh
pip install -r requirements-docs.txt

mkdocs build --strict                        # ドキュメント → site/docs/
python3 scripts/build_roadmap_index.py site  # 一覧 → site/index.html

mkdocs serve                                 # ドキュメントだけをローカルで確認
```
