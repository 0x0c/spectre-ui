# Spectre UI

サーバードリブンUI (Server-Driven UI, SDUI) のためのクロスプラットフォームライブラリ。

サーバから配信された **UI定義ドキュメント (JSON)** を iOS / Android のネイティブSDKが解釈してレンダリングし、
ボタンタップなどの操作を宣言的な **アクション** として処理する。UI定義は Web の **WYSIWYGエディタ** から、
あらかじめ定義された **コンポーネントカタログ** の組み合わせで編集・公開できる。

現在のフェーズ: **クライアント実装**。設計ドキュメント一式に加えて、iOS / Android のランタイムとレンダラ、
および JSON をそのまま描画するサンプルアプリが入っている。エディタ (M2) と配信基盤 (M3) はまだ未着手。
実装状況の詳細は [docs/roadmap.md](docs/roadmap.md#実装状況-現時点) を参照。

## 動かす

```bash
# 適合性コーパス + ランタイムのテスト (Android SDK 不要)
cd clients/android && ./gradlew :spectre-core:test

# Android サンプルアプリ (要 Android SDK)
cd clients/android && ./gradlew :sample:installDebug

# iOS のランタイムテスト (要 Xcode)
cd clients/ios && swift test

# iOS サンプルアプリ (要 XcodeGen)
cd clients/ios/SampleApp && xcodegen generate && open SpectreSample.xcodeproj

# マニフェストからカタログを再生成 (差分が出ないことを CI で検証する)
node packages/codegen/generate.mjs --check
```

**ロードマップ項目一覧: https://0x0c.github.io/spectre-ui/**
状態とトピックで絞り込める1枚のリスト。項目の本文は `roadmaps/` にある。
設計ドキュメントは https://0x0c.github.io/spectre-ui/docs/ に MkDocs で置いている。

---

## ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| [docs/adr/](docs/adr/README-ja.md) | ADR（アーキテクチャ決定記録）。1決定1ディレクトリ、日英両方 |
| [roadmaps/](roadmaps/README-ja.md) | ロードマップ項目。1項目1ディレクトリ、日英両方 |
| [docs/tech-selection.md](docs/tech-selection.md) | 技術選定の索引。前提の制約とADRの一覧 |
| [docs/architecture.md](docs/architecture.md) | 全体アーキテクチャ、コンポーネント構成、データフロー |
| [docs/spec/schema.md](docs/spec/schema.md) | UI定義ドキュメントのスキーマ仕様 v0.1 |
| [docs/spec/components.md](docs/spec/components.md) | コンポーネントカタログ v0.1 とデザイントークン |
| [docs/spec/expression.md](docs/spec/expression.md) | 式言語 SpectreExpr とデータバインディング |
| [docs/spec/actions.md](docs/spec/actions.md) | アクション仕様とサーバ応答プロトコル |
| [docs/editor.md](docs/editor.md) | Web WYSIWYGエディタの設計 |
| [docs/compatibility.md](docs/compatibility.md) | バージョニング・前方互換・配信/ロールバック戦略 |
| [docs/roadmap.md](docs/roadmap.md) | マイルストーンの概観、見積もり、未決事項、リスク |

ADRとロードマップ項目は採番して1件1ディレクトリに置き、英語版 `X.md` と日本語版 `X-ja.md` を組で持つ。
採番と書式の規則は [docs/adr/README-ja.md](docs/adr/README-ja.md) と
[roadmaps/README-ja.md](roadmaps/README-ja.md) にある。執筆時の文章規範と手順は
[.agent-workflows/](.agent-workflows/README.md)（Claude Code 向けのアダプタは `.claude/skills/`）にある。

## 成果物 (設計サンプル)

| ファイル | 内容 |
| --- | --- |
| [spec/component-manifest.json](spec/component-manifest.json) | コンポーネントマニフェスト。全生成物の単一の情報源 |
| [spec/schema/document.schema.json](spec/schema/document.schema.json) | ドキュメント用 JSON Schema (マニフェストから生成される想定の手書きサンプル) |
| [examples/screens/product-detail.json](examples/screens/product-detail.json) | 商品詳細画面のUI定義サンプル |

---

## 設計の要点 (3行)

1. **コンポーネントマニフェストを単一の情報源**とし、JSON Schema / TypeScript型 / Swift型 / Kotlin型 / エディタのパレットとインスペクタをすべてそこから生成する。
2. **レンダラは各プラットフォームネイティブ** (SwiftUI / Jetpack Compose / React)。共有するのは「コード」ではなく「仕様 + 適合性テストコーパス」。
3. **前方互換性を最優先**。古いアプリバージョンが未知のコンポーネントを受け取っても壊れないよう、ケイパビリティネゴシエーションとノード単位のフォールバックを言語仕様に組み込む。

## リポジトリ構成 (実装フェーズの想定)

```
spectre-ui/
├── docs/adr/                   # ADR (1決定1ディレクトリ、日英両方)
├── roadmaps/                   # ロードマップ項目 (1項目1ディレクトリ、日英両方)
├── .agent-workflows/           # 共有のエージェント手順 (.claude/skills がこれを読む)
├── spec/                       # 仕様の単一の情報源
│   ├── component-manifest.json #   コンポーネント定義
│   ├── tokens.json             #   デザイントークン
│   ├── schema/                 #   生成された JSON Schema
│   └── conformance/            #   適合性テストコーパス (全ランタイム共通)
├── packages/                   # TypeScript モノレポ (pnpm workspace)
│   ├── manifest/               #   マニフェストのローダと検証
│   ├── codegen/                #   TS / Swift / Kotlin コード生成
│   ├── core/                   #   式評価・パッチ適用の TS 実装 (エディタ/サーバ共用)
│   ├── editor/                 #   React WYSIWYG エディタ
│   └── server/                 #   オーサリングAPI + 配信サービス (Fastify)
├── clients/
│   ├── ios/                    # Swift Package: SpectreUI
│   └── android/                # Gradle module: spectre-ui
└── examples/
```

---

## サイト

GitHub Actions から GitHub Pages へデプロイする。2つの成果物からなる。

| URL | 中身 | 作るもの |
| --- | --- | --- |
| `/` | ロードマップ項目一覧 | `scripts/build_roadmap_index.py` |
| `/docs/` | 設計ドキュメントとADR | MkDocs (Material) |

一覧はカテゴリ（トピック）ごとにまとめ、項目・カテゴリ・全体の進捗をバーで示す。
表示はカードとリストを切り替えられ、状態・カテゴリでの絞り込みと全文検索（ID・タイトル・要約・
カテゴリ・状態が対象、`/` で検索欄へ）がある。
生成元は各項目の `SU-METADATA`、冒頭の1段落、そして進捗チェックリストなので、
項目を追加してもインデックスを手で更新する必要はない。項目の本文はサイトには載せず、
リポジトリ上の Markdown へリンクする。

進捗の分母は各項目の**進捗チェックリスト**。未着手の項目はチェックリストが
「未着手」の箱1つだけなので、その場合に限り**詳細設計の分解数**を見込みとして使う。

```sh
pip install -r requirements-docs.txt

mkdocs build --strict                        # ドキュメント → site/docs/
python3 scripts/build_roadmap_index.py site  # 一覧 → site/index.html

mkdocs serve                                 # ドキュメントだけをローカルで確認
```
