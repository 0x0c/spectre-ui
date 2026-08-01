[English](README.md) · **日本語**

# Spectre UI ロードマップ

このディレクトリは Spectre UI のロードマップです。1つの項目が1つのディレクトリに対応し、英語の
ドキュメントと日本語版を組で持ちます。ロードマップ項目は Swift Evolution でいう提案（proposal）に
あたり、着手前に書かれ、作業の進行に合わせて更新され続ける、自己完結した主張です。Spectre UI は、
サーバードリブンUI（Server-Driven UI、SDUI）のためのクロスプラットフォームライブラリです。サーバが
配信したUI定義ドキュメントを、iOS と Android のネイティブSDKが解釈して描画します。

ここにある項目は現時点ですべて `Proposal` ですが、この値はコードより遅れることがあります。
このリポジトリはクライアント実装フェーズにあり、`clients/`、`packages/`、`spec/` 以下には、
`Status` がまだ追いついていない項目の一部について、すでにコードが存在します。各領域で実際に
何が実装済みかは [`docs/roadmap.md`](../docs/roadmap.md) を参照してください。

## 項目一覧

| ID | 項目 | トピック |
| --- | --- | --- |
| [SU-0001](SU-0001-m0-specification-freeze/SU-0001-m0-specification-freeze-ja.md) | M0 — 仕様の凍結 | 仕様 |
| [SU-0002](SU-0002-m1-client-sdks/SU-0002-m1-client-sdks-ja.md) | M1 — iOS / Android のクライアントSDK | クライアントSDK |
| [SU-0003](SU-0003-m2-wysiwyg-editor/SU-0003-m2-wysiwyg-editor-ja.md) | M2 — WYSIWYGエディタ | エディタ |
| [SU-0004](SU-0004-m3-delivery-platform/SU-0004-m3-delivery-platform-ja.md) | M3 — オーサリングと配信の基盤 | 配信 |
| [SU-0005](SU-0005-m4-operational-maturity/SU-0005-m4-operational-maturity-ja.md) | M4 — 運用の成熟 | 運用 |
| [SU-0006](SU-0006-manifest-driven-codegen/SU-0006-manifest-driven-codegen-ja.md) | マニフェスト駆動のコード生成 | ツール |
| [SU-0007](SU-0007-conformance-corpus/SU-0007-conformance-corpus-ja.md) | 適合性コーパス | ツール |
| [SU-0008](SU-0008-capability-negotiation-and-fallback/SU-0008-capability-negotiation-and-fallback-ja.md) | ケイパビリティネゴシエーションとノード単位のフォールバック | 互換性 |
| [SU-0009](SU-0009-device-mirror-preview/SU-0009-device-mirror-preview-ja.md) | 実機ミラープレビュー | エディタ |
| [SU-0010](SU-0010-narrow-scope-pilot/SU-0010-narrow-scope-pilot-ja.md) | 範囲を絞った最初のパイロット | 導入 |
| [SU-0011](SU-0011-english-first-documentation/SU-0011-english-first-documentation-ja.md) | 英語を主とするドキュメント | ドキュメント |

この表は全項目を列挙するだけのものです。進捗の正となるのは、この表ではなく各項目の `Status`
フィールドです。

## 未整理のアイデア

まだ番号を振れるほど形が定まっていないアイデアを置きます。スコープが固まった時点で項目に昇格させます。

- パーシャルとテンプレートの仕組み。共通のヘッダやフッタを一度だけ書けるようにするもので、
  [SU-0005](SU-0005-m4-operational-maturity/SU-0005-m4-operational-maturity-ja.md) から切り出す候補です。
- `HostSlot`。ホストアプリが用意したネイティブViewを埋め込むノード種別です。
- ドキュメント構造は同じまま符号化だけを差し替える二進表現（`+cbor`）。ドキュメントサイズが配信上の
  問題になった場合の逃げ道です。

## 項目IDの規則

ロードマップは `roadmaps/` 以下に**1項目1ディレクトリ**で置きます。各項目は
`roadmaps/SU-NNNN-<slug>/` に置きます。そこに英語のファイル `SU-NNNN-<slug>.md` と日本語版
`SU-NNNN-<slug>-ja.md`（IDとslugは同じ）を置きます。**SU** は *Spectre UI* を表し、`NNNN` は
**4桁ゼロ埋めの単調増加する**IDです。すべての項目は `roadmaps/` の直下へフラットに置きます。項目の
パスはID採番の時点で確定し、以後動きません。

ロードマップ項目を追加するときの手順です。

1. **次のIDを採番します。** `roadmaps/` 以下の全項目のうち最大の `SU-NNNN` に1を足した値です。現在の
   最大値は次のコマンドで確認できます。
   ```bash
   ls -d roadmaps/SU-*/ | sort | tail -1
   ```
   番号の再利用、飛ばし、当て推量はしません。
2. **項目のディレクトリと両言語のファイルを作成します。** 新しい項目は必ず提案から始まるので
   `Status: Proposal` とします。ファイルは `roadmaps/SU-NNNN-<slug>/SU-NNNN-<slug>.md`（英語）と
   `roadmaps/SU-NNNN-<slug>/SU-NNNN-<slug>-ja.md`（日本語、IDとslugは同じ）です。
3. **上の表に行を追加します。** `README.md` と `README-ja.md` の両方に追加します。
4. **IDは永久です。** 既存の項目を採番し直してはいけません。状態が変わったときも、完了したときも、
   取り下げたときもです。一度割り当てたSU IDは、その項目を永久に指します。

## 項目の書式

各ファイルは Swift Evolution の提案書式に従います。メタデータブロックに続けて、`## はじめに`、
`## 動機`、`## 詳細設計`、`## 検討した代替案`、`## 進捗`、`## 参考`の各節を置きます。埋められる範囲で
埋め、不明な箇所は `TBD` と書きます。

```markdown
[English](SU-NNNN-<slug>.md) · **日本語**

# SU-NNNN — <日本語のタイトル>

<!-- SU-METADATA -->
| 項目 | 値 |
|---|---|
| 提案 | [SU-NNNN](SU-NNNN-<slug>-ja.md) |
| 提案者 | [@handle](https://github.com/handle) |
| 状態 | **提案** |
| トピック | <トピック> |
| 関連 | <他の項目へのリンク。なければ「なし」> |
<!-- /SU-METADATA -->
```

内容については4つの規則があります。

- **日本語ファイルのタイトルは日本語で書きます。** 英語の見出しをそのまま写しません。翻訳の方針は
  本文と同じで、定着した用語（`SDUI`、`manifest`、`fallback`）は訳すと不自然になる場合そのまま
  残しますが、タイトル自体は日本語にします。
- **`詳細設計`は作業をMECEに列挙します。** 相互に排他かつ網羅的に分けることで、後述のチェックリストが
  作業単位ごとに1つのボックスとして対応できます。
- **`進捗`は生きた節です。** `詳細設計`の分解を写したチェックリスト（作業単位ごとに `- [ ]` を1つ置き、
  完了したら `- [x]` にする）と、古い順に並べた短いログで構成します。未着手の提案には、プレースホルダの
  ボックスを1つだけ置きます。
- **提案者はGitHubのハンドルで書きます。** `| 提案者 | [@handle](https://github.com/handle) |` の形式です。
  その項目を最初に書いた人のアカウントを指します。

`関連` は相互に張ります。一方の項目が他方を指すなら、他方も指し返します。

## 状態の値

`Status`（日本語ファイルでは `状態`）は、項目がどこまで進んでいるかの唯一の情報源です。項目の置き場所は
決めません。すべての項目はパスが永続するフラットなディレクトリに置かれるからです。

| 状態 | 意味 |
|---|---|
| `提案`（`Proposal`） | 検討中で未着手 |
| `進行中`（`In progress`） | 採択され、実装が進行中 |
| `実装済み`（`Implemented`） | 完了 |
| `提案（保留）`（`Proposal (deferred)`） | 意図的に棚上げ |

**状態を決めるのはコードです。** `Status` が追跡するのは実装が存在するかどうかであって、項目を将来の
提案として読ませ続けたいという意向ではありません。コードを伴わずに書かれた項目は `提案` です。その
コードを実装した変更が、同じ変更のなかで `Status` を `実装済み`（一部だけ実装したなら `進行中`）に
更新し、対応する `進捗` のボックスを埋め、ログにプルリクエストを記録します。

## 関連

- [`docs/adr/README-ja.md`](../docs/adr/README-ja.md) — これらの項目が前提とする技術的決定を記録した
  ADR（Architecture Decision Record、アーキテクチャ決定記録）です。ADRはすでに下した決定を記録し、
  ロードマップ項目はこれから行う作業を提案します。
- [`docs/roadmap.md`](../docs/roadmap.md) — マイルストーンの概観、見積もり、未決事項、リスク表です。
  マイルストーン項目（SU-0001〜SU-0005）はここから起こしています。
- [`.agent-workflows/roadmap-item/workflow.md`](../.agent-workflows/roadmap-item/workflow.md) —
  項目を書くための手順です。人とコーディングエージェントのどちらにも同じものが適用されます。
- [`.agent-workflows/implement/workflow.md`](../.agent-workflows/implement/workflow.md) —
  採択された項目のコードを出荷するための手順です。項目を書く手順と対になっています。
