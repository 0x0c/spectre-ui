[English](SU-0007-conformance-corpus.md) · **日本語**

# SU-0007 — 適合性コーパス

<!-- SU-METADATA -->
| 項目 | 値 |
|---|---|
| 提案 | [SU-0007](SU-0007-conformance-corpus-ja.md) |
| 提案者 | [@0x0c](https://github.com/0x0c) |
| 状態 | **進行中** |
| トピック | ツール |
| 関連 | [SU-0001](../SU-0001-m0-specification-freeze/SU-0001-m0-specification-freeze-ja.md), [SU-0002](../SU-0002-m1-client-sdks/SU-0002-m1-client-sdks-ja.md), [SU-0006](../SU-0006-manifest-driven-codegen/SU-0006-manifest-driven-codegen-ja.md), [SU-0008](../SU-0008-capability-negotiation-and-fallback/SU-0008-capability-negotiation-and-fallback-ja.md) |
<!-- /SU-METADATA -->

## はじめに

この項目は、実装非依存のJSONケース群である `spec/conformance/` と、それを読んで実行する Swift、Kotlin、
TypeScript の3つのテストハーネスを作ります。各ケースは、入力と、すべてのランタイムが返すべき出力を厳密に
指定します。

## 動機

Spectre UI が共有実装を1つ持つのではなくネイティブなレンダラを2つ出すのは、描画の下にある挙動を機械的に
ピン留めできるという明示的な前提の上でのことです
（[ADR-0001](../../docs/adr/ADR-0001-client-rendering-strategy/ADR-0001-client-rendering-strategy-ja.md)）。
このコーパスがその前提そのものです。これがなければ、同じドキュメントが iOS と Android で違う評価結果に
なるという欠陥は、片方のプラットフォームだけで画面がおかしいと利用者が報告するまで誰にも検出できません。

コーパスのケースは、仕様上の疑問を決着させるもっとも安い場所でもあります。バインディングが欠けているときに
`a ?? b` が何を意味するかという食い違いは、ケースとして一度決めれば済みます。実装として2回、さらに障害
として3回目を払う必要はありません。

## 詳細設計

1. **`expr/`** — 式の文字列とスコープに対して、評価結果のJSON値またはエラーコードを与えます。
2. **`binding/`** — ドキュメントと状態に対して、解決済みのプロパティ値を与えます。
3. **`actions/`** — 状態とアクションの列に対して、遷移後の状態と発火した副作用の列を与えます。
4. **`layout/`** — ドキュメントに対して、レイアウト計算前の正規化された描画ノード木を与えます。
5. **`compat/`** — ドキュメントとケイパビリティの申告に対して、劣化後のノード木を与えます。
6. **ランタイムごとのハーネス。** 生成された写しを経由せず、コーパスを直接読みます。
7. **継続的インテグレーションの規則。** 仕様化された挙動を変える変更は、同じ変更のなかでコーパスを
   拡張しなければなりません。

## 検討した代替案

- **ランタイムごとにユニットテストを書き、一致はレビューで確認する。** 却下します。一致するかどうかが、
  2つ目のテストを書く人が1つ目の主張を覚えているかに依存することになり、それはまさにこのコーパスが
  防ぐために存在するドリフトです。
- **プラットフォーム間のスクリーンショット比較。** 一致の確認手段としては却下します。2つのランタイムが
  式を同じに評価するかは意味論の問いであり、ピクセルはそれに答える手段として貧弱です。スクリーンショットは
  プラットフォーム内の回帰検出のために引き続き使います。

## 進捗

> 作業の進行に合わせて更新します。チェックリストは*詳細設計*の分解を写したもので、ログは何がいつ
> 変わったかを古い順に記録します。

- [x] `expr/` — 式の文字列とスコープに対して、評価結果の値またはエラーコードを与えます
- [x] `binding/` — ドキュメントと状態に対して、解決済みのプロパティ値を与えます
- [x] `actions/` — 状態とアクションの列に対して、遷移後の状態と発火した副作用の列を与えます
- [x] `layout/` — ドキュメントに対して、レイアウト計算前の正規化された描画ノード木を与えます
- [ ] `compat/` — ドキュメントとケイパビリティの申告に対して、劣化後のノード木を与えます
- [x] ランタイムごとのハーネス。コーパスを直接読みます
- [x] 仕様変更とコーパス変更を結びつける継続的インテグレーションの規則

**ログ**

- 本リポジトリは、クライアント実装フェーズに入った時点ですでに `expr/` と `resolve/` を備えていました。
- `resolve/` には `resolver.json` と `actions.json` があり、合計234ケースです。
- Kotlin と Swift は `ConformanceExprTest`/`ConformanceResolveTest` と `ConformanceTests` で、
  すでにこれらを実行しています。
- `resolve/resolver.json` は `RenderNode` の部分木全体を検証しており、単一のプロパティ値だけに
  とどまりません。
- そのため `binding/` と `layout/` の両方の実質的な置き場所になっています。
- 設計は両者を別ディレクトリとして分けていますが、実際にはその区分が成立しません。
- 解決済みプロパティ値の検証と、その周辺の木構造の検証は、同じ1つの確認になるからです。
- 今回の変更は、欠けていた3つ目のハーネス `packages/core` を追加します。
- `packages/core` は、手書きのTypeScript版 `SpectreExpr` パーサと評価器です。
- 移植は、Kotlin実装を1行ずつなぞる形で進めました。
- `docs/spec/expression.md` §6・§7 は、この3つ目のパーサを明示的に要求しています。
- この変更より前には、それが存在しませんでした。
- `packages/core/test/conformance.test.ts` は `spec/conformance/expr/*.json` を直接読みます。
- Kotlin と Swift がすでに実行している同じ199ケースを実行します。
- 移植したコードに対して、初回の実行でそのまま通りました。
- 今回の変更は、項目7を強制するCIのステップも追加します。
- あるプルリクエストが `docs/spec/` やマニフェストを変更しながら `spec/conformance/` を
  変更しない場合、`codegen` ジョブが失敗するようになりました。
- `compat/` は未着手のまま残します。
- 検証対象となる実際のケイパビリティ劣化が、まだ存在しないからです。
- それは [SU-0008](../SU-0008-capability-negotiation-and-fallback/SU-0008-capability-negotiation-and-fallback-ja.md)
  であり、この変更の時点ではまだ「提案」のままです。
- これは見落としではなく、実在の依存関係によるブロックです。
- `packages/core` は、JSON Patch や依存パス抽出をまだカバーしていません。
- `expr/` コーパスが検証するパーサと評価器の範囲にとどまります。

## 参考

- [ADR-0008 — 適合性テスト戦略](../../docs/adr/ADR-0008-conformance-testing-strategy/ADR-0008-conformance-testing-strategy-ja.md) — この項目が実装する決定です。
- [ADR-0004 — 式言語とデータバインディング](../../docs/adr/ADR-0004-expression-language/ADR-0004-expression-language-ja.md) — 入出力が純粋なJSONであることでコーパスを可能にしている言語です。
- [`docs/spec/expression.md`](../../docs/spec/expression.md) — `expr/` がピン留めする挙動です。
- [SU-0002 — M1、iOS / Android のクライアントSDK](../SU-0002-m1-client-sdks/SU-0002-m1-client-sdks-ja.md) — 100パーセント通す必要があるSDKです。
