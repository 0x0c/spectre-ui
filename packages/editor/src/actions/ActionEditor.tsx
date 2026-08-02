import { useRef, useState } from 'react'
import { actionCatalog, type ActionParamField } from './actionCatalog'

const CATALOG = actionCatalog()
const MAX_NESTING_WARNING_DEPTH = 3 // docs/spec/actions.md §5: 情報レベルの警告を出す目安

interface ActionEditorProps {
  value: unknown[] | undefined
  onChange: (next: unknown[]) => void
  depth?: number
}

/**
 * アクション配列をカードのリストとして編集する (SU-0003 Detailed design 項目4)。
 * `endpoint` はホストアプリ側の実装がまだないため、この一巡目では自由入力のまま —
 * 「サーバに登録済みの論理エンドポイント一覧から選ばせる」(docs/editor.md §4) は
 * packages/server 側にエンドポイントカタログが増えたときの follow-up。
 */
export function ActionEditor({ value, onChange, depth = 0 }: ActionEditorProps) {
  const actions = Array.isArray(value) ? value : []

  function updateAction(index: number, patch: Record<string, unknown>) {
    onChange(actions.map((a, i) => (i === index ? { ...(a as Record<string, unknown>), ...patch } : a)))
  }
  function removeAction(index: number) {
    onChange(actions.filter((_, i) => i !== index))
  }
  function moveAction(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= actions.length) return
    const next = [...actions]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }
  function addAction() {
    onChange([...actions, { type: CATALOG[0].name }])
  }

  return (
    <div className="action-editor">
      {depth >= MAX_NESTING_WARNING_DEPTH && actions.length > 0 && (
        <p className="field-hint">condition/sequence の入れ子が深くなっています（docs/spec/actions.md §5、上限は8段）。</p>
      )}
      {actions.map((raw, i) => {
        const action = raw as Record<string, unknown>
        const def = CATALOG.find((c) => c.name === action.type)
        return (
          <div key={i} className="action-card">
            <div className="action-card-header">
              <span className="action-card-index">{i + 1}.</span>
              <select value={typeof action.type === 'string' ? action.type : ''} onChange={(e) => updateAction(i, { type: e.target.value })}>
                {CATALOG.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                    {c.async ? ' (async)' : ''}
                  </option>
                ))}
              </select>
              <span className="action-card-buttons">
                <button type="button" aria-label="上へ移動" disabled={i === 0} onClick={() => moveAction(i, -1)}>
                  ↑
                </button>
                <button type="button" aria-label="下へ移動" disabled={i === actions.length - 1} onClick={() => moveAction(i, 1)}>
                  ↓
                </button>
                <button type="button" aria-label="このアクションを削除" onClick={() => removeAction(i)}>
                  ✕
                </button>
              </span>
            </div>
            {def && def.params.length > 0 && (
              <div className="action-card-params">
                {def.params.map((param) => (
                  <ActionParamInput key={param.name} param={param} value={action[param.name]} onChange={(v) => updateAction(i, { [param.name]: v })} depth={depth} />
                ))}
              </div>
            )}
            {!def && typeof action.type === 'string' && (
              <p className="field-hint">未知のアクション種別です。実機では無視されて次へ進みます (docs/spec/actions.md §5)。</p>
            )}
          </div>
        )
      })}
      <button type="button" onClick={addAction}>
        + アクションを追加
      </button>
    </div>
  )
}

function ActionParamInput({
  param,
  value,
  onChange,
  depth,
}: {
  param: ActionParamField
  value: unknown
  onChange: (v: unknown) => void
  depth: number
}) {
  switch (param.type) {
    case 'string':
    case 'expression':
      return (
        <label className="action-param">
          <span>{param.name}</span>
          <input value={typeof value === 'string' ? value : ''} placeholder={param.placeholder ?? (param.type === 'expression' ? '${...}' : undefined)} onChange={(e) => onChange(e.target.value)} />
        </label>
      )
    case 'number':
      return (
        <label className="action-param">
          <span>{param.name}</span>
          <input type="number" value={typeof value === 'number' ? value : ''} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
        </label>
      )
    case 'boolean':
      return (
        <label className="action-param action-param-inline">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
          <span>{param.name}</span>
        </label>
      )
    case 'enum':
      return (
        <label className="action-param">
          <span>{param.name}</span>
          <select value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value || undefined)}>
            <option value="" />
            {(param.enumValues ?? []).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      )
    case 'actions':
      return (
        <div className="action-param action-param-nested">
          <span>{param.name}</span>
          <ActionEditor value={value as unknown[] | undefined} onChange={onChange as (v: unknown[]) => void} depth={depth + 1} />
        </div>
      )
    case 'json':
    default:
      return <JsonParam name={param.name} value={value} onChange={onChange} />
  }
}

function JsonParam({ name, value, onChange }: { name: string; value: unknown; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2))
  const [error, setError] = useState<string | null>(null)
  // undo/redo など、外部から value が変わったら textarea の表示もそれに追従させる
  // (DataPanel.tsx の JsonScopeEditor と同じパターン)。
  const lastValue = useRef(value)
  if (value !== lastValue.current) {
    lastValue.current = value
    setText(JSON.stringify(value ?? {}, null, 2))
    setError(null)
  }
  return (
    <label className="action-param">
      <span>{name}</span>
      <textarea
        rows={3}
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
    </label>
  )
}
