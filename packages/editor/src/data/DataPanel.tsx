import { useRef, useState } from 'react'
import { checkResourceLimits, hasErrors } from '@spectre-ui/manifest/validate'
import { useDocumentStore } from '../store/documentStore'

/**
 * サンプルデータ管理 (SU-0003 Detailed design 項目5)。`data`/`state` は
 * SpectreDocument 自体のフィールドなので、他の編集操作と同じ `apply` 経路
 * (documentStore.updateDocumentField) を通り、undo/redo の対象にもなる。
 */
function JsonScopeEditor({ field, label }: { field: 'data' | 'state'; label: string }) {
  const document = useDocumentStore((s) => s.document)
  const value = document[field] as Record<string, unknown> | undefined
  const updateDocumentField = useDocumentStore((s) => s.updateDocumentField)
  const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2))
  const [error, setError] = useState<string | null>(null)
  const lastValue = useRef(value)

  // undo/redo やサンプルの読み込みなど、外部からの変更を textarea に反映する。
  if (value !== lastValue.current) {
    lastValue.current = value
    setText(JSON.stringify(value ?? {}, null, 2))
    setError(null)
  }

  function commit() {
    try {
      const parsed: unknown = JSON.parse(text)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('object required')
      }
      // docs/architecture.md §7: サンプルデータもドキュメントの一部としてエクスポート/公開
      // されうるので、貼り付けでドキュメント全体を上限超えに膨らませていないかをここでも見る。
      const limitIssues = checkResourceLimits({ ...document, [field]: parsed })
      if (hasErrors(limitIssues)) {
        setError(limitIssues.map((issue) => issue.message).join(' / '))
        return
      }
      updateDocumentField(field, parsed as Record<string, unknown>)
      setError(null)
    } catch {
      setError('JSON として読めません（オブジェクトである必要があります）')
    }
  }

  return (
    <div className="data-panel-scope">
      <div className="data-panel-scope-header">{label}</div>
      <textarea className="json-field data-panel-textarea" value={text} spellCheck={false} onChange={(e) => setText(e.target.value)} onBlur={commit} />
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}

export function DataPanel() {
  return (
    <div className="data-panel">
      <JsonScopeEditor field="data" label="data（サーバ提供・編集操作からは不変）" />
      <JsonScopeEditor field="state" label="state（クライアント状態の初期値）" />
    </div>
  )
}
