import type { RawPropSpec } from '@spectre-ui/manifest/editor-schema'

/**
 * インスペクタのフィールド種別。docs/editor.md §2 の `editor.widget` 対応表がそのまま
 * 情報源 — マニフェストに `editor.widget` の指定がない場合だけ、`type` から妥当な既定を選ぶ
 * (指定がないプロパティの方が多いため、ここが実質的なフォールバック規則)。
 */
export type WidgetKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'colorToken'
  | 'spacingToken'
  | 'radiusToken'
  | 'typographyToken'
  | 'icon'
  | 'actions'
  | 'binding'
  | 'options'
  | 'object'
  | 'node'
  | 'expression'
  | 'json'

const KNOWN_WIDGETS = new Set<WidgetKind>([
  'text',
  'textarea',
  'number',
  'boolean',
  'enum',
  'colorToken',
  'spacingToken',
  'radiusToken',
  'typographyToken',
  'icon',
  'actions',
  'binding',
  'options',
  'object',
  'node',
  'expression',
  'json',
])

export function inferWidget(spec: RawPropSpec): WidgetKind {
  const explicit = spec.editor?.widget
  if (explicit && KNOWN_WIDGETS.has(explicit as WidgetKind)) return explicit as WidgetKind

  switch (spec.type) {
    case 'string':
      return 'text'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'enum':
      return 'enum'
    case 'colorToken':
      return 'colorToken'
    case 'spacingToken':
      return 'spacingToken'
    case 'radiusToken':
      return 'radiusToken'
    case 'typographyToken':
      return 'typographyToken'
    case 'iconToken':
      return 'icon'
    case 'actions':
      return 'actions'
    case 'statePath':
      return 'binding'
    case 'expression':
      return 'expression'
    case 'object':
      return 'object'
    case 'node':
      return 'node'
    case 'array': {
      const itemShape = spec.items?.shape
      if (itemShape && 'value' in itemShape && 'label' in itemShape) return 'options'
      return 'json'
    }
    // 'union' など、まだ専用ウィジェットを持たない型 — 生の JSON 編集に落ちる。これは
    // データを壊さない劣化経路であって欠落ではない (ADR-0006 の精神: 知らない形は
    // クラッシュではなく縮退させる)。
    default:
      return 'json'
  }
}
