[English](README.md) · **日本語**

# アーキテクチャ決定記録（ADR）

ADR（Architecture Decision Record、アーキテクチャ決定記録）は、技術上の重要な決定を1件ずつ記録した
ものです。その選択を迫った文脈、比較した選択肢、決定そのもの、根拠、そして支払った代償を残します。
このディレクトリは、Spectre UI におけるそうした決定の正となる置き場所です。Spectre UI は、
サーバードリブンUI（Server-Driven UI、SDUI）のためのクロスプラットフォームライブラリです。サーバが
配信したUI定義ドキュメントを、iOS と Android のネイティブSDKが解釈して描画します。

ADRはすでに下した決定を記録します。これから行う作業を提案するのは
[`roadmaps/`](../../roadmaps/README-ja.md) 以下のロードマップ項目です。ここに記録した決定を変える作業を
行う場合、既存のADRを書き換えるのではなく、それを置き換える新しいADRを書きます。当時何を信じ、なぜ
そう決めたのかという記録を残すためです。

## 記録一覧

| ID | 記録 | 状態 | トピック |
| --- | --- | --- | --- |
| [ADR-0001](ADR-0001-client-rendering-strategy/ADR-0001-client-rendering-strategy-ja.md) | クライアントのレンダリング方式 | 承認 | クライアントランタイム |
| [ADR-0002](ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source-ja.md) | コンポーネントマニフェストを単一の情報源にする | 承認 | 仕様 |
| [ADR-0003](ADR-0003-ui-document-format/ADR-0003-ui-document-format-ja.md) | UI定義のワイヤ形式 | 承認 | 仕様 |
| [ADR-0004](ADR-0004-expression-language/ADR-0004-expression-language-ja.md) | 式言語とデータバインディング | 承認 | 仕様 |
| [ADR-0005](ADR-0005-editor-stack/ADR-0005-editor-stack-ja.md) | WYSIWYGエディタの技術スタック | 承認 | エディタ |
| [ADR-0006](ADR-0006-versioning-and-forward-compatibility/ADR-0006-versioning-and-forward-compatibility-ja.md) | バージョニングと前方互換性 | 承認 | 互換性 |
| [ADR-0007](ADR-0007-backend-stack/ADR-0007-backend-stack-ja.md) | バックエンドと配信の形 | 承認 | 配信 |
| [ADR-0008](ADR-0008-conformance-testing-strategy/ADR-0008-conformance-testing-strategy-ja.md) | 適合性テスト戦略 | 承認 | 品質 |

## 記録IDの規則

記録は `docs/adr/` 以下に**1件1ディレクトリ**で置きます。各記録は `docs/adr/ADR-NNNN-<slug>/` に置きます。
そこに英語のファイル `ADR-NNNN-<slug>.md` と日本語版 `ADR-NNNN-<slug>-ja.md`（IDとslugは同じ）を置きます。
`NNNN` は**4桁ゼロ埋めの単調増加する**IDです。

記録を追加するときの手順です。

1. **次のIDを採番します。** 既存の最大の `ADR-NNNN` に1を足した値です。現在の最大値は次のコマンドで
   確認できます。
   ```bash
   ls -d docs/adr/ADR-*/ | sort | tail -1
   ```
   番号の再利用、飛ばし、当て推量はしません。
2. **記録のディレクトリと両言語のファイルを作成します。** 最初は `Status: Proposed`（提案）とし、
   決定に合意できた時点で `Accepted`（承認）に移します。
3. **上の表に行を追加します。** `README.md` と `README-ja.md` の両方に追加します。
4. **IDは永久です。** 記録を採番し直してはいけません。承認済みの決定を別の決定に書き換えることも
   しません。後述のとおり、新しい記録で置き換えます。

## 記録の書式

各ファイルはメタデータブロックに続けて、`## 文脈`、`## 検討した選択肢`、`## 決定`、`## 根拠`、
`## 代償`、`## 再検討のトリガー`、`## 参考`の各節を置きます。記録を誠実に保つのは
`再検討のトリガー`です。どの観測が得られたらこの決定を開き直すのかを、あらかじめ名指ししておきます。

```markdown
[English](ADR-NNNN-<slug>.md) · **日本語**

# ADR-NNNN — <日本語のタイトル>

<!-- ADR-METADATA -->
| 項目 | 値 |
|---|---|
| 記録 | [ADR-NNNN](ADR-NNNN-<slug>-ja.md) |
| 起草者 | [@handle](https://github.com/handle) |
| 状態 | **承認** |
| 日付 | YYYY-MM-DD |
| トピック | <トピック> |
| 関連 | <他の記録やロードマップ項目へのリンク。なければ「なし」> |
<!-- /ADR-METADATA -->
```

**日本語ファイルのタイトルは日本語で書きます。** 英語の見出しをそのまま写しません。定着した用語
（`SDUI`、`manifest`、`fallback`）は訳すと不自然になる場合そのまま残しますが、タイトル自体は日本語に
します。

## 状態の値

| 状態 | 意味 |
|---|---|
| `提案`（`Proposed`） | 書き起こしたが未合意 |
| `承認`（`Accepted`） | 合意され、現に効力を持つ |
| `置換済み`（`Superseded`） | 後続の記録に置き換えられた。後続は `置換先` フィールドで示す |
| `非推奨`（`Deprecated`） | 効力を失ったが、置き換える記録はない |

置き換えは相互に張ります。新しい記録は `置換元` に古い記録を挙げ、古い記録は本文をそのままにしたうえで
`置換先` に後続を書きます。

## 関連

- [`docs/tech-selection.md`](../tech-selection-ja.md) — ここにある各記録が前提とする制約を示す索引です。
- [`roadmaps/README-ja.md`](../../roadmaps/README-ja.md) — これらの決定が含意する作業を担う
  ロードマップ項目です。
- [`.agent-workflows/adr/workflow.md`](../../.agent-workflows/adr/workflow.md) — 記録を書くための
  手順です。人とコーディングエージェントのどちらにも同じものが適用されます。
