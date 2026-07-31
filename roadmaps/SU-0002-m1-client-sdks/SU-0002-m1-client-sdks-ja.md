[English](SU-0002-m1-client-sdks.md) · **日本語**

# SU-0002 — M1、iOS / Android のクライアントSDK

<!-- SU-METADATA -->
| 項目 | 値 |
|---|---|
| 提案 | [SU-0002](SU-0002-m1-client-sdks-ja.md) |
| 提案者 | [@0x0c](https://github.com/0x0c) |
| 状態 | **提案** |
| トピック | クライアントSDK |
| 関連 | [SU-0001](../SU-0001-m0-specification-freeze/SU-0001-m0-specification-freeze-ja.md), [SU-0003](../SU-0003-m2-wysiwyg-editor/SU-0003-m2-wysiwyg-editor-ja.md), [SU-0007](../SU-0007-conformance-corpus/SU-0007-conformance-corpus-ja.md), [SU-0008](../SU-0008-capability-negotiation-and-fallback/SU-0008-capability-negotiation-and-fallback-ja.md) |
<!-- /SU-METADATA -->

## はじめに

マイルストーンM1は、UI定義ドキュメントを描画する2つのネイティブSDK（Software Development Kit、
ソフトウェア開発キット）を作ります。1つは iOS 16以降向けの Swift と SwiftUI による実装、もう1つは
minSdk 24 の Android 向けの Kotlin と Jetpack Compose による実装です。両者はエンジニア1名ずつが並行して
作り、見積もりはフルタイム換算で6〜8人週です。

M1は、手書きのJSONから実在する3画面が両OSで描画され、既存のネイティブ実装と並べて差異が許容範囲だと
判断でき、適合性コーパスが両OSで100%通った時点で完了します。

## 動機

SDUI（Server-Driven UI、サーバードリブンUI）が信頼を得るか失うかは、SDKで決まります。ほとんど正しい
描画は、描画しないことより悪い結果を招きます。見慣れない崩れ方をする画面を目にしたチームは、この仕組みを
通じて出すのをやめてネイティブ実装に戻り、その時点で、ここで作った他のすべてに利用者がいなくなるからです。

したがって、機能の数より2つの性質が重要です。プロダクトのエンジニアが受け入れられる程度に、手書きの
ネイティブコードと見分けがつかないこと。そして、SDKが理解できないものを含むドキュメントが、クラッシュ
ではなく予測できる形で劣化することです。

## 詳細設計

1. **ランタイム**。`DocumentLoader`、状態を保持する `Store`、プロパティを解決する `Resolver`、
   `ActionDispatcher` です。
2. **`SpectreExpr` のパーサと評価器。** 両言語で適合性コーパスを通します。
3. **レンダラ。** カタログ v0.1 の全コンポーネントをカバーします。
4. **`ThemeProvider` とホストデリゲート。** ホストアプリがトークンを供給し、ネイティブなアクションを
   処理するための経路です。
5. **3層キャッシュ。** stale-while-revalidate を伴います。
6. **互換性のための劣化処理。** フォールバック、`optional` による省略、申告された上限値の強制です。
7. **ファジングテストとスナップショットテスト。** 前者は不正なドキュメントに対して、後者は
   プラットフォーム内の回帰検出のために行います。
8. **各プラットフォームのサンプルアプリ。**

## 検討した代替案

- **iOSを先に出し、Androidを後に回す。** 却下します。実装の食い違いは、両方を書いている最中に見つけるのが
  最も安く、6週間後に見つかったコーパスの失敗は修正ではなく再設計になります。
- **Kotlin Multiplatform の共有コアを介して描画する。**
  [ADR-0001](../../docs/adr/ADR-0001-client-rendering-strategy/ADR-0001-client-rendering-strategy-ja.md)
  で却下済みです。バイナリとビルドの費用を、コーパスが既に防いでいるドリフトと比べたうえでの判断です。

## 進捗

> 作業の進行に合わせて更新します。チェックリストは*詳細設計*の分解を写したもので、ログは何がいつ
> 変わったかを古い順に記録します。

- [ ] 未着手

**ログ**

- 作業は未着手です。リポジトリは設計フェーズにあります。

## 参考

- [ADR-0001 — クライアントのレンダリング方式](../../docs/adr/ADR-0001-client-rendering-strategy/ADR-0001-client-rendering-strategy-ja.md) — 2つのSDKを別々のネイティブ実装にする理由です。
- [SU-0001 — M0、仕様の凍結](../SU-0001-m0-specification-freeze/SU-0001-m0-specification-freeze-ja.md) — このマイルストーンが使う仕様と生成された型です。
- [SU-0007 — 適合性コーパス](../SU-0007-conformance-corpus/SU-0007-conformance-corpus-ja.md) — ランタイム間の一致に対する受け入れ基準です。
- [SU-0008 — ケイパビリティネゴシエーションとノード単位のフォールバック](../SU-0008-capability-negotiation-and-fallback/SU-0008-capability-negotiation-and-fallback-ja.md) — ここで実装する劣化の挙動です。
- [`docs/architecture.md`](../../docs/architecture.md) — ランタイムの層構成です。
