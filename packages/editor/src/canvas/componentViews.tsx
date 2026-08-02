import type { CSSProperties, ReactNode } from 'react'
import type {
  BadgeProps,
  ButtonProps,
  CardProps,
  CheckboxProps,
  DatePickerProps,
  DividerProps,
  GridProps,
  HStackProps,
  IconProps,
  ImageProps,
  ProgressIndicatorProps,
  RadioGroupProps,
  ScreenProps,
  SectionProps,
  SelectProps,
  SliderProps,
  SpectreNode,
  StepperProps,
  TabsProps,
  TextFieldProps,
  TextProps,
  ToggleProps,
  VStackProps,
  ZStackProps,
} from '@spectre-ui/manifest/generated'
import { evaluateCondition, interpolate, previewText, type InterpolationScope } from '../expression/interpolate'
import { iconGlyph } from './icons'
import { spacingPx, TYPOGRAPHY_VALUES, colorValue } from './tokens'

export interface RenderContext {
  scope: InterpolationScope
  theme: 'light' | 'dark'
  /** ヘッダ・下部固定領域など、この一巡目では選択/ドラッグの対象にしない静的スロット用。 */
  renderStatic: (node: SpectreNode | null | undefined | false) => ReactNode
}

function resolveMaybeExpr<T>(value: T | string | undefined, scope: InterpolationScope): T | string | undefined {
  if (typeof value !== 'string') return value
  return interpolate(value, scope) as T | string
}

function stateValue(bindTo: string | undefined, scope: InterpolationScope): unknown {
  if (!bindTo) return undefined
  return interpolate(`\${state.${bindTo}}`, scope)
}

/**
 * `env.fontScale` を実際のフォントサイズへ反映する。トークンの px 値は固定なので、
 * デバイス枠側の CSS `font-size: N%` だけでは（子要素が px 指定のため）連動しない —
 * ここで明示的に掛け合わせる。SU-0003 Detailed design 項目8「文字スケール200%での検証」の
 * 土台。
 */
function fontScaleOf(scope: InterpolationScope): number {
  const env = scope.env as { fontScale?: number } | undefined
  return typeof env?.fontScale === 'number' ? env.fontScale : 1
}

const DISTRIBUTION: Record<string, CSSProperties['justifyContent']> = {
  packed: 'flex-start',
  spaceBetween: 'space-between',
  spaceAround: 'space-around',
}

/** コンテナ系ノードの外枠に使う flex/grid の CSS。VStack/HStack/ZStack/Grid/List に対応する。 */
export function containerLayoutStyle(node: SpectreNode): CSSProperties {
  switch (node.type) {
    case 'VStack': {
      const p = node.props as VStackProps
      const align = p.alignment === 'leading' ? 'flex-start' : p.alignment === 'trailing' ? 'flex-end' : 'center'
      return {
        display: 'flex',
        flexDirection: 'column',
        gap: spacingPx(p.spacing),
        alignItems: align,
        justifyContent: DISTRIBUTION[p.distribution ?? 'packed'],
      }
    }
    case 'HStack': {
      const p = node.props as HStackProps
      const align = p.alignment === 'top' ? 'flex-start' : p.alignment === 'bottom' ? 'flex-end' : p.alignment === 'baseline' ? 'baseline' : 'center'
      return {
        display: 'flex',
        flexDirection: 'row',
        flexWrap: p.wrap ? 'wrap' : 'nowrap',
        gap: spacingPx(p.spacing),
        alignItems: align,
        justifyContent: DISTRIBUTION[p.distribution ?? 'packed'],
      }
    }
    case 'ZStack': {
      const p = node.props as ZStackProps
      return { display: 'grid', placeItems: zStackAlign(p.alignment) }
    }
    case 'Screen':
      return { display: 'flex', flexDirection: 'column', height: '100%' }
    case 'ScrollView': {
      const p = node.props as { direction?: string }
      return p.direction === 'horizontal'
        ? { display: 'flex', flexDirection: 'row', overflowX: 'auto' }
        : { display: 'flex', flexDirection: 'column', overflowY: 'auto' }
    }
    case 'List': {
      const p = node.props as { spacing?: string }
      return { display: 'flex', flexDirection: 'column', gap: spacingPx(p.spacing) }
    }
    case 'Grid': {
      const p = node.props as GridProps
      const columns = p.columns === 'adaptive' || p.columns === undefined ? 'repeat(auto-fill, minmax(96px, 1fr))' : `repeat(${p.columns}, 1fr)`
      return { display: 'grid', gridTemplateColumns: columns, gap: spacingPx(p.spacing) }
    }
    case 'Card':
    case 'Section':
    case 'Tabs':
      return { display: 'flex', flexDirection: 'column', gap: 8 }
    default:
      return {}
  }
}

function zStackAlign(alignment: ZStackProps['alignment']): string {
  switch (alignment) {
    case 'topLeading':
      return 'start start'
    case 'top':
      return 'start center'
    case 'topTrailing':
      return 'start end'
    case 'leading':
      return 'center start'
    case 'trailing':
      return 'center end'
    case 'bottomLeading':
      return 'end start'
    case 'bottom':
      return 'end center'
    case 'bottomTrailing':
      return 'end end'
    default:
      return 'center center'
  }
}

/** コンテナの「見出し」など、children の前後に足す装飾。子要素自体はここでは描かない。 */
export function ContainerChrome({ node, ctx, position }: { node: SpectreNode; ctx: RenderContext; position: 'before' | 'after' }): ReactNode {
  const theme = ctx.theme
  if (node.type === 'Screen' && position === 'before') {
    const p = node.props as ScreenProps
    if (!p.appBar) return null
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: `1px solid ${colorValue('outlineVariant', theme)}`, background: colorValue('surface', theme) }}>
        {p.appBar.showBack !== false && <span aria-hidden style={{ fontSize: 16 }}>‹</span>}
        <span style={{ fontWeight: 600, flex: 1, fontSize: 15, color: colorValue('onSurface', theme) }}>
          {previewText(p.appBar.title ?? '', ctx.scope)}
        </span>
        {(p.appBar.actions ?? []).map((action, i) => <span key={action.id ?? i}>{ctx.renderStatic(action)}</span>)}
      </div>
    )
  }
  if (node.type === 'Screen' && position === 'after') {
    const p = node.props as ScreenProps
    if (!p.bottomBar) return null
    return <div style={{ borderTop: `1px solid ${colorValue('outlineVariant', theme)}` }}>{ctx.renderStatic(p.bottomBar)}</div>
  }
  if (node.type === 'Section' && position === 'before') {
    const p = node.props as SectionProps
    if (!p.title && !p.subtitle) return null
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          {p.title && <div style={{ fontWeight: 700, fontSize: 15, color: colorValue('onSurface', theme) }}>{previewText(p.title, ctx.scope)}</div>}
          {p.subtitle && <div style={{ fontSize: 12, color: colorValue('onSurfaceVariant', theme) }}>{previewText(p.subtitle, ctx.scope)}</div>}
        </div>
        {p.action?.label && <span style={{ fontSize: 12, color: colorValue('primary', theme) }}>{previewText(p.action.label, ctx.scope)}</span>}
      </div>
    )
  }
  if (node.type === 'List' && position === 'before') {
    const p = node.props as { header?: SpectreNode | null }
    return p.header ? <>{ctx.renderStatic(p.header)}</> : null
  }
  if (node.type === 'List' && position === 'after') {
    const p = node.props as { footer?: SpectreNode | null }
    return p.footer ? <>{ctx.renderStatic(p.footer)}</> : null
  }
  if (node.type === 'Tabs' && position === 'before') {
    const p = node.props as TabsProps
    const items = resolveMaybeExpr(p.items, ctx.scope)
    const selected = stateValue(p.bindTo, ctx.scope)
    if (!Array.isArray(items)) return null
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        {items.map((item: { id?: string; label?: string }, i) => (
          <span
            key={item.id ?? i}
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 12,
              background: item.id === selected ? colorValue('primaryContainer', theme) : colorValue('surfaceVariant', theme),
              color: item.id === selected ? colorValue('onPrimaryContainer', theme) : colorValue('onSurfaceVariant', theme),
            }}
          >
            {item.label}
          </span>
        ))}
      </div>
    )
  }
  return null
}

/** 子を持たないコンポーネント（葉ノード）の中身。 */
export function LeafContent({ node, ctx }: { node: SpectreNode; ctx: RenderContext }): ReactNode {
  const theme = ctx.theme
  switch (node.type) {
    case 'Text': {
      const p = node.props as TextProps
      const typo = TYPOGRAPHY_VALUES[p.typography ?? 'bodyMd']
      return (
        <span
          style={{
            fontSize: typo.fontSize * fontScaleOf(ctx.scope),
            fontWeight: p.weight === 'bold' ? 700 : p.weight === 'medium' ? 600 : typo.fontWeight,
            lineHeight: typo.lineHeight,
            color: colorValue(p.color ?? 'onSurface', theme),
            textAlign: p.align === 'center' ? 'center' : p.align === 'end' ? 'right' : 'left',
            textDecoration: p.decoration === 'underline' ? 'underline' : p.decoration === 'strikethrough' ? 'line-through' : 'none',
            display: '-webkit-box',
            WebkitLineClamp: typeof p.maxLines === 'number' ? p.maxLines : undefined,
            WebkitBoxOrient: 'vertical',
            overflow: typeof p.maxLines === 'number' ? 'hidden' : undefined,
          }}
        >
          {previewText(p.text, ctx.scope)}
        </span>
      )
    }
    case 'Image': {
      const p = node.props as ImageProps
      const url = previewText(p.url, ctx.scope)
      return (
        <div
          style={{
            width: '100%',
            aspectRatio: p.aspectRatio ? String(p.aspectRatio) : undefined,
            borderRadius: p.radius ? undefined : 0,
            overflow: 'hidden',
            background: colorValue('surfaceVariant', theme),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {url ? (
            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: p.contentMode === 'fit' ? 'contain' : 'cover' }} />
          ) : (
            <span style={{ fontSize: 11, color: colorValue('onSurfaceVariant', theme) }}>image</span>
          )}
        </div>
      )
    }
    case 'Icon': {
      const p = node.props as IconProps
      const size = p.size === 'sm' ? 14 : p.size === 'lg' ? 24 : 18
      return <span style={{ fontSize: size, color: colorValue(p.color ?? 'onSurface', theme), lineHeight: 1 }}>{iconGlyph(p.name)}</span>
    }
    case 'Badge': {
      const p = node.props as BadgeProps
      const tone = p.tone ?? 'neutral'
      const bg = tone === 'neutral' ? 'surfaceVariant' : tone
      return (
        <span
          style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 999,
            background: colorValue(bg, theme),
            color: colorValue(tone === 'neutral' ? 'onSurfaceVariant' : `on${tone[0].toUpperCase()}${tone.slice(1)}`, theme),
            border: p.variant === 'outlined' ? `1px solid ${colorValue(bg, theme)}` : undefined,
          }}
        >
          {previewText(p.text, ctx.scope)}
        </span>
      )
    }
    case 'ProgressIndicator': {
      const p = node.props as ProgressIndicatorProps
      const raw = resolveMaybeExpr(p.value, ctx.scope)
      const value = typeof raw === 'number' ? Math.max(0, Math.min(1, raw)) : null
      if (p.kind === 'circular') {
        return <span style={{ fontSize: 12, color: colorValue('primary', theme) }}>{value === null ? '◌ …' : `◔ ${Math.round(value * 100)}%`}</span>
      }
      return (
        <div style={{ height: 4, borderRadius: 2, background: colorValue('surfaceVariant', theme), overflow: 'hidden' }}>
          <div style={{ height: '100%', width: value === null ? '40%' : `${value * 100}%`, background: colorValue('primary', theme) }} />
        </div>
      )
    }
    case 'Button': {
      const p = node.props as ButtonProps
      const enabledCond = evaluateCondition(p.enabled ?? true, ctx.scope)
      const loadingCond = evaluateCondition(p.loading ?? false, ctx.scope)
      const filled = p.variant === undefined || p.variant === 'primary'
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: p.size === 'sm' ? '4px 10px' : p.size === 'lg' ? '10px 18px' : '7px 14px',
            borderRadius: 8,
            fontSize: (p.size === 'sm' ? 12 : 14) * fontScaleOf(ctx.scope),
            fontWeight: 600,
            opacity: enabledCond.value ? 1 : 0.45,
            background: filled ? colorValue(p.variant === 'destructive' ? 'error' : 'primary', theme) : p.variant === 'secondary' ? colorValue('secondaryContainer', theme) : 'transparent',
            color: filled ? colorValue(p.variant === 'destructive' ? 'onError' : 'onPrimary', theme) : colorValue('primary', theme),
            border: p.variant === 'tertiary' ? `1px solid ${colorValue('outline', theme)}` : undefined,
            outline: !enabledCond.evaluated ? `1px dashed ${colorValue('warning', theme)}` : undefined,
          }}
          title={!enabledCond.evaluated || !loadingCond.evaluated ? 'fx: この式は近似プレビューでは評価されません' : undefined}
        >
          {p.leadingIcon && <span aria-hidden>{iconGlyph(p.leadingIcon)}</span>}
          {loadingCond.value && '… '}
          {previewText(p.label, ctx.scope)}
          {p.trailingIcon && <span aria-hidden>{iconGlyph(p.trailingIcon)}</span>}
        </span>
      )
    }
    case 'TextField': {
      const p = node.props as TextFieldProps
      const value = stateValue(p.bindTo, ctx.scope)
      return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
          {p.label && <span style={{ fontSize: 12, color: colorValue('onSurfaceVariant', theme) }}>{previewText(p.label, ctx.scope)}</span>}
          <span
            style={{
              display: 'block',
              padding: '8px 10px',
              borderRadius: 6,
              border: `1px solid ${colorValue('outline', theme)}`,
              fontSize: 14,
              color: value === undefined || value === '' ? colorValue('onSurfaceVariant', theme) : colorValue('onSurface', theme),
              background: colorValue('surface', theme),
            }}
          >
            {value !== undefined && value !== '' ? String(value) : previewText(p.placeholder ?? '', ctx.scope) || ' '}
          </span>
        </label>
      )
    }
    case 'Toggle':
    case 'Checkbox': {
      const p = node.props as ToggleProps | CheckboxProps
      const value = stateValue(p.bindTo, ctx.scope)
      const on = Boolean(value)
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: node.type === 'Toggle' ? 30 : 16,
              height: 16,
              borderRadius: node.type === 'Toggle' ? 999 : 4,
              background: on ? colorValue('primary', theme) : colorValue('surfaceVariant', theme),
              border: `1px solid ${colorValue('outline', theme)}`,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: node.type === 'Toggle' ? (on ? 'flex-end' : 'flex-start') : 'center',
              padding: 2,
              boxSizing: 'border-box',
            }}
          >
            {node.type === 'Toggle' ? (
              <span style={{ width: 12, height: 12, borderRadius: 999, background: colorValue('onPrimary', theme) }} />
            ) : (
              on && <span style={{ fontSize: 11, color: colorValue('onPrimary', theme) }}>✓</span>
            )}
          </span>
          {p.label && <span style={{ fontSize: 13, color: colorValue('onSurface', theme) }}>{previewText(p.label, ctx.scope)}</span>}
        </span>
      )
    }
    case 'RadioGroup':
    case 'Select': {
      const p = node.props as RadioGroupProps | SelectProps
      const options = resolveMaybeExpr(p.options, ctx.scope)
      const selected = stateValue(p.bindTo, ctx.scope)
      const list = Array.isArray(options) ? options : []
      return (
        <div style={{ display: 'flex', flexDirection: node.type === 'RadioGroup' && (p as RadioGroupProps).orientation === 'vertical' ? 'column' : 'row', flexWrap: 'wrap', gap: 6 }}>
          {list.map((opt: { value?: string; label?: string }, i) => (
            <span
              key={opt.value ?? i}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 12,
                border: `1px solid ${opt.value === selected ? colorValue('primary', theme) : colorValue('outline', theme)}`,
                background: opt.value === selected ? colorValue('primaryContainer', theme) : 'transparent',
                color: opt.value === selected ? colorValue('onPrimaryContainer', theme) : colorValue('onSurface', theme),
              }}
            >
              {opt.label ?? opt.value}
            </span>
          ))}
        </div>
      )
    }
    case 'Slider': {
      const p = node.props as SliderProps
      const value = Number(stateValue(p.bindTo, ctx.scope) ?? p.min ?? 0)
      const min = p.min ?? 0
      const max = p.max ?? 100
      const pct = max > min ? ((value - min) / (max - min)) * 100 : 0
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: colorValue('surfaceVariant', theme) }}>
            <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, borderRadius: 2, background: colorValue('primary', theme) }} />
          </div>
          {p.showValue && <span style={{ fontSize: 12 }}>{value}</span>}
        </div>
      )
    }
    case 'Stepper': {
      const p = node.props as StepperProps
      const value = stateValue(p.bindTo, ctx.scope)
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px solid ${colorValue('outline', theme)}`, borderRadius: 8, padding: '2px 8px' }}>
          <span>−</span>
          <span style={{ minWidth: 18, textAlign: 'center', fontSize: 13 }}>{value !== undefined ? String(value) : '0'}</span>
          <span>+</span>
        </span>
      )
    }
    case 'DatePicker': {
      const p = node.props as DatePickerProps
      const value = stateValue(p.bindTo, ctx.scope)
      return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {p.label && <span style={{ fontSize: 12, color: colorValue('onSurfaceVariant', theme) }}>{previewText(p.label, ctx.scope)}</span>}
          <span style={{ padding: '8px 10px', borderRadius: 6, border: `1px solid ${colorValue('outline', theme)}`, fontSize: 14 }}>
            {value ? String(value) : '—'}
          </span>
        </label>
      )
    }
    case 'Spacer': {
      const p = node.props as { minLength?: string | null }
      return <div style={{ flex: 1, minWidth: spacingPx(p.minLength ?? undefined), minHeight: spacingPx(p.minLength ?? undefined) }} />
    }
    case 'Divider': {
      const p = node.props as DividerProps
      const horizontal = (p.orientation ?? 'horizontal') === 'horizontal'
      return (
        <div
          style={
            horizontal
              ? { height: 1, width: '100%', background: colorValue(p.color ?? 'outlineVariant', theme) }
              : { width: 1, alignSelf: 'stretch', background: colorValue(p.color ?? 'outlineVariant', theme) }
          }
        />
      )
    }
    default:
      return <span style={{ fontSize: 11, color: colorValue('onSurfaceVariant', theme) }}>{node.type}</span>
  }
}

/** Card はタップ操作の視覚的な手がかりだけ、他の共通枠と別に足す（onTap の有無を目立たせる）。 */
export function cardChrome(node: SpectreNode): CSSProperties {
  if (node.type !== 'Card') return {}
  const p = node.props as CardProps
  return { cursor: (p.onTap?.length ?? 0) > 0 ? 'pointer' : 'default' }
}
