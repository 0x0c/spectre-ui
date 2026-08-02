import type { CSSProperties } from 'react'
import type { SpectreLayout, SpectreStyle } from '@spectre-ui/manifest/generated'
import { ELEVATION_SHADOWS, colorValue, radiusPx, spacingPx } from './tokens'

function paddingStyle(prefix: 'padding' | 'margin', value: SpectreLayout['padding']): CSSProperties {
  if (value === undefined) return {}
  if (typeof value === 'string') return { [prefix]: spacingPx(value) } as CSSProperties
  return {
    [`${prefix}Top`]: spacingPx(value.top),
    [`${prefix}Right`]: spacingPx(value.trailing),
    [`${prefix}Bottom`]: spacingPx(value.bottom),
    [`${prefix}Left`]: spacingPx(value.leading),
  } as CSSProperties
}

const ALIGN_SELF: Record<string, CSSProperties['alignSelf']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
}

/** SpectreLayout（トークン・stack内での配置指定）を、対応する CSS の断片に変換する。 */
export function layoutStyle(layout: SpectreLayout | undefined): CSSProperties {
  if (!layout) return {}
  const style: CSSProperties = {
    ...paddingStyle('padding', layout.padding),
    ...paddingStyle('margin', layout.margin),
  }
  if (layout.width === 'fill') style.width = '100%'
  else if (layout.width === 'wrap') style.width = 'fit-content'
  else if (typeof layout.width === 'number') style.width = layout.width

  if (layout.height === 'fill') style.height = '100%'
  else if (layout.height === 'wrap') style.height = 'fit-content'
  else if (typeof layout.height === 'number') style.height = layout.height

  if (layout.weight !== undefined) style.flexGrow = layout.weight
  if (layout.alignSelf) style.alignSelf = ALIGN_SELF[layout.alignSelf]
  if (layout.aspectRatio) style.aspectRatio = String(layout.aspectRatio)
  return style
}

/** SpectreStyle（見た目のトークン指定）を、プレビュー専用のトークン対応表を使って CSS に変換する。 */
export function visualStyle(style: SpectreStyle | undefined, theme: 'light' | 'dark'): CSSProperties {
  if (!style) return {}
  const css: CSSProperties = {}
  if (style.background) css.backgroundColor = colorValue(style.background, theme)
  if (style.foreground) css.color = colorValue(style.foreground, theme)
  if (style.radius) css.borderRadius = radiusPx(style.radius)
  if (style.border) {
    css.borderStyle = 'solid'
    css.borderWidth = style.border.width ?? 1
    css.borderColor = colorValue(style.border.color, theme)
  }
  if (style.elevation !== undefined) css.boxShadow = ELEVATION_SHADOWS[style.elevation]
  if (style.opacity !== undefined) css.opacity = style.opacity
  return css
}
