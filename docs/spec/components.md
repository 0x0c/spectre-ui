# コンポーネントカタログ v0.1

機械可読な定義は [`spec/component-manifest.json`](../../spec/component-manifest.json)。本ドキュメントはその人間向けの解説。

## 設計原則

1. **閉じた集合**。任意のコンポーネントをサーバから追加することはできない。追加はSDKのリリースを伴う。
2. **両プラットフォームに素直に写像できるものだけ入れる**。片方でしか自然に表現できないものは入れない。
3. **プロパティは列挙かトークンに寄せる**。自由な数値・色・フォント名は原則許さない。
4. コンポーネントは**意味**で名付ける（`PrimaryButton` ではなく `Button` + `variant: primary`）。

## デザイントークン

トークンの実体（実際の色値・フォント）はホストアプリが `SpectreTheme` として与える。ドキュメントはトークン名しか持たない。

### ColorToken

役割ベース。Material 3 の色役割に準拠し、SwiftUI 側でも同名で解決する。

```
primary, onPrimary, primaryContainer, onPrimaryContainer
secondary, onSecondary, secondaryContainer, onSecondaryContainer
surface, onSurface, surfaceVariant, onSurfaceVariant
background, onBackground
outline, outlineVariant
error, onError, success, onSuccess, warning, onWarning, info, onInfo
transparent
```

### SpacingToken

```
none=0  xs=4  sm=8  md=16  lg=24  xl=32  xxl=48
```

### TypographyToken

論理名のみ。実サイズはホストのテーマが与え、**OSのフォントスケール設定に追従する**（固定pxを許さない理由）。

```
displayLg, displayMd
titleLg, titleMd, titleSm
bodyLg, bodyMd, bodySm
label, caption, overline
```

### RadiusToken

```
none=0  sm=4  md=8  lg=16  xl=24  full
```

### IconToken

SF Symbols と Material Symbols は名前も字形も一致しないため、**独自のアイコン名前空間**を定義し、各プラットフォームで対応表を持つ。v0.1 は約80個。

```
chevron.right, chevron.left, chevron.up, chevron.down,
close, check, plus, minus, search, filter, sort,
heart, heart.fill, star, star.fill, share, cart, user,
info, warning, error, success, lock, calendar, clock, location,
camera, image, trash, edit, more.horizontal, more.vertical, ...
```

---

## レイアウト

### `Screen`
ルートに1つだけ置ける最上位コンテナ。

| prop | 型 | 既定 | 説明 |
| --- | --- | --- | --- |
| `background` | ColorToken | `background` | |
| `scrollable` | boolean | `true` | false で固定レイアウト |
| `safeArea` | `all`\|`top`\|`bottom`\|`none` | `all` | |
| `appBar` | AppBar? | null | タイトル・戻る・右側アクション |
| `bottomBar` | Node? | null | スクロールに追従しない下部固定領域 |

`children`: 任意のノード（1つ）

### `VStack` / `HStack`

| prop | 型 | 既定 |
| --- | --- | --- |
| `spacing` | SpacingToken | `none` |
| `alignment` | VStack: `leading`\|`center`\|`trailing`, HStack: `top`\|`center`\|`bottom`\|`baseline` | `leading` / `center` |
| `distribution` | `packed`\|`spaceBetween`\|`spaceAround` | `packed` |
| `wrap` | boolean (HStackのみ) | `false` |

### `ZStack`
`alignment`: 9方位。子は宣言順に重なる。

### `Spacer`
`minLength`: SpacingToken?。Stack内で余白を吸収する。

### `Divider`
`orientation`: `horizontal`\|`vertical`、`inset`: SpacingToken。

### `ScrollView`
`direction`: `vertical`\|`horizontal`、`showsIndicator`: boolean。
`Screen.scrollable` があるため、入れ子スクロールが必要な場合のみ使う。**縦スクロールの入れ子はエディタで警告**する。

### `List`
遅延描画される縦方向コレクション。`LazyVStack` / `LazyColumn` に写像。

| prop | 型 | 既定 |
| --- | --- | --- |
| `spacing` | SpacingToken | `none` |
| `separator` | boolean | `false` |
| `header` / `footer` | Node? | null |

要素は `children`（静的）または子ノードの `repeat`（データ駆動）で与える。

### `Grid`
`columns`: number (1–4) または `adaptive`、`spacing`: SpacingToken。遅延描画。

### `Card`
`padding`: SpacingToken (既定 `md`)、`elevation`: 0–3、`radius`: RadiusToken (既定 `md`)、`onTap`: Action[]。

### `Section`
`title`: string?、`subtitle`: string?、`action`: `{label, actions}`? （右上のテキストボタン）。

### `Tabs`
`items`: `[{id, label, icon?, badge?}]`、`selectedId`: 式（`state` にバインド）、`onChange`: Action[]。
`children` の各要素が各タブの内容に対応する。

---

## コンテンツ表示

### `Text`

| prop | 型 | 既定 |
| --- | --- | --- |
| `text` | string (式可) | 必須 |
| `typography` | TypographyToken | `bodyMd` |
| `color` | ColorToken | `onSurface` |
| `align` | `start`\|`center`\|`end` | `start` |
| `maxLines` | number? | null |
| `truncation` | `tail`\|`middle`\|`none` | `tail` |
| `weight` | `regular`\|`medium`\|`bold` | `regular` |
| `decoration` | `none`\|`underline`\|`strikethrough` | `none` |
| `selectable` | boolean | `false` |

インライン装飾（部分的な太字・リンク）は v0.1 では**サポートしない**。必要になった場合は `RichText` を別コンポーネントとして追加する（HTML/Markdownを解釈させると両プラットフォームの一致が崩れるため、構造化された span 配列で表現する）。

### `Image`

| prop | 型 | 既定 |
| --- | --- | --- |
| `url` | string (式可) | 必須 |
| `contentMode` | `fill`\|`fit` | `fill` |
| `aspectRatio` | number? | null |
| `radius` | RadiusToken | `none` |
| `placeholder` | `shimmer`\|`color`\|`none` | `shimmer` |
| `decorative` | boolean | `false` （true なら a11y から隠す） |

URLは**画像ホストのアロウリスト**で検証する。iOSは Nuke、Androidは Coil でキャッシュする。

### `Icon`
`name`: IconToken、`size`: `sm`(16)\|`md`(24)\|`lg`(32)、`color`: ColorToken。

### `Badge`
`text`: string、`tone`: `neutral`\|`info`\|`success`\|`warning`\|`error`、`variant`: `filled`\|`outlined`。

### `ProgressIndicator`
`kind`: `linear`\|`circular`、`value`: number? （null で不定形）、`size`: `sm`\|`md`\|`lg`。

---

## 入力

すべての入力コンポーネントは `bindTo`（`state` へのパス）を持ち、双方向バインドされる。

### `Button`

| prop | 型 | 既定 |
| --- | --- | --- |
| `label` | string | 必須（アイコンのみの場合は空 + `a11y.label` 必須） |
| `variant` | `primary`\|`secondary`\|`tertiary`\|`text`\|`destructive` | `primary` |
| `size` | `sm`\|`md`\|`lg` | `md` |
| `leadingIcon` / `trailingIcon` | IconToken? | null |
| `enabled` | boolean (式可) | `true` |
| `loading` | boolean (式可) | `false` |
| `onTap` | Action[] | `[]` |

`loading` が真のあいだタップは無効化される。連打防止はSDKが自動で行う（[architecture.md](../architecture.md) §2）。

### `TextField`

| prop | 型 | 既定 |
| --- | --- | --- |
| `bindTo` | StatePath | 必須 |
| `label` / `placeholder` / `helperText` | string? | null |
| `keyboard` | `text`\|`email`\|`number`\|`phone`\|`url`\|`password` | `text` |
| `multiline` | boolean | `false` |
| `maxLength` | number? | null |
| `validation` | `{pattern?, required?, minLength?, maxLength?, message}` | null |
| `errorText` | string? (式可) | null |
| `onChange` / `onSubmit` | Action[] | `[]` |

`onChange` は入力の**デバウンス後**（既定300ms）に発火する。1文字ごとにサーバへ飛ばさないための既定値。

### `Toggle` / `Checkbox`
`bindTo`: StatePath、`label`: string?、`enabled`: boolean、`onChange`: Action[]。

### `RadioGroup`
`bindTo`、`options`: `[{value, label, enabled?}]`（式可）、`orientation`: `vertical`\|`horizontal`。

### `Select`
`bindTo`、`options`（同上）、`placeholder`、`searchable`: boolean。
iOSは Menu / Picker、Androidは ExposedDropdownMenu に写像。`searchable` が真なら両者ともボトムシートに切り替える。

### `Slider`
`bindTo`、`min`、`max`、`step`、`showValue`: boolean。

### `Stepper`
`bindTo`、`min`、`max`、`step` (既定1)。

### `DatePicker`
`bindTo`（ISO 8601文字列）、`mode`: `date`\|`time`\|`dateTime`、`min`/`max`: string?、`displayFormat`: string?。

---

## v0.1 に**入れない**もの（意図的な除外）

| 候補 | 除外理由 |
| --- | --- |
| WebView / HTML埋め込み | SDUIの意味がなくなる。必要なら `host` アクションでホストアプリの画面へ |
| 任意のCSS/スタイル文字列 | プラットフォーム間の一致が保証できない |
| 絶対座標レイアウト | 画面サイズ・フォントスケールに耐えない |
| 独自アニメーション定義 | 標準の遷移のみサポート。表現力より一貫性を優先 |
| Video / Map / Chart | それぞれ依存が重い。`host` アクションによる差し込み（`HostSlot`）で対応する方針を v0.2 で検討 |
| ネストしたリストの無限スクロール | ページネーションは v0.2。まず `List` + `loadMore` アクションで検討 |

### `HostSlot` (v0.2 候補)

ホストアプリが登録したネイティブViewを、指定した位置に埋め込むための穴。
`slotId` + `params` を渡し、ホストが対応するViewを返す。地図・動画・広告・決済ウィジェットなど、SDUIで表現すべきでないものの逃げ道。
エディタ上ではプレースホルダとして表示する。

---

## プラットフォーム写像表（抜粋）

| Spectre | SwiftUI | Jetpack Compose |
| --- | --- | --- |
| `VStack` | `VStack` | `Column` |
| `HStack` | `HStack` (wrap時 `Layout`) | `Row` / `FlowRow` |
| `ZStack` | `ZStack` | `Box` |
| `List` | `LazyVStack` in `ScrollView` | `LazyColumn` |
| `Grid` | `LazyVGrid` | `LazyVerticalGrid` |
| `Card` | `RoundedRectangle` background | `Card` |
| `Text` | `Text` | `Text` |
| `Image` | `LazyImage` (Nuke) | `AsyncImage` (Coil) |
| `Button` | `Button` + カスタム `ButtonStyle` | `Button` / `OutlinedButton` / `TextButton` |
| `TextField` | `TextField` / `SecureField` | `OutlinedTextField` |
| `Toggle` | `Toggle` | `Switch` |
| `Select` | `Menu` / `.sheet` | `ExposedDropdownMenuBox` / `ModalBottomSheet` |
| `Tabs` | `TabView` (page style以外) | `TabRow` + `HorizontalPager` |
| overlay `sheet` | `.sheet` / `.presentationDetents` | `ModalBottomSheet` |
| overlay `alert` | `.alert` | `AlertDialog` |
| overlay `toast` | カスタムオーバレイ | `Snackbar` |
