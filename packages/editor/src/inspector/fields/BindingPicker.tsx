import { useMemo, useRef, useState } from 'react'
import { useDocumentStore } from '../../store/documentStore'
import { usePreviewEnv } from '../../store/previewStore'
import { collectPaths } from '../../expression/paths'
import { previewText } from '../../expression/interpolate'

interface BindingPickerProps {
  /**
   * `expression`: 値は `${data.x}` / `${state.y}` のような、まるごと1つの式の文字列
   * （`data`/`state` どちらのスコープかも選べる）。
   * `statePath`: 値は `qty` のような、`state` を起点とした素のパス文字列
   * （`bindTo` など `type: statePath` のプロパティ用。`${}` で包まない）。
   */
  mode: 'expression' | 'statePath'
  value: string
  onChange: (next: string) => void
}

type Scope = 'data' | 'state'

function parseValue(mode: 'expression' | 'statePath', value: string): { scope: Scope; path: string } {
  if (mode === 'statePath') return { scope: 'state', path: value }
  const match = /^\$\{(data|state)\.(.*)\}$/.exec(value)
  return { scope: match?.[1] === 'state' ? 'state' : 'data', path: match?.[2] ?? '' }
}

function formatValue(mode: 'expression' | 'statePath', scope: Scope, path: string): string {
  const trimmed = path.trim()
  return mode === 'statePath' ? trimmed : `\${${scope}.${trimmed}}`
}

/**
 * ピッカーモードのバインディングエディタ (SU-0003 Detailed design 項目3 前半)。
 * `data.`/`state.` のスコープを選び、サンプルデータの形から候補パスを出す。
 * テキストモード（CodeMirror 6 + SpectreExpr の文法によるハイライト・補完・エラー表示）は
 * この一巡目では見送っている — roadmap の Log を参照。
 *
 * `ExpressionField` はこのピッカーと、隣に生の `${...}` テキスト入力を同時に出す。生の方を
 * 直接編集されたときもピッカーの表示が古いままにならないよう、`value` の外部変化を
 * `scope`/`path` に追従させる。
 */
export function BindingPicker({ mode, value, onChange }: BindingPickerProps) {
  const doc = useDocumentStore((s) => s.document)
  const env = usePreviewEnv()

  const [local, setLocal] = useState(() => parseValue(mode, value))
  const lastValue = useRef(value)
  if (value !== lastValue.current) {
    lastValue.current = value
    setLocal(parseValue(mode, value))
  }
  const { scope, path } = local

  const suggestions = useMemo(() => {
    const root = scope === 'data' ? doc.data : doc.state
    return collectPaths(root, '').slice(0, 200)
  }, [doc.data, doc.state, scope])

  function commit(nextScope: Scope, nextPath: string) {
    setLocal({ scope: nextScope, path: nextPath })
    if (!nextPath.trim()) return
    const nextValue = formatValue(mode, nextScope, nextPath)
    lastValue.current = nextValue // 自分が出した変更で、直後に上の再同期が発火しないようにする
    onChange(nextValue)
  }

  const preview = path.trim() ? previewText(formatValue(mode, scope, path), { data: doc.data, state: doc.state, env }) : ''
  const listId = `binding-suggestions-${mode}`

  return (
    <div className="binding-picker">
      <div className="binding-picker-row">
        {mode === 'expression' && (
          <select value={scope} onChange={(e) => commit(e.target.value as Scope, path)} aria-label="スコープ">
            <option value="data">data</option>
            <option value="state">state</option>
          </select>
        )}
        <input
          list={listId}
          value={path}
          placeholder={mode === 'statePath' ? 'qty' : 'product.stock'}
          aria-label="パス"
          onChange={(e) => commit(scope, e.target.value)}
        />
      </div>
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {path.trim() && (
        <p className="field-hint">
          現在のサンプルデータでの評価結果: <code>{preview || '(空)'}</code>
        </p>
      )}
    </div>
  )
}
