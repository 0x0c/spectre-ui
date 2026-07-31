[English](ADR-0001-client-rendering-strategy.md) · **日本語**

# ADR-0001 — クライアントのレンダリング方式

<!-- ADR-METADATA -->
| 項目 | 値 |
|---|---|
| 記録 | [ADR-0001](ADR-0001-client-rendering-strategy-ja.md) |
| 起草者 | [@0x0c](https://github.com/0x0c) |
| 状態 | **承認** |
| 日付 | 2026-07-31 |
| トピック | クライアントランタイム |
| 関連 | [ADR-0002](../ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source-ja.md), [ADR-0004](../ADR-0004-expression-language/ADR-0004-expression-language-ja.md), [ADR-0008](../ADR-0008-conformance-testing-strategy/ADR-0008-conformance-testing-strategy-ja.md), [SU-0002](../../../roadmaps/SU-0002-m1-client-sdks/SU-0002-m1-client-sdks-ja.md) |
<!-- /ADR-METADATA -->

## 文脈

Spectre UI はサーバードリブンUI（Server-Driven UI、SDUI）のためのライブラリです。サーバがUI定義
ドキュメントを配信し、クライアントがそれを描画します。同じドキュメントは iOS でも Android でも同じ
ように描画される必要があり、設計が最初に答えるべき問いは、クライアント実装をどこまで共有するかです。

この問いの答えは、このライブラリが何であるかによって縛られます。Spectre UI は既存のホストアプリに
組み込まれるライブラリなので、バイナリサイズと依存を押し付けないことが機能より優先します。描画先は
iOS と Android のネイティブアプリであり、Web は編集用のインタフェースであって描画先ではありません。

## 検討した選択肢

| 案 | 内容 | 長所 | 短所 |
| --- | --- | --- | --- |
| A. ネイティブ2実装 | SwiftUI と Jetpack Compose で個別に実装する | 描画品質、アニメーション、アクセシビリティが最良です。追加の依存がありません。ホストアプリのデザインシステムと自然に混ざります | 同じロジックを2回書くことになり、挙動がドリフトします |
| B. Kotlin Multiplatform のコアとネイティブUI | パース、式評価、状態管理を Kotlin Multiplatform（KMP）で共有し、描画のみネイティブで行う | ロジックのドリフトが構造的に起きません | iOS に 1.5〜3MB 程度の Kotlin/Native ランタイムが乗ります。Swift 側のAPIが Objective-C 経由になり、ラッパが必要です。iOSチームに Gradle と KMP のビルド運用を強います |
| C. Flutter / React Native | 描画そのものをクロスプラットフォームフレームワークに載せる | 実装が1つで済みます | 1つのライブラリのために巨大なランタイムをホストアプリに強制し、ネイティブ画面との混在も難しくなります。組み込みライブラリとしては採り得ません |
| D. WebView | HTMLを描画する | 実装が1つで済み、更新も容易です | ネイティブの操作感が失われます。スクロール性能、アクセシビリティ、フォントスケーリングがいずれも劣化します |

## 決定

**案A、ネイティブ2実装**を採用します。プラットフォーム間で共有するのはコードではなく、機械可読な仕様、
その仕様から生成した型、そして全ランタイム共通の適合性テストコーパスの3点です。

対象バージョンはこの決定から従います。

- iOS 16以降、SwiftUI、Swift Package として配布します。UIKit ベースのホスト向けに
  `UIHostingController` のラッパを同梱します。
- Android は minSdk 24、Jetpack Compose、Gradle モジュールとして配布します。View システムのホスト
  向けに `AbstractComposeView` のラッパを同梱します。

## 根拠

案Cと案Dは、組み込みライブラリという前提と両立しません。ライブラリがホストアプリにランタイムを強制した
時点で採用障壁が跳ね上がり、描画面のどんな利点もそれを埋め合わせません。

したがって実質の争点は案Aと案Bであり、決め手は共有できるロジックがどれだけあるかです。共有し得るのは、
JSONからのドキュメントのデコード、式の評価、状態ストアへのアクション適用の3つで、合わせておよそ
2,000〜3,000行にとどまります。このうちデコードとそれが必要とする型は、コンポーネントマニフェストから
生成するのでドリフトが構造的に消えます（[ADR-0002](../ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source-ja.md)）。
式評価は入力も出力も純粋なJSONなので、ゴールデンテストのコーパスで3つの実装を互いにピン留めできます
（[ADR-0008](../ADR-0008-conformance-testing-strategy/ADR-0008-conformance-testing-strategy-ja.md)）。

つまり案Bが防ぐドリフトの大半は、案Aと生成とコーパスの組み合わせでより安く防げます。一方で案Bの代償、
すなわち iOS のバイナリ肥大とビルド運用の負担は、どうやっても消せません。ノード木を SwiftUI や Compose
に落とすレンダラ本体は、どの案を採ってもプラットフォーム固有であり、実装量の大半を占めます。

## 代償

式や状態遷移の仕様を変えるたびに、2箇所を直す必要があります。両者を誠実に保つのは、両プラットフォームの
継続的インテグレーションで走らせる適合性コーパスです。コーパスを拡張しない仕様変更は受け付けません。

## 再検討のトリガー

次のいずれかが成り立った場合、レンダラを除くコア、すなわちパース、式評価、状態ストアを Kotlin
Multiplatform へ移行します。

- ランタイム間のドリフトに起因する適合性コーパスの失敗が、四半期に3件を超えた場合。
- 共有ロジックが5,000行を超えた場合。

この移行の余地は設計に残します。両プラットフォームで最初からコアとレンダラを分けておくので、後から案Bへ
部分的に移っても描画のコードには手が入りません。

## 参考

- [ADR-0002 — コンポーネントマニフェストを単一の情報源にする](../ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source-ja.md) — 生成がドリフトのうちデコード側を消す仕組みです。
- [ADR-0004 — 式言語とデータバインディング](../ADR-0004-expression-language/ADR-0004-expression-language-ja.md) — 式評価器を3回実装できる小ささに保つ理由です。
- [ADR-0008 — 適合性テスト戦略](../ADR-0008-conformance-testing-strategy/ADR-0008-conformance-testing-strategy-ja.md) — この決定が依拠するコーパスです。
- [SU-0002 — M1、iOS / Android のクライアントSDK](../../../roadmaps/SU-0002-m1-client-sdks/SU-0002-m1-client-sdks-ja.md) — この決定を実行する作業です。
- [`docs/architecture.md`](../../architecture.md) — この決定が前提とするランタイムの層構成です。
