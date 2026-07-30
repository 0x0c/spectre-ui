# UI定義ドキュメント スキーマ仕様 v0.1

対応する JSON Schema: [`spec/schema/document.schema.json`](../../spec/schema/document.schema.json)
サンプル: [`examples/screens/product-detail.json`](../../examples/screens/product-detail.json)

## 1. ドキュメント構造

```jsonc
{
  "schemaVersion": "1.0",          // 必須。major.minor
  "id": "product_detail",          // 必須。screenId
  "version": "01J8X...",           // 配信時にサーバが付与
  "meta": {
    "title": "商品詳細",
    "statePolicy": "reset",        // reset | preserve  再取得時のstate扱い
    "refresh": { "pullToRefresh": true, "intervalSec": null }
  },
  "data": { ... },                 // サーバ提供の不変データ
  "state": { ... },                // クライアント可変stateの初期値
  "root": { ...Node... },          // 必須。ルートノード
  "overlays": [ ...Overlay... ],   // シート・アラート・トースト定義
  "onAppear": [ ...Action... ],    // 画面表示時に実行
  "onDisappear": [ ...Action... ]
}
```

### `data` と `state` を分ける理由

- `data` はサーバが与えた事実。式から読めるが書けない。`request` の応答でのみ差し替わる。
- `state` はユーザ操作で変わる一時的な値（フォーム入力、開閉状態、選択中タブ）。`setState` で書き換える。

分けることで「サーバから来た値をうっかりクライアントが破壊する」ことを防ぎ、再取得時にどちらを保持するかを `statePolicy` で明確に選べる。

## 2. ノード

すべてのノードは以下の共通形をとる。

```jsonc
{
  "type": "Text",                  // 必須。マニフェストに定義されたコンポーネント名
  "id": "title",                   // 推奨。差分描画・テスト・計測の識別子
  "props": { ... },                // コンポーネント固有プロパティ
  "children": [ ...Node... ],      // 子を持てるコンポーネントのみ
  "layout": { ... },               // 親レイアウト内での振る舞い
  "style": { ... },                // トークンによる装飾
  "a11y": { ... },                 // アクセシビリティ
  "visibleWhen": "${...}",         // 式。false なら木から除外される
  "repeat": { ... },               // 反復
  "fallback": { ...Node... },      // 未対応クライアント向けの代替
  "optional": false                // true なら未対応時に省略してよい
}
```

`props` の値はすべて**式で置換可能**（[expression.md](expression.md)）。

### 2.1 `layout`

親のレイアウトコンテナに対する指示。値はすべてトークンまたは列挙。

| キー | 型 | 説明 |
| --- | --- | --- |
| `padding` | Spacing \| `{top,leading,bottom,trailing}` | 内側余白 |
| `margin` | Spacing \| `{...}` | 外側余白 |
| `width` | `"fill"` \| `"wrap"` \| number | number は dp/pt |
| `height` | `"fill"` \| `"wrap"` \| number | |
| `weight` | number | Stack内での伸長比 |
| `alignSelf` | `start`\|`center`\|`end`\|`stretch` | 交差軸方向の配置 |
| `aspectRatio` | number | |

**絶対座標指定はサポートしない。** レイアウトはStack + weight + alignment のみで表現する。画面サイズとフォントスケールの差異に耐えるための意図的な制約。

### 2.2 `style`

```jsonc
"style": {
  "background": "surfaceVariant",   // ColorToken
  "foreground": "onSurface",         // ColorToken
  "radius": "md",                    // RadiusToken
  "border": { "color": "outline", "width": 1 },
  "elevation": 1,                    // 0-3
  "opacity": 1.0
}
```

**任意の色コードは受け付けない。** トークン名のみ。理由:

- ダークモードとハイコントラスト設定に自動追従できる。
- ホストアプリのデザインシステムと乖離しない。
- エディタのカラーピッカーがトークン一覧になり、非エンジニアが破綻した配色を作れない。
- アクセシビリティのコントラスト比をトークン定義側で一度保証すれば済む。

### 2.3 `a11y`

```jsonc
"a11y": {
  "label": "カートに追加",
  "hint": "商品をカートに入れます",
  "role": "button",              // button|image|header|link|none
  "hidden": false,
  "liveRegion": "polite"         // off|polite|assertive
}
```

エディタのリントで、アイコンのみのボタン・装飾でない画像に `label` がない場合を**公開ブロッキングのエラー**として扱う。

### 2.4 `repeat`

```jsonc
{
  "type": "Card",
  "repeat": {
    "for": "${data.items}",      // 配列を返す式
    "as": "item",                // 要素のバインド名 (既定: "item")
    "indexAs": "index",          // インデックスのバインド名 (既定: "index")
    "key": "${item.id}",         // 差分描画用の安定キー。強く推奨
    "limit": 100,                // 任意。省略時は §5 の上限 500
    "emptyView": { ...Node... }  // 0件時に代わりに描画するノード
  },
  "children": [ ... ]
}
```

`repeat` はノード自身を反復する（子ではない）。ネストは2段までとする。

### 2.5 `visibleWhen`

式が真値を返さないノードは**木から除外される**（不可視で場所を占有するのではない）。空白を残したい場合は `Spacer` を併用する。

## 3. オーバレイ

シート・アラート・トーストは木の中に置かず、`overlays` に定義して `showOverlay` アクションでIDを指定して開く。

```jsonc
"overlays": [
  {
    "id": "size_picker",
    "kind": "sheet",             // sheet | alert | toast
    "detents": ["medium", "large"],   // sheet のみ
    "dismissible": true,
    "title": "サイズを選択",
    "root": { ...Node... }       // sheet のみ。alert/toast は宣言的なプロパティで表現
  },
  {
    "id": "confirm_delete",
    "kind": "alert",
    "title": "削除しますか?",
    "message": "この操作は取り消せません",
    "buttons": [
      { "label": "キャンセル", "role": "cancel", "actions": [] },
      { "label": "削除", "role": "destructive", "actions": [ ... ] }
    ]
  }
]
```

木の中にモーダルを埋めない理由: iOS/Android でモーダル表示の仕組みが大きく異なり、木の位置に依存させると挙動が揃わない。画面レベルの状態として扱うほうが両プラットフォームで一致させやすい。

## 4. ノード木の例

```jsonc
{
  "type": "VStack",
  "props": { "spacing": "md", "alignment": "leading" },
  "layout": { "padding": "md" },
  "children": [
    { "type": "Text",
      "props": { "text": "${data.product.name}", "typography": "titleLg", "maxLines": 2 } },
    { "type": "Text",
      "props": { "text": "${formatCurrency(data.product.price, 'JPY')}",
                 "typography": "titleMd" },
      "style": { "foreground": "primary" } },
    { "type": "Badge",
      "props": { "text": "在庫わずか", "tone": "warning" },
      "visibleWhen": "${data.product.stock > 0 && data.product.stock < 10}" },
    { "type": "Button",
      "id": "add_to_cart",
      "props": {
        "label": "カートに追加",
        "variant": "primary",
        "loading": "${state.adding}",
        "enabled": "${data.product.stock > 0}"
      },
      "layout": { "width": "fill" },
      "props.onTap": null
    }
  ]
}
```

> 注: 実際のアクションは `props.onTap` に配列で記述する（上記は構造の例示）。正しい記法は [actions.md](actions.md) を参照。

## 5. 検証

ドキュメントは3箇所で検証される。3つとも同じ実装（`packages/core`）を使う。

| タイミング | 検証内容 |
| --- | --- |
| エディタ (編集中) | JSON Schema + 参照整合性 + リント。リアルタイムに警告表示 |
| サーバ (公開時) | 同上 + 上限値 + 秘匿値混入チェック。**エラーがあれば公開を拒否** |
| クライアント (受信時) | 上限値 + 型の健全性のみ（軽量）。失敗時はキャッシュ済み旧版へフォールバック |

### リントルール (v0.1)

| ID | 重大度 | 内容 |
| --- | --- | --- |
| `a11y/missing-label` | error | アイコンのみのButton / 装飾でないImage にラベルがない |
| `a11y/contrast` | error | トークンの組み合わせがコントラスト比 4.5:1 を満たさない |
| `schema/unknown-prop` | error | マニフェストにないプロパティ |
| `expr/parse-error` | error | 式の構文エラー |
| `expr/unknown-path` | warn | `data`/`state` に存在しないパスの参照 |
| `repeat/missing-key` | warn | `repeat` に `key` がない |
| `node/missing-id` | warn | 対話的ノードに `id` がない（計測できない） |
| `compat/unsupported-component` | warn | 現在のユーザの N% で劣化する（実測値ベース、[compatibility.md](../compatibility.md)） |
| `security/inline-url` | error | `request` に論理名でなく絶対URLが書かれている |
| `security/possible-secret` | error | 文字列にトークン様の値が含まれる |
| `perf/node-count` | error | ノード数が上限超過 |

## 6. スキーマバージョン

`schemaVersion` は `major.minor`。

- **minor 増加** = 加算のみ（新コンポーネント、新プロパティ、新関数）。古いクライアントは未知部分を劣化処理する。
- **major 増加** = 破壊的変更。移行期間中はサーバが両メジャーを並行配信する。

詳細は [compatibility.md](../compatibility.md)。
