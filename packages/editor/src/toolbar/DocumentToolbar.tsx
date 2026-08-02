import { useRef } from 'react'
import { checkResourceLimits, hasErrors } from '@spectre-ui/manifest/validate'
import type { SpectreDocument } from '@spectre-ui/manifest/generated'
import { EMPTY_DOCUMENT, useDocumentStore } from '../store/documentStore'
import productDetail from '../sample/productDetail'

/** インポートされた JSON が、少なくとも `loadDocument` に安全に渡せる最低限の形をしているか。 */
function looksLikeDocument(value: unknown): value is SpectreDocument {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.schemaVersion === 'string' &&
    typeof record.id === 'string' &&
    typeof record.root === 'object' &&
    record.root !== null
  )
}

/**
 * このパスではエディタをオフライン（ローカル/サンプルドキュメントに対して）で使えることを
 * 主な動線にしている — packages/server の認証つきオーサリング API への実配線は
 * 今回のスコープ外 (roadmap の Log 参照)。ここではインポート/エクスポートと、
 * 同梱サンプル (examples/screens/product-detail.json) の読み込みだけを提供する。
 */
export function DocumentToolbar() {
  const doc = useDocumentStore((s) => s.document)
  const loadDocument = useDocumentStore((s) => s.loadDocument)
  const lastError = useDocumentStore((s) => s.lastError)
  const clearError = useDocumentStore((s) => s.clearError)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function exportJson() {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = window.document.createElement('a')
    anchor.href = url
    anchor.download = `${doc.id || 'document'}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function importJsonFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result))
        // `checkResourceLimits` は意図的に軽量で、`root` が欠けていても構造エラーにはしない
        // (packages/manifest/src/validate.ts のコメント通り、上限だけを見る版)。ここで先に
        // 最低限の形（schemaVersion/id/root）を確認しておかないと、`loadDocument` の内部で
        // ルートノードに触れた瞬間にクラッシュする。
        if (!looksLikeDocument(parsed)) {
          window.alert('SpectreUI のドキュメントとして読めません（schemaVersion / id / root が必要です）')
          return
        }
        // docs/architecture.md §7 の上限を、インポート経路でも強制する — 大きすぎる/深すぎる
        // ドキュメントをそのまま store に載せてしまうと、キャンバスが固まる形で壊れる。
        const issues = checkResourceLimits(parsed)
        if (hasErrors(issues)) {
          window.alert(`インポートできません:\n${issues.map((i) => `- ${i.message}`).join('\n')}`)
          return
        }
        loadDocument(parsed)
      } catch {
        window.alert('JSON として読み込めませんでした')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="document-toolbar">
      <span className="document-title">{doc.meta?.title ?? doc.id}</span>
      <button type="button" onClick={() => loadDocument(EMPTY_DOCUMENT)}>
        新規
      </button>
      <button type="button" onClick={() => loadDocument(productDetail)}>
        サンプルを開く（商品詳細）
      </button>
      <button type="button" onClick={exportJson}>
        エクスポート (JSON)
      </button>
      <button type="button" onClick={() => fileInputRef.current?.click()}>
        インポート (JSON)
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) importJsonFile(file)
          e.target.value = ''
        }}
      />
      {lastError && (
        <button type="button" className="toolbar-error" onClick={clearError}>
          {lastError} ✕
        </button>
      )}
    </div>
  )
}
