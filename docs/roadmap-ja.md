[English](roadmap.md) · **日本語**

# ロードマップと未決事項

このページはマイルストーンの概観、見積もり、未決事項、リスクをまとめたものです。個々の作業項目は
[`roadmaps/`](../roadmaps/README-ja.md) 以下に、1項目1ディレクトリで日英両方の提案として置いています。
下の各マイルストーンは、対応する項目 SU-0001〜SU-0005 に対応します。

## 実装状況 (現時点)

M0 と M1 は、ファジングとスナップショットテストを除いて入っている。M3（オーサリング・配信基盤）にも
実質的なコードが載っており、ケイパビリティに基づく木の整形も含まれる。**エディタ (M2) は最初の
一巡が入った。** パレット・キャンバス・インスペクタ・アクションエディタ・サンプルデータ・undo/redo
は動く。作業領域は並べ替えられ、オーバレイパネルがドキュメントの表示オプションを編集できる。実機ミラー（[SU-0009](../roadmaps/SU-0009-device-mirror-preview/SU-0009-device-mirror-preview-ja.md)、
WebSocket 経由のデバイスプレビュー）はまだない。近似プレビューだけでは、公開前の確認を安全に
行えない。

| 領域 | 状態 | 検証 |
| --- | --- | --- |
| コンポーネントマニフェスト + codegen | 実装済み | カタログ同期テスト (Kotlin/Swift 両方) + CI のドリフト検査 |
| 適合性コーパス | 実装済み (242ケース、Swift/Kotlin/TypeScript の3実装で検証) | `pnpm --filter @spectre-ui/core run test` (TypeScript版 SpectreExpr) |
| Kotlin ランタイム (spectre-core) | 実装済み | **297 テスト green** |
| Compose レンダラ + Android サンプル | 実装済み | CI (`android` ジョブ) |
| Swift ランタイム (SpectreCore) | 実装済み | CI (`ios` ジョブ) |
| SwiftUI レンダラ + iOS サンプル | 実装済み | CI (`ios` / `ios-sample` ジョブ) |
| APNs配信のiOSサンプル ([SU-0012](../roadmaps/SU-0012-apns-sdui-sample-app/SU-0012-apns-sdui-sample-app-ja.md)) | 実装済み | CI (`ios-apns-sample` ジョブ) |
| 差分再解決 | 実装済み | `Resolver.reresolveTraced` が既存の依存パス抽出を接続 |
| `applyPatch` / `focus` / `scrollTo` | 実装済み | RFC 6902 JSON Patch + フォーカス/スクロールの配線 |
| 配信・キャッシュ (DocumentLoader) | 実装済み | 3層キャッシュ + stale-while-revalidate。サンプルも接続済み |
| ケイパビリティネゴシエーションとノード単位のフォールバック劣化 | 実装済み | `Spectre-Schema`/`Spectre-Components` ヘッダ、サーバ側の `degradeDocumentTree`、クライアントの fallback → optional省略 → プレースホルダという決まった順序 (ADR-0006) |
| 2つのレンダラのビジュアルリグレッションテスト ([SU-0015](../roadmaps/SU-0015-renderer-visual-regression-testing/SU-0015-renderer-visual-regression-testing-ja.md)) | 進行中 | テスト一式、`spec/vrt/` の共有フィクスチャ、`android-vrt` / `ios-vrt` ジョブは揃っている。最初のゴールデン画像を記録してコミットするまで、両方とも検証をスキップする |
| オーサリング・配信API (M3) | 進行中 | `packages/server`。権限とワークフロー(項目3)はまだ仮の実装のまま |
| エディタ (M2) | 進行中 | `packages/editor`。パレット・キャンバス・インスペクタ・アクションエディタ・サンプルデータ・undo/redo、並べ替えられる作業領域（[SU-0013](../roadmaps/SU-0013-editor-workspace-layout/SU-0013-editor-workspace-layout-ja.md)）、オーバレイの編集（[SU-0014](../roadmaps/SU-0014-overlay-presentation-options/SU-0014-overlay-presentation-options-ja.md)）は動くが、実機ミラー(SU-0009)が欠けており、M2自身の受け入れ基準はまだ満たさない |
| オーバレイの表示オプション（[SU-0014](../roadmaps/SU-0014-overlay-presentation-options/SU-0014-overlay-presentation-options-ja.md)） | 実装済み | `presentation` ブロックとアラートの表示オプション。スキーマ・両レンダラ・解決コーパスの3ケース |

### 検証の分担

開発環境によっては、iOS と Android のコンパイルを検証できません。Swift のツールチェインが
入っていない、`dl.google.com` へ到達できず AGP と androidx を取得できない、といった事情があるためです。

そこで `clients/android/settings.gradle.kts` は、Android SDK が見つからないときに `:spectre-ui` と
`:sample` をスキップします。**ロジックのテストだけは、どの環境でも実行できます。**

コンパイル検証は CI（Continuous Integration、継続的インテグレーション）が担います。
ジョブの定義は [.github/workflows/ci.yml](../.github/workflows/ci.yml) にあります。

| ジョブ | ランナー | 内容 |
| --- | --- | --- |
| `core` | Ubuntu | `:spectre-core:test` — 適合性コーパスとランタイム |
| `codegen` | Ubuntu | 生成物がマニフェストとずれていないか + 仕様 JSON の構文 + コーパス拡張規則 + マニフェストの加算のみ進化 |
| `server` | Ubuntu | `packages/core` / `packages/manifest` / `packages/server` / `packages/editor` の型検査とテスト(PostgreSQL サービスコンテナつき) |
| `android` | Ubuntu | `:spectre-ui` / `:sample` のビルド |
| `ios` | macos | `swift build` / `swift test` + iOS 向け `xcodebuild` |
| `ios-sample` | macos | XcodeGen でプロジェクトを生成してサンプルアプリをビルド |
| `ios-apns-sample` | macos | 例示ペイロードの構文チェック + XcodeGen でAPNsサンプルをビルド |
| `android-vrt` | Ubuntu | `spec/vrt/` のケースを Roborazzi で描画し、ゴールデン画像と比較 |
| `ios-vrt` | macos | 同じケースを iOS シミュレータ上で swift-snapshot-testing により比較 |

手元で全部を確かめたいときは、Android SDK と Xcode のある環境で以下を実行する。

```sh
cd clients/android && ./gradlew build
cd clients/ios && swift test
```

## マイルストーン

見積もりは「フルタイム換算の人週」。前提: iOS 1名、Android 1名、Web/サーバ 1〜2名。

### M0 — 仕様の確定 (3〜4週) — [SU-0001](../roadmaps/SU-0001-m0-specification-freeze/SU-0001-m0-specification-freeze-ja.md)

**成果物**: 仕様が凍結され、コード生成が動く状態。

- [ ] コンポーネントマニフェストのメタスキーマ設計
- [ ] コンポーネントカタログ v0.1 の確定（実際に置き換えたい画面3つを紙上で表現しきれるか検証する）
- [ ] デザイントークンの定義（既存デザインシステムがあればそこから写す）
- [ ] SpectreExpr の文法確定 + 適合性コーパスの初版
- [ ] codegen: マニフェスト → JSON Schema / TS / Swift / Kotlin
- [ ] 適合性コーパスのランナー雛形（3言語）

> **M0 の受け入れ基準**: 実在の画面3つ（一覧・詳細・フォーム）を手書きJSONで表現でき、レビューで「これで足りる」と合意できること。ここを妥協するとM3以降で作り直しになる。

### M1 — クライアントSDK (6〜8週、iOS/Android 並行) — [SU-0002](../roadmaps/SU-0002-m1-client-sdks/SU-0002-m1-client-sdks-ja.md)

- [ ] Runtime: DocumentLoader / Store / Resolver / ActionDispatcher
- [ ] SpectreExpr パーサ + 評価器（適合性コーパスをパス）
- [ ] レンダラ: カタログ v0.1 の全コンポーネント
- [ ] ThemeProvider、ホストデリゲート
- [ ] 3層キャッシュ + stale-while-revalidate
- [ ] 互換性の劣化処理（fallback / optional / 上限値の強制）
- [ ] ファジングテスト、スナップショットテスト。後者は
      [SU-0015](../roadmaps/SU-0015-renderer-visual-regression-testing/SU-0015-renderer-visual-regression-testing-ja.md)
      が、レンダラごとのビジュアルリグレッションテストとして扱う
- [ ] サンプルアプリ

> **M1 の受け入れ基準**: 手書きJSONで実在の画面3つが両OSで描画され、既存のネイティブ実装と並べて差異が許容範囲であること。適合性コーパスが両OSで100%通ること。

### M2 — エディタ (6〜8週) — [SU-0003](../roadmaps/SU-0003-m2-wysiwyg-editor/SU-0003-m2-wysiwyg-editor-ja.md)

- [x] マニフェスト駆動のパレット / インスペクタ
- [x] キャンバス（DnD、選択、木構造パネル）
- [x] 式のピッカーモード（式モード = CodeMirrorによるテキストモードは未着手）
- [x] アクションエディタ（マニフェスト由来のカタログ + パラメータ編集。サーバ応答プロトコルの
      UXは薄い）
- [x] サンプルデータ管理
- [x] undo/redo（リント表示・差分表示は未着手）
- [ ] **実機ミラー（WebSocket）** ← 必須。
      [SU-0009](../roadmaps/SU-0009-device-mirror-preview/SU-0009-device-mirror-preview-ja.md) として
      追跡中、この一巡目のスコープ外
- [x] デバイス/ロケール/テーマ/フォントスケールの切り替え（近似プレビュー内）

### M3 — 配信基盤 (4〜5週) — [SU-0004](../roadmaps/SU-0004-m3-delivery-platform/SU-0004-m3-delivery-platform-ja.md)

- [ ] オーサリングAPI（下書き・検証・公開・ロールバック・監査ログ）
- [ ] 配信API（ケイパビリティネゴシエーション、ETag、CDN設定）
- [ ] 権限とワークフロー（承認フロー）
- [ ] 論理エンドポイントの登録・管理
- [ ] テレメトリ収集と対応率の集計

> **M3 完了時点で本番投入可能**。まず影響の小さい画面（キャンペーン告知、お知らせ一覧など）から。

### M4 — 運用の成熟 (継続) — [SU-0005](../roadmaps/SU-0005-m4-operational-maturity/SU-0005-m4-operational-maturity-ja.md)

- [ ] 段階公開 / A-Bテスト / セグメント配信
- [ ] エディタ上の対応率フィードバック
- [ ] パーシャルとテンプレート
- [ ] `HostSlot`（ネイティブView埋め込み）
- [ ] ページネーション、プルリフレッシュの高度化
- [ ] 緊急キルスイッチ

---

## 未決事項（要確認）

設計にあたって前提を置いた項目。実際の回答によって設計が変わりうるものを重要度順に挙げる。

### 1. ホストアプリの現状 — **設計への影響: 大**

- iOS は SwiftUI ベースか、UIKit ベースか。UIKit 中心なら `UIHostingController` の埋め込み境界（Safe Area、スクロール連動、サイズ確定）で追加の設計が要る。
- Android は Compose か View システムか。
- 最低対応OSバージョン。iOS 16 / minSdk 24 を仮置きしているが、より高ければ実装が楽になる（`Layout` プロトコル、`FlowRow` など）。

### 2. UIを編集するのは誰か — **設計への影響: 大**

- 非エンジニア（企画・CS）を想定してカタログを閉じ、式をピッカー中心に設計した。
- **編集者がエンジニアのみ**なら、式の表現力を上げ、エディタをコードエディタ寄りにするほうが総コストは下がる。この場合 M2 のスコープが大きく減る。

### 3. 既存のデザインシステム — **設計への影響: 中**

- 既存のトークン定義（Figma Variables / Style Dictionary など）があれば、それを `spec/tokens.json` の情報源にする。ゼロから定義するのは避けたい。

### 4. バックエンドの言語・既存基盤 — **設計への影響: 中**

- ADR-0007 で TypeScript/Fastify を選んだが、組織がJVM一色なら Kotlin/Spring も合理的（Android実装との共有が効く代わりに、エディタとの検証ロジック共有を失う）。
- 既存のCDN、認証基盤、フィーチャーフラグ基盤、計測基盤との接続点。

### 5. 適用範囲 — **設計への影響: 中**

- 「アプリ全体」か「特定の領域（キャンペーン、お知らせ、オンボーディング）」か。
- 後者なら M0 のカタログをかなり小さくでき、全体で数ヶ月短縮できる。**まず後者から始めることを強く推奨する**。

### 6. 更新頻度と規模

- 画面数、日次の公開回数、ピーク時のリクエスト数。CDN設計とキャッシュTTLに影響する。

### 7. オフライン要件

- オフラインでの表示が必要な画面はあるか。アプリ同梱のフォールバックドキュメントをどこまで用意するか。

### 8. 多言語対応

- ドキュメント内に文言を直接持つのか、キーだけ持ってアプリ内の文言リソースを引くのか。
- 前者は編集者が翻訳まで管理でき、後者は既存の翻訳ワークフローに乗る。**現設計は前者を前提**にしているが、`t('key')` 相当の関数を追加すれば後者も表現できる。

---

## リスクと対策

| リスク | 影響 | 対策 |
| --- | --- | --- |
| カタログの設計が不十分で、後から破壊的変更が必要になる | 大 | M0 の受け入れ基準を厳格にする。実画面3つで検証してから凍結 |
| Web/iOS/Android の見た目がずれ、編集者が信用しなくなる | 大 | 実機ミラーを M2 必須に。近似であることをUIで明示 |
| 古いアプリバージョンでの劣化が可視化されず、事故が起きる | 大 | テレメトリによる対応率をエディタに出す（M3/M4） |
| SDUI で表現できない要件が出て、結局ネイティブ実装に戻る | 中 | `host` アクションと `HostSlot` を逃げ道として最初から設計に入れてある |
| 式が複雑化してドキュメントが読めなくなる | 中 | 言語を意図的に弱く保つ。ネストに警告。ロジックはサーバへ、を原則にする |
| 適合性のドリフト（Swift/Kotlin/TS の挙動差） | 中 | 適合性コーパスとCI。閾値を超えたら KMP へ部分移行（ADR-0001 の再検討条件） |
| ドキュメント肥大による初回描画の遅延 | 小 | ノード数上限、遅延描画、stale-while-revalidate、バンドル済みフォールバック |

---

## 次のアクション

1. 上記「未決事項」の 1・2・5 を確認する（設計への影響が大きい順）。
2. 置き換え対象の実画面を3つ選び、手書きJSONで表現しきれるか検証する。
3. その結果でコンポーネントカタログ v0.1 を確定させ、M0 に入る。

適用範囲を絞る判断は [SU-0010](../roadmaps/SU-0010-narrow-scope-pilot/SU-0010-narrow-scope-pilot-ja.md)
として提案しています。
