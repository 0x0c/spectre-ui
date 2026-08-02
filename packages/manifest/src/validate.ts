import type { SpectreManifest } from './manifest'
import { SpectreLimits } from './generated'

export interface ValidationIssue {
  path: string
  message: string
  severity: 'error' | 'warning'
}

/**
 * ドキュメントの構造的な検証: 未知コンポーネント、必須フィールド、
 * docs/architecture.md §5 の上限値。
 *
 * これは式 (SpectreExpr) の構文までは検証しない — 評価器の TypeScript 移植は
 * まだない (SU-0007 の TS ハーネス項目)。ここでの「合格」は「クライアントが
 * 少なくともクラッシュせずに解決できる形をしている」ことの保証であって、
 * 式が正しく書けていることの保証ではない。
 */
export function validateDocument(doc: unknown, manifest: SpectreManifest): ValidationIssue[] {
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    return [{ path: '', message: 'ドキュメントのトップレベルはオブジェクトです', severity: 'error' }]
  }
  const record = doc as Record<string, unknown>
  const issues: ValidationIssue[] = []

  if (typeof record.schemaVersion !== 'string') {
    issues.push({ path: 'schemaVersion', message: 'schemaVersion がありません', severity: 'error' })
  }
  if (typeof record.id !== 'string') {
    issues.push({ path: 'id', message: 'id がありません', severity: 'error' })
  }
  if (typeof record.root !== 'object' || record.root === null) {
    issues.push({ path: 'root', message: 'root がありません', severity: 'error' })
    return issues
  }

  const byteLength = utf8ByteLength(JSON.stringify(doc))
  if (byteLength > SpectreLimits.maxDocumentBytes) {
    issues.push({
      path: '',
      message: `ドキュメントが上限 ${SpectreLimits.maxDocumentBytes} バイトを超えています (${byteLength})`,
      severity: 'error',
    })
  }

  let nodeCount = 0
  const walkNode = (node: unknown, path: string, depth: number): void => {
    nodeCount++
    if (nodeCount > SpectreLimits.maxNodes) {
      issues.push({ path, message: `ノード数が上限 ${SpectreLimits.maxNodes} を超えています`, severity: 'error' })
      return
    }
    if (depth > SpectreLimits.maxDepth) {
      issues.push({ path, message: `深さが上限 ${SpectreLimits.maxDepth} を超えています`, severity: 'error' })
      return
    }
    if (typeof node !== 'object' || node === null) {
      issues.push({ path, message: 'ノードはオブジェクトである必要があります', severity: 'error' })
      return
    }
    const n = node as Record<string, unknown>
    const type = n.type
    if (typeof type !== 'string') {
      issues.push({ path: `${path}.type`, message: 'type がありません', severity: 'error' })
    } else if (!manifest.componentsByName.has(type)) {
      // 未知のコンポーネント。fallback か optional が宣言されていれば
      // 劣化経路があるので警告に留める (docs/compatibility.md §3)。
      const hasDegradationPath = Boolean(n.fallback) || n.optional === true
      issues.push({
        path: `${path}.type`,
        message: `未知のコンポーネントです: ${type}`,
        severity: hasDegradationPath ? 'warning' : 'error',
      })
    }

    const children = n.children
    if (Array.isArray(children)) {
      children.forEach((child, i) => walkNode(child, `${path}.children[${i}]`, depth + 1))
    }
    if (n.fallback) walkNode(n.fallback, `${path}.fallback`, depth)
    const repeat = n.repeat as { emptyView?: unknown } | undefined
    if (repeat?.emptyView) walkNode(repeat.emptyView, `${path}.repeat.emptyView`, depth + 1)
  }

  walkNode(record.root, 'root', 1)

  const overlays = record.overlays
  if (Array.isArray(overlays)) {
    overlays.forEach((overlay, i) => {
      const root = (overlay as Record<string, unknown> | null)?.root
      if (root) walkNode(root, `overlays[${i}].root`, 1)
    })
  }

  return issues
}

export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error')
}

/**
 * UTF-8 バイト長。`Buffer` は Node 専用で、このモジュールはブラウザ側
 * (packages/editor、SU-0003) からも直接 import されるため、両方で動く
 * `TextEncoder`（ブラウザ・Node どちらもグローバル）を使う。
 */
function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

/**
 * サイズ・ノード数・深さの上限だけを見る、軽量版の検証。
 *
 * `validateDocument` はマニフェスト適合性まで見るため下書きの途中経過には重すぎる。
 * オーサリングAPIの書き込み経路 (`POST`/`PUT /api/documents/...`) は、公開前の
 * 下書きであっても docs/architecture.md §5 の上限だけは常に強制するために、こちらを使う。
 */
export function checkResourceLimits(doc: unknown): ValidationIssue[] {
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    return [{ path: '', message: 'ドキュメントのトップレベルはオブジェクトです', severity: 'error' }]
  }
  const record = doc as Record<string, unknown>
  const issues: ValidationIssue[] = []

  const byteLength = utf8ByteLength(JSON.stringify(doc))
  if (byteLength > SpectreLimits.maxDocumentBytes) {
    issues.push({
      path: '',
      message: `ドキュメントが上限 ${SpectreLimits.maxDocumentBytes} バイトを超えています (${byteLength})`,
      severity: 'error',
    })
  }

  if (typeof record.root !== 'object' || record.root === null) {
    return issues
  }

  let nodeCount = 0
  const walkNode = (node: unknown, path: string, depth: number): void => {
    if (typeof node !== 'object' || node === null) return
    nodeCount++
    if (nodeCount > SpectreLimits.maxNodes) {
      issues.push({ path, message: `ノード数が上限 ${SpectreLimits.maxNodes} を超えています`, severity: 'error' })
      return
    }
    if (depth > SpectreLimits.maxDepth) {
      issues.push({ path, message: `深さが上限 ${SpectreLimits.maxDepth} を超えています`, severity: 'error' })
      return
    }
    const n = node as Record<string, unknown>
    const children = n.children
    if (Array.isArray(children)) {
      children.forEach((child, i) => walkNode(child, `${path}.children[${i}]`, depth + 1))
    }
    if (n.fallback) walkNode(n.fallback, `${path}.fallback`, depth)
    const repeat = n.repeat as { emptyView?: unknown } | undefined
    if (repeat?.emptyView) walkNode(repeat.emptyView, `${path}.repeat.emptyView`, depth + 1)
  }
  walkNode(record.root, 'root', 1)

  const overlays = record.overlays
  if (Array.isArray(overlays)) {
    overlays.forEach((overlay, i) => {
      const root = (overlay as Record<string, unknown> | null)?.root
      if (root) walkNode(root, `overlays[${i}].root`, 1)
    })
  }

  return issues
}
