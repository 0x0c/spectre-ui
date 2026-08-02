// 自動生成 — 直接編集しないこと。
// 生成元: spec/component-manifest.json (manifestVersion 0.1.0)
// 再生成: node packages/codegen/generate.mjs
// spec/component-manifest.json (manifestVersion 0.1.0) から生成。

export const SCHEMA_VERSION = "1.0"
export const MANIFEST_VERSION = "0.1.0"

// -- トークン -----------------------------------------------------------------

export type ColorToken = "primary" | "onPrimary" | "primaryContainer" | "onPrimaryContainer" | "secondary" | "onSecondary" | "secondaryContainer" | "onSecondaryContainer" | "surface" | "onSurface" | "surfaceVariant" | "onSurfaceVariant" | "background" | "onBackground" | "outline" | "outlineVariant" | "error" | "onError" | "success" | "onSuccess" | "warning" | "onWarning" | "info" | "onInfo" | "transparent"
export type SpacingToken = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "xxl"
export type RadiusToken = "none" | "sm" | "md" | "lg" | "xl" | "full"
export type TypographyToken = "displayLg" | "displayMd" | "titleLg" | "titleMd" | "titleSm" | "bodyLg" | "bodyMd" | "bodySm" | "label" | "caption" | "overline"
export type ElevationToken = 0 | 1 | 2 | 3
export type IconToken = string

// -- 共通の枠組み (spec/schema/document.schema.json が情報源) ------------------

export type Expression = string
export type StatePath = string

export interface SpectreLayout {
  padding?: SpacingToken | Partial<Record<'top' | 'leading' | 'bottom' | 'trailing', SpacingToken>>
  margin?: SpacingToken | Partial<Record<'top' | 'leading' | 'bottom' | 'trailing', SpacingToken>>
  width?: 'fill' | 'wrap' | number
  height?: 'fill' | 'wrap' | number
  weight?: number
  alignSelf?: 'start' | 'center' | 'end' | 'stretch'
  aspectRatio?: number
}

export interface SpectreStyle {
  background?: ColorToken
  foreground?: ColorToken
  radius?: RadiusToken
  border?: { color: ColorToken; width?: number }
  elevation?: ElevationToken
  opacity?: number
}

export interface SpectreA11y {
  label?: Expression
  hint?: Expression
  role?: 'button' | 'image' | 'header' | 'link' | 'none'
  hidden?: boolean
  liveRegion?: 'off' | 'polite' | 'assertive'
}

export interface SpectreRepeat {
  for: Expression
  as?: string
  indexAs?: string
  key?: Expression
  limit?: number
  emptyView?: SpectreNode
}

export type SpectreActionType = "setState" | "toggleState" | "request" | "navigate" | "back" | "dismiss" | "showOverlay" | "dismissOverlay" | "openUrl" | "refresh" | "applyPatch" | "host" | "track" | "sequence" | "condition" | "delay" | "focus" | "scrollTo"

/**
 * アクションの共通形。type ごとの固有フィールドはマニフェストの対象外
 * (docs/spec/actions.md が情報源) — ここでは緩い型に留める。
 */
export interface SpectreAction {
  type: SpectreActionType
  continueOnError?: boolean
  required?: boolean
  fallbackActions?: SpectreAction[]
  [key: string]: unknown
}

// -- コンポーネントの props ----------------------------------------------------

export interface ScreenPropsAppBar {
  title?: string
  showBack?: boolean
  actions?: SpectreNode[]
}

export interface ScreenProps {
  background?: ColorToken
  scrollable?: boolean
  safeArea?: "all" | "top" | "bottom" | "none"
  appBar?: ScreenPropsAppBar | null
  /** スクロールに追従しない下部固定領域 */
  bottomBar?: SpectreNode | null
}

export interface VStackProps {
  spacing?: SpacingToken
  alignment?: "leading" | "center" | "trailing"
  distribution?: "packed" | "spaceBetween" | "spaceAround"
}

export interface HStackProps {
  spacing?: SpacingToken
  alignment?: "top" | "center" | "bottom" | "baseline"
  distribution?: "packed" | "spaceBetween" | "spaceAround"
  wrap?: boolean
}

export interface ZStackProps {
  alignment?: "topLeading" | "top" | "topTrailing" | "leading" | "center" | "trailing" | "bottomLeading" | "bottom" | "bottomTrailing"
}

export interface SpacerProps {
  minLength?: SpacingToken | null
}

export interface DividerProps {
  orientation?: "horizontal" | "vertical"
  inset?: SpacingToken
  color?: ColorToken
}

export interface ScrollViewProps {
  direction?: "vertical" | "horizontal"
  showsIndicator?: boolean
}

export interface ListProps {
  spacing?: SpacingToken
  separator?: boolean
  header?: SpectreNode | null
  footer?: SpectreNode | null
}

export interface GridProps {
  columns?: number | "adaptive"
  spacing?: SpacingToken
}

export interface CardProps {
  padding?: SpacingToken
  elevation?: 0 | 1 | 2 | 3
  radius?: RadiusToken
  onTap?: SpectreAction[]
}

export interface SectionPropsAction {
  label?: string
  actions?: SpectreAction[]
}

export interface SectionProps {
  title?: string | null
  subtitle?: string | null
  action?: SectionPropsAction | null
}

export interface TabsPropsItemsItem {
  id?: string
  label?: string
  icon?: IconToken | null
  badge?: string | null
}

export interface TabsProps {
  items?: TabsPropsItemsItem[] | string
  /** 選択中のタブ id を保持する state のパス */
  bindTo: string
  onChange?: SpectreAction[]
}

export interface TextProps {
  text: string
  typography?: TypographyToken
  color?: ColorToken
  align?: "start" | "center" | "end"
  weight?: "regular" | "medium" | "bold"
  maxLines?: number | null
  truncation?: "tail" | "middle" | "none"
  decoration?: "none" | "underline" | "strikethrough"
  selectable?: boolean
}

export interface ImageProps {
  url: string
  contentMode?: "fill" | "fit"
  aspectRatio?: number | null
  radius?: RadiusToken
  placeholder?: "shimmer" | "color" | "none"
  /** true なら a11y から隠す */
  decorative?: boolean
}

export interface IconProps {
  name: IconToken
  size?: "sm" | "md" | "lg"
  color?: ColorToken
}

export interface BadgeProps {
  text: string
  tone?: "neutral" | "info" | "success" | "warning" | "error"
  variant?: "filled" | "outlined"
}

export interface ProgressIndicatorProps {
  kind?: "linear" | "circular"
  /** null で不定形 */
  value?: number | string | null
  size?: "sm" | "md" | "lg"
}

export interface ButtonProps {
  label: string
  variant?: "primary" | "secondary" | "tertiary" | "text" | "destructive"
  size?: "sm" | "md" | "lg"
  leadingIcon?: IconToken | null
  trailingIcon?: IconToken | null
  enabled?: boolean | string
  loading?: boolean | string
  onTap?: SpectreAction[]
}

export interface TextFieldPropsValidation {
  required?: boolean
  pattern?: string | null
  minLength?: number | null
  maxLength?: number | null
  message?: string
}

export interface TextFieldProps {
  bindTo: string
  label?: string | null
  placeholder?: string | null
  helperText?: string | null
  errorText?: string | null
  keyboard?: "text" | "email" | "number" | "phone" | "url" | "password"
  multiline?: boolean
  maxLength?: number | null
  validation?: TextFieldPropsValidation | null
  debounceMs?: number
  onChange?: SpectreAction[]
  onSubmit?: SpectreAction[]
}

export interface ToggleProps {
  bindTo: string
  label?: string | null
  enabled?: boolean | string
  onChange?: SpectreAction[]
}

export interface CheckboxProps {
  bindTo: string
  label?: string | null
  enabled?: boolean | string
  onChange?: SpectreAction[]
}

export interface RadioGroupPropsOptionsItem {
  value?: string
  label?: string
  enabled?: boolean
}

export interface RadioGroupProps {
  bindTo: string
  options?: RadioGroupPropsOptionsItem[] | string
  orientation?: "vertical" | "horizontal"
  onChange?: SpectreAction[]
}

export interface SelectPropsOptionsItem {
  value?: string
  label?: string
  enabled?: boolean
}

export interface SelectProps {
  bindTo: string
  options?: SelectPropsOptionsItem[] | string
  label?: string | null
  placeholder?: string | null
  searchable?: boolean
  onChange?: SpectreAction[]
}

export interface SliderProps {
  bindTo: string
  min?: number
  max?: number
  step?: number
  showValue?: boolean
  onChange?: SpectreAction[]
}

export interface StepperProps {
  bindTo: string
  min?: number | string
  max?: number | string | null
  step?: number
  onChange?: SpectreAction[]
}

export interface DatePickerProps {
  /** ISO 8601 文字列 */
  bindTo: string
  mode?: "date" | "time" | "dateTime"
  label?: string | null
  min?: string | null
  max?: string | null
  displayFormat?: "short" | "medium" | "long"
  onChange?: SpectreAction[]
}

// -- ノード木 -------------------------------------------------------------------

export type SpectreNodeType = "Screen" | "VStack" | "HStack" | "ZStack" | "Spacer" | "Divider" | "ScrollView" | "List" | "Grid" | "Card" | "Section" | "Tabs" | "Text" | "Image" | "Icon" | "Badge" | "ProgressIndicator" | "Button" | "TextField" | "Toggle" | "Checkbox" | "RadioGroup" | "Select" | "Slider" | "Stepper" | "DatePicker"

interface SpectreNodeCommon {
  id?: string
  visibleWhen?: Expression
  repeat?: SpectreRepeat
  layout?: SpectreLayout
  style?: SpectreStyle
  a11y?: SpectreA11y
  fallback?: SpectreNode
  optional?: boolean
  children?: SpectreNode[]
}

export type SpectreNode = SpectreNodeCommon &
  (
  | { type: "Screen"; props: ScreenProps }
  | { type: "VStack"; props: VStackProps }
  | { type: "HStack"; props: HStackProps }
  | { type: "ZStack"; props: ZStackProps }
  | { type: "Spacer"; props: SpacerProps }
  | { type: "Divider"; props: DividerProps }
  | { type: "ScrollView"; props: ScrollViewProps }
  | { type: "List"; props: ListProps }
  | { type: "Grid"; props: GridProps }
  | { type: "Card"; props: CardProps }
  | { type: "Section"; props: SectionProps }
  | { type: "Tabs"; props: TabsProps }
  | { type: "Text"; props: TextProps }
  | { type: "Image"; props: ImageProps }
  | { type: "Icon"; props: IconProps }
  | { type: "Badge"; props: BadgeProps }
  | { type: "ProgressIndicator"; props: ProgressIndicatorProps }
  | { type: "Button"; props: ButtonProps }
  | { type: "TextField"; props: TextFieldProps }
  | { type: "Toggle"; props: ToggleProps }
  | { type: "Checkbox"; props: CheckboxProps }
  | { type: "RadioGroup"; props: RadioGroupProps }
  | { type: "Select"; props: SelectProps }
  | { type: "Slider"; props: SliderProps }
  | { type: "Stepper"; props: StepperProps }
  | { type: "DatePicker"; props: DatePickerProps }
  )

// -- ドキュメント ---------------------------------------------------------------

export interface SpectreDocument {
  schemaVersion: string
  id: string
  version?: string
  meta?: {
    title?: string
    statePolicy?: 'reset' | 'preserve'
    pullToRefresh?: boolean
    refreshIntervalSec?: number | null
  }
  data?: Record<string, unknown>
  state?: Record<string, unknown>
  root: SpectreNode
  overlays?: SpectreOverlay[]
  onAppear?: SpectreAction[]
  onDisappear?: SpectreAction[]
}

/**
 * オーバレイの見え方 (SU-0014)。kind が中身の形を決め、presentation が見え方を決める。
 * dismissOnBackdrop / dragToDismiss を省略したときは、そのオーバレイの dismissible に従う。
 */
export interface SpectrePresentation {
  style?: 'sheet' | 'fullScreen' | 'dialog'
  dimBackground?: boolean
  dismissOnBackdrop?: boolean
  dragToDismiss?: boolean
}

export type SpectreOverlay =
  | {
      id: string
      kind: 'sheet'
      root: SpectreNode
      detents?: ('small' | 'medium' | 'large')[]
      title?: Expression
      dismissible?: boolean
      presentation?: SpectrePresentation
    }
  | {
      id: string
      kind: 'alert'
      title?: Expression
      message?: Expression
      buttons: { label: Expression; role?: 'default' | 'cancel' | 'destructive'; actions?: SpectreAction[] }[]
      dismissible?: boolean
      tone?: 'neutral' | 'success' | 'warning' | 'error'
      icon?: IconToken
      buttonLayout?: 'auto' | 'horizontal' | 'vertical'
      presentation?: Pick<SpectrePresentation, 'dimBackground' | 'dismissOnBackdrop'>
    }
  | {
      id: string
      kind: 'toast'
      message?: Expression
      tone?: 'neutral' | 'success' | 'warning' | 'error'
      durationMs?: number
      dismissible?: boolean
    }

// -- limits (docs/architecture.md §5) ------------------------------------------

export const SpectreLimits = {
  maxNodes: 2000,
  maxDepth: 32,
  maxDocumentBytes: 1048576,
  maxExprAstNodes: 256,
  maxExprDepth: 32,
  maxRepeatItems: 500,
  maxActionsPerDispatch: 64,
  maxActionNesting: 8,
} as const
