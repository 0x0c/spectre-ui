/**
 * Spectre UI ロードマップのデータ。
 *
 * 情報源は docs/roadmap.md（マイルストーン・未決事項・リスク・次のアクション）と
 * docs/tech-selection.md（選定サマリ）。ドキュメントを更新したらこのファイルも合わせる。
 * 個別の作業項目は roadmaps/ に、各技術決定は docs/adr/ に1件ずつある。
 *
 * 見積もりは「フルタイム換算の人週」。前提: iOS 1名、Android 1名、Web/サーバ 1〜2名。
 */
window.ROADMAP = {
  project: {
    name: "Spectre UI",
    tagline: "サーバードリブンUI (SDUI) のためのクロスプラットフォームライブラリ",
    phase: "設計フェーズ（実装コードなし）",
    repo: "https://github.com/0x0c/spectre-ui",
    assumption:
      "見積もりは docs/roadmap.md の人週。前提は iOS 1名 / Android 1名 / Web・サーバ 1〜2名。",
  },

  // track: 並行ビューでのレーン。同じ track のマイルストーンは直列に並ぶ。
  milestones: [
    {
      id: "M0",
      title: "仕様の確定",
      weeks: [3, 4],
      track: "spec",
      trackLabel: "全体",
      goal: "仕様が凍結され、コード生成が動く状態。",
      acceptance:
        "実在の画面3つ（一覧・詳細・フォーム）を手書きJSONで表現でき、レビューで「これで足りる」と合意できること。ここを妥協するとM3以降で作り直しになる。",
      tasks: [
        { t: "コンポーネントマニフェストのメタスキーマ設計", done: false },
        {
          t: "コンポーネントカタログ v0.1 の確定（実際に置き換えたい画面3つを紙上で表現しきれるか検証する）",
          done: false,
        },
        { t: "デザイントークンの定義（既存デザインシステムがあればそこから写す）", done: false },
        { t: "SpectreExpr の文法確定 + 適合性コーパスの初版", done: false },
        { t: "codegen: マニフェスト → JSON Schema / TS / Swift / Kotlin", done: false },
        { t: "適合性コーパスのランナー雛形（3言語）", done: false },
      ],
      doc: "https://github.com/0x0c/spectre-ui/blob/main/docs/spec/schema.md",
    },
    {
      id: "M1",
      title: "クライアントSDK",
      weeks: [6, 8],
      track: "client",
      trackLabel: "iOS / Android",
      goal: "iOS / Android のレンダラとランタイムが、カタログ v0.1 を描画できる状態。",
      acceptance:
        "手書きJSONで実在の画面3つが両OSで描画され、既存のネイティブ実装と並べて差異が許容範囲であること。適合性コーパスが両OSで100%通ること。",
      tasks: [
        { t: "Runtime: DocumentLoader / Store / Resolver / ActionDispatcher", done: false },
        { t: "SpectreExpr パーサ + 評価器（適合性コーパスをパス）", done: false },
        { t: "レンダラ: カタログ v0.1 の全コンポーネント", done: false },
        { t: "ThemeProvider、ホストデリゲート", done: false },
        { t: "3層キャッシュ + stale-while-revalidate", done: false },
        { t: "互換性の劣化処理（fallback / optional / 上限値の強制）", done: false },
        { t: "ファジングテスト、スナップショットテスト", done: false },
        { t: "サンプルアプリ", done: false },
      ],
      doc: "https://github.com/0x0c/spectre-ui/blob/main/docs/architecture.md",
    },
    {
      id: "M2",
      title: "エディタ",
      weeks: [6, 8],
      track: "web",
      trackLabel: "Web / サーバ",
      goal: "非エンジニアがカタログの組み合わせでUIを編集・プレビューできる状態。",
      acceptance: null,
      tasks: [
        { t: "マニフェスト駆動のパレット / インスペクタ", done: false },
        { t: "キャンバス（DnD、選択、木構造パネル）", done: false },
        { t: "式のピッカーモード + 式モード（CodeMirror）", done: false },
        { t: "アクションエディタ", done: false },
        { t: "サンプルデータ管理", done: false },
        { t: "リント表示、undo/redo、差分表示", done: false },
        { t: "実機ミラー（WebSocket）", done: false, critical: true },
        { t: "デバイス/ロケール/テーマ/フォントスケールの切り替え", done: false },
      ],
      doc: "https://github.com/0x0c/spectre-ui/blob/main/docs/editor.md",
    },
    {
      id: "M3",
      title: "配信基盤",
      weeks: [4, 5],
      track: "web",
      trackLabel: "Web / サーバ",
      goal: "本番投入可能。まず影響の小さい画面（キャンペーン告知、お知らせ一覧など）から。",
      acceptance: null,
      release: true,
      tasks: [
        { t: "オーサリングAPI（下書き・検証・公開・ロールバック・監査ログ）", done: false },
        { t: "配信API（ケイパビリティネゴシエーション、ETag、CDN設定）", done: false },
        { t: "権限とワークフロー（承認フロー）", done: false },
        { t: "論理エンドポイントの登録・管理", done: false },
        { t: "テレメトリ収集と対応率の集計", done: false },
      ],
      doc: "https://github.com/0x0c/spectre-ui/blob/main/docs/compatibility.md",
    },
    {
      id: "M4",
      title: "運用の成熟",
      weeks: [null, null],
      ongoing: true,
      track: "web",
      trackLabel: "継続",
      goal: "継続的な改善。期間の見積もりは置いていない。",
      acceptance: null,
      tasks: [
        { t: "段階公開 / A-Bテスト / セグメント配信", done: false },
        { t: "エディタ上の対応率フィードバック", done: false },
        { t: "パーシャルとテンプレート", done: false },
        { t: "HostSlot（ネイティブView埋め込み）", done: false },
        { t: "ページネーション、プルリフレッシュの高度化", done: false },
        { t: "緊急キルスイッチ", done: false },
      ],
      doc: "https://github.com/0x0c/spectre-ui/blob/main/docs/roadmap.md",
    },
  ],

  openQuestions: [
    {
      n: 1,
      title: "ホストアプリの現状",
      impact: "大",
      points: [
        "iOS は SwiftUI ベースか、UIKit ベースか。UIKit 中心なら UIHostingController の埋め込み境界（Safe Area、スクロール連動、サイズ確定）で追加の設計が要る。",
        "Android は Compose か View システムか。",
        "最低対応OSバージョン。iOS 16 / minSdk 24 を仮置きしているが、より高ければ実装が楽になる（Layout プロトコル、FlowRow など）。",
      ],
    },
    {
      n: 2,
      title: "UIを編集するのは誰か",
      impact: "大",
      points: [
        "非エンジニア（企画・CS）を想定してカタログを閉じ、式をピッカー中心に設計した。",
        "編集者がエンジニアのみなら、式の表現力を上げ、エディタをコードエディタ寄りにするほうが総コストは下がる。この場合 M2 のスコープが大きく減る。",
      ],
    },
    {
      n: 5,
      title: "適用範囲",
      impact: "中",
      points: [
        "「アプリ全体」か「特定の領域（キャンペーン、お知らせ、オンボーディング）」か。",
        "後者なら M0 のカタログをかなり小さくでき、全体で数ヶ月短縮できる。まず後者から始めることを強く推奨する。",
      ],
    },
    {
      n: 3,
      title: "既存のデザインシステム",
      impact: "中",
      points: [
        "既存のトークン定義（Figma Variables / Style Dictionary など）があれば、それを spec/tokens.json の情報源にする。ゼロから定義するのは避けたい。",
      ],
    },
    {
      n: 4,
      title: "バックエンドの言語・既存基盤",
      impact: "中",
      points: [
        "ADR-0007 で TypeScript/Fastify を選んだが、組織がJVM一色なら Kotlin/Spring も合理的（Android実装との共有が効く代わりに、エディタとの検証ロジック共有を失う）。",
        "既存のCDN、認証基盤、フィーチャーフラグ基盤、計測基盤との接続点。",
      ],
    },
    {
      n: 6,
      title: "更新頻度と規模",
      impact: "小",
      points: [
        "画面数、日次の公開回数、ピーク時のリクエスト数。CDN設計とキャッシュTTLに影響する。",
      ],
    },
    {
      n: 7,
      title: "オフライン要件",
      impact: "小",
      points: [
        "オフラインでの表示が必要な画面はあるか。アプリ同梱のフォールバックドキュメントをどこまで用意するか。",
      ],
    },
    {
      n: 8,
      title: "多言語対応",
      impact: "小",
      points: [
        "ドキュメント内に文言を直接持つのか、キーだけ持ってアプリ内の文言リソースを引くのか。",
        "前者は編集者が翻訳まで管理でき、後者は既存の翻訳ワークフローに乗る。現設計は前者を前提にしているが、t('key') 相当の関数を追加すれば後者も表現できる。",
      ],
    },
  ],

  risks: [
    {
      risk: "カタログの設計が不十分で、後から破壊的変更が必要になる",
      impact: "大",
      mitigation: "M0 の受け入れ基準を厳格にする。実画面3つで検証してから凍結",
    },
    {
      risk: "Web/iOS/Android の見た目がずれ、編集者が信用しなくなる",
      impact: "大",
      mitigation: "実機ミラーを M2 必須に。近似であることをUIで明示",
    },
    {
      risk: "古いアプリバージョンでの劣化が可視化されず、事故が起きる",
      impact: "大",
      mitigation: "テレメトリによる対応率をエディタに出す（M3/M4）",
    },
    {
      risk: "SDUI で表現できない要件が出て、結局ネイティブ実装に戻る",
      impact: "中",
      mitigation: "host アクションと HostSlot を逃げ道として最初から設計に入れてある",
    },
    {
      risk: "式が複雑化してドキュメントが読めなくなる",
      impact: "中",
      mitigation:
        "言語を意図的に弱く保つ。ネストに警告。ロジックはサーバへ、を原則にする",
    },
    {
      risk: "適合性のドリフト（Swift/Kotlin/TS の挙動差）",
      impact: "中",
      mitigation: "適合性コーパスとCI。閾値を超えたら KMP へ部分移行（ADR-0001 の再検討条件）",
    },
    {
      risk: "ドキュメント肥大による初回描画の遅延",
      impact: "小",
      mitigation:
        "ノード数上限、遅延描画、stale-while-revalidate、バンドル済みフォールバック",
    },
  ],

  nextActions: [
    "上記「未決事項」の 1・2・5 を確認する（設計への影響が大きい順）。",
    "置き換え対象の実画面を3つ選び、手書きJSONで表現しきれるか検証する。",
    "その結果でコンポーネントカタログ v0.1 を確定させ、M0 に入る。",
  ],

  stack: [
    { area: "iOS SDK", tech: "Swift 6 / SwiftUI (iOS 16+), Swift Package Manager" },
    { area: "Android SDK", tech: "Kotlin / Jetpack Compose (minSdk 24), Gradle" },
    { area: "UI定義形式", tech: "JSON + JSON Schema 2020-12" },
    { area: "式言語", tech: "独自 SpectreExpr（非チューリング完全）" },
    { area: "単一の情報源", tech: "spec/component-manifest.json + コード生成" },
    { area: "エディタ", tech: "React 19 + TypeScript + Vite + dnd-kit + Zustand/Immer" },
    { area: "バックエンド", tech: "Node 22 + Fastify + PostgreSQL(JSONB) + S3 + CDN" },
    { area: "画像読み込み", tech: "iOS: Nuke / Android: Coil" },
    { area: "整合性担保", tech: "言語非依存の適合性コーパス + プラットフォーム内スナップショットテスト" },
  ],

  docs: [
    {
      path: "docs/adr/README-ja.md",
      title: "ADR (アーキテクチャ決定記録)",
      desc: "1決定1ディレクトリ。文脈・選択肢・決定・根拠・代償・再検討のトリガー",
    },
    {
      path: "roadmaps/README-ja.md",
      title: "ロードマップ項目",
      desc: "1項目1ディレクトリ。マイルストーンと個別の作業を提案として記述",
    },
    {
      path: "docs/tech-selection.md",
      title: "技術選定の索引",
      desc: "前提として置いた制約、ADRの一覧、選定サマリ",
    },
    {
      path: "docs/architecture.md",
      title: "アーキテクチャ",
      desc: "全体構成、コンポーネント、データフロー",
    },
    {
      path: "docs/spec/schema.md",
      title: "スキーマ仕様 v0.1",
      desc: "UI定義ドキュメントのスキーマ",
    },
    {
      path: "docs/spec/components.md",
      title: "コンポーネントカタログ v0.1",
      desc: "カタログとデザイントークン",
    },
    {
      path: "docs/spec/expression.md",
      title: "式言語 SpectreExpr",
      desc: "式とデータバインディング",
    },
    {
      path: "docs/spec/actions.md",
      title: "アクション仕様",
      desc: "アクションとサーバ応答プロトコル",
    },
    { path: "docs/editor.md", title: "エディタ設計", desc: "Web WYSIWYGエディタ" },
    {
      path: "docs/compatibility.md",
      title: "互換性・配信戦略",
      desc: "バージョニング、前方互換、ロールバック",
    },
    {
      path: "docs/roadmap.md",
      title: "ロードマップ（原典）",
      desc: "このページの情報源",
    },
  ],
};
