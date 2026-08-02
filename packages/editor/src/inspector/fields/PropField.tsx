import { useRef, useState } from 'react'
import { Controller, type Control } from 'react-hook-form'
import type { RawPropSpec } from '@spectre-ui/manifest/editor-schema'
import { inferWidget, type WidgetKind } from '../../manifest/widgets'
import { editorManifest } from '../../manifest/editorManifest'
import { colorValue } from '../../canvas/tokens'
import { OptionsTable } from './OptionsTable'
import { BindingPicker } from './BindingPicker'
import { ActionsField } from './ActionsField'

export interface PropFieldProps {
  control: Control<Record<string, unknown>>
  path: string[]
  spec: RawPropSpec
  label: string
  commit: (path: string[], value: unknown) => void
}

/**
 * マニフェストの1プロパティから、対応するインスペクタのフィールドを組み立てる
 * (SU-0003 Detailed design 項目1)。ウィジェット選択は `inferWidget`
 * (`spec/component-manifest.json` の `editor.widget`、なければ `type` から既定を選ぶ)。
 */
export function PropField({ control, path, spec, label, commit }: PropFieldProps) {
  const widget = inferWidget(spec)
  const name = path.join('.')

  if (widget === 'actions') {
    return (
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <ActionsField
            label={label}
            value={field.value as unknown[] | undefined}
            onChange={(next) => {
              field.onChange(next)
              commit(path, next)
            }}
          />
        )}
      />
    )
  }

  if (widget === 'object' && spec.shape) {
    return (
      <fieldset className="prop-fieldset">
        <legend>{label}</legend>
        {Object.entries(spec.shape).map(([key, childSpec]) => (
          <PropField key={key} control={control} path={[...path, key]} spec={childSpec} label={key} commit={commit} />
        ))}
      </fieldset>
    )
  }

  if (widget === 'node') {
    return (
      <p className="field-hint">
        {label}: 子ノードのスロットです。この一巡目ではキャンバスのドラッグ&ドロップ対象外 — 必要ならサンプル/JSON 側で編集してください。
      </p>
    )
  }

  if (widget === 'binding') {
    return (
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <div className="field">
            <label>{label}</label>
            <BindingPicker
              mode="statePath"
              value={typeof field.value === 'string' ? field.value : ''}
              onChange={(v) => {
                field.onChange(v)
                commit(path, v)
              }}
            />
          </div>
        )}
      />
    )
  }

  const expressionCapable = spec.expression === true
  const alwaysExpression = widget === 'expression'

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <ExpressionField
          label={label}
          widget={widget}
          spec={spec}
          value={field.value}
          expressionCapable={expressionCapable}
          alwaysExpression={alwaysExpression}
          onChange={(v) => {
            field.onChange(v)
            commit(path, v)
          }}
        />
      )}
    />
  )
}

function isBoundExpression(value: unknown): boolean {
  return typeof value === 'string' && /^\$\{[\s\S]*\}$/.test(value)
}

function ExpressionField({
  label,
  widget,
  spec,
  value,
  expressionCapable,
  alwaysExpression,
  onChange,
}: {
  label: string
  widget: WidgetKind
  spec: RawPropSpec
  value: unknown
  expressionCapable: boolean
  alwaysExpression: boolean
  onChange: (value: unknown) => void
}) {
  // `fx` はマウント時の値から初期化するだけで、その後の外部由来の変更（undo/redo など）に
  // 追従させない — 追従させようとすると、リテラルの文字列をちょうど手で `${` から書き始めた
  // 瞬間に勝手にピッカーへ切り替わるような、入力中の驚きを生む。トグルは常にユーザ操作。
  const [fx, setFx] = useState(alwaysExpression || isBoundExpression(value))

  if (alwaysExpression) {
    return (
      <div className="field">
        <label>
          {label} <span className="fx-badge">fx</span>
        </label>
        <input
          value={typeof value === 'string' ? value : ''}
          placeholder="${data.product.stock > 0}"
          onChange={(e) => onChange(e.target.value)}
        />
        <p className="field-hint">
          単純な <code>data.x</code> / <code>state.y</code> パスはピッカーから選べます。演算子・関数を含む式はここに直接
          入力してください（この近似プレビューでは単純パスしか評価できません）。
        </p>
        <BindingPicker mode="expression" value={typeof value === 'string' ? value : ''} onChange={onChange} />
      </div>
    )
  }

  return (
    <div className="field">
      <div className="field-label-row">
        <label>{label}</label>
        {expressionCapable && (
          <button type="button" className={`fx-toggle${fx ? ' fx-toggle-active' : ''}`} aria-pressed={fx} onClick={() => setFx((v) => !v)}>
            fx
          </button>
        )}
      </div>
      {fx ? (
        <>
          <input value={typeof value === 'string' ? value : ''} placeholder="${data....}" onChange={(e) => onChange(e.target.value)} />
          <BindingPicker mode="expression" value={typeof value === 'string' ? value : ''} onChange={onChange} />
        </>
      ) : (
        <BaseWidget widget={widget} spec={spec} value={value} onChange={onChange} />
      )}
    </div>
  )
}

function BaseWidget({ widget, spec, value, onChange }: { widget: WidgetKind; spec: RawPropSpec; value: unknown; onChange: (v: unknown) => void }) {
  switch (widget) {
    case 'text':
      return <input value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />
    case 'textarea':
      return <textarea rows={3} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />
    case 'number':
      return (
        <input
          type="number"
          value={typeof value === 'number' ? value : ''}
          min={spec.min}
          max={spec.max}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      )
    case 'boolean':
      return <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
    case 'enum': {
      const values = spec.values ?? []
      if (values.length > 0 && values.length <= 3) {
        return (
          <div className="segmented" role="group">
            {values.map((v) => (
              <button
                key={String(v)}
                type="button"
                className={`segmented-option${value === v ? ' segmented-active' : ''}`}
                onClick={() => onChange(v)}
              >
                {String(v)}
              </button>
            ))}
          </div>
        )
      }
      return (
        <select value={value === undefined ? '' : String(value)} onChange={(e) => onChange(coerceEnumValue(e.target.value, values))}>
          {values.map((v) => (
            <option key={String(v)} value={String(v)}>
              {String(v)}
            </option>
          ))}
        </select>
      )
    }
    case 'colorToken':
      return (
        <div className="token-swatches">
          {editorManifest.tokens.color.map((token) => (
            <button
              key={token}
              type="button"
              title={token}
              aria-pressed={value === token}
              className={`swatch${value === token ? ' swatch-active' : ''}`}
              style={{ background: colorValue(token, 'light') }}
              onClick={() => onChange(token)}
            />
          ))}
        </div>
      )
    case 'spacingToken':
      return <TokenChips tokens={Object.keys(editorManifest.tokens.spacing)} value={value} onChange={onChange} />
    case 'radiusToken':
      return <TokenChips tokens={Object.keys(editorManifest.tokens.radius)} value={value} onChange={onChange} />
    case 'typographyToken':
      return <TokenChips tokens={editorManifest.tokens.typography} value={value} onChange={onChange} />
    case 'icon':
      return <input value={typeof value === 'string' ? value : ''} placeholder="star.fill" onChange={(e) => onChange(e.target.value)} />
    case 'options':
      return <OptionsTable value={value} onChange={onChange as (v: unknown[]) => void} />
    default:
      return <JsonField value={value} onChange={onChange} />
  }
}

function coerceEnumValue(raw: string, values: (string | number)[]): string | number {
  const match = values.find((v) => String(v) === raw)
  return match ?? raw
}

function TokenChips({ tokens, value, onChange }: { tokens: string[]; value: unknown; onChange: (v: string) => void }) {
  return (
    <div className="token-chips">
      {tokens.map((token) => (
        <button
          key={token}
          type="button"
          className={`chip${value === token ? ' chip-active' : ''}`}
          onClick={() => onChange(token)}
        >
          {token}
        </button>
      ))}
    </div>
  )
}

function JsonField({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? null, null, 2))
  const [error, setError] = useState<string | null>(null)
  // undo/redo など、外部から value が変わったら textarea の表示もそれに追従させる
  // (DataPanel.tsx の JsonScopeEditor と同じパターン)。
  const lastValue = useRef(value)
  if (value !== lastValue.current) {
    lastValue.current = value
    setText(JSON.stringify(value ?? null, null, 2))
    setError(null)
  }

  return (
    <div>
      <textarea
        rows={4}
        className="json-field"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          try {
            onChange(JSON.parse(text))
            setError(null)
          } catch {
            setError('JSON として読めません')
          }
        }}
      />
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}
