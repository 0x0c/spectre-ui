import type { SpectreNode } from '@spectre-ui/manifest/generated'
import { useDocumentStore } from '../store/documentStore'

interface Row {
  node: SpectreNode
  depth: number
  parentId: string | null
  siblingIndex: number
  siblingCount: number
}

/**
 * ドキュメント木をフラットな行のリストに開く。`children` だけを辿る — 他のスロット
 * (fallback、repeat.emptyView、Screen.appBar/bottomBar など) はこの一巡目の対象外
 * (NodeView.tsx 冒頭のコメントと同じ理由)。
 */
function flatten(node: SpectreNode, depth: number, parentId: string | null, siblingIndex: number, siblingCount: number, out: Row[]): void {
  out.push({ node, depth, parentId, siblingIndex, siblingCount })
  const children = node.children ?? []
  children.forEach((child, i) => flatten(child, depth + 1, node.id ?? null, i, children.length, out))
}

export function TreePanel() {
  const doc = useDocumentStore((s) => s.document)
  const selectedNodeId = useDocumentStore((s) => s.selectedNodeId)
  const select = useDocumentStore((s) => s.select)
  const removeNode = useDocumentStore((s) => s.removeNode)
  const moveNode = useDocumentStore((s) => s.moveNode)

  const rows: Row[] = []
  flatten(doc.root, 0, null, 0, 1, rows)

  function moveUp(row: Row) {
    if (!row.parentId || row.siblingIndex === 0) return
    const siblings = rows.filter((r) => r.parentId === row.parentId)
    const beforeId = siblings[row.siblingIndex - 1].node.id!
    moveNode(row.node.id!, row.parentId, beforeId)
  }

  function moveDown(row: Row) {
    if (!row.parentId || row.siblingIndex >= row.siblingCount - 1) return
    const siblings = rows.filter((r) => r.parentId === row.parentId)
    const afterNext = siblings[row.siblingIndex + 2]
    moveNode(row.node.id!, row.parentId, afterNext ? afterNext.node.id! : null)
  }

  return (
    <div className="tree-panel" role="tree" aria-label="ドキュメント構造">
      {rows.map((row) => {
        const selected = row.node.id === selectedNodeId
        return (
          <div
            key={row.node.id}
            role="treeitem"
            aria-selected={selected}
            className={`tree-row${selected ? ' tree-row-selected' : ''}`}
            style={{ paddingLeft: 8 + row.depth * 14 }}
            onClick={(e) => {
              e.stopPropagation()
              select(row.node.id ?? null)
            }}
          >
            <span className="tree-row-label">
              {row.node.type}
              {nodeLabel(row.node) && <span className="tree-row-sublabel"> — {nodeLabel(row.node)}</span>}
            </span>
            {row.parentId && (
              <span className="tree-row-actions">
                <button
                  type="button"
                  aria-label="上へ移動"
                  disabled={row.siblingIndex === 0}
                  onClick={(e) => {
                    e.stopPropagation()
                    moveUp(row)
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="下へ移動"
                  disabled={row.siblingIndex >= row.siblingCount - 1}
                  onClick={(e) => {
                    e.stopPropagation()
                    moveDown(row)
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label="削除"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeNode(row.node.id!)
                  }}
                >
                  ✕
                </button>
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function nodeLabel(node: SpectreNode): string {
  const props = node.props as Record<string, unknown>
  const candidate = props.text ?? props.label ?? props.title
  return typeof candidate === 'string' ? candidate : ''
}
