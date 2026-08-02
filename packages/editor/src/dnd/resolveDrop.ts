import type { ComponentDef } from '@spectre-ui/manifest/editor-schema'

/**
 * dnd-kit の `active.data.current` / `over.data.current` の形。Palette.tsx の
 * `useDraggable` と NodeView.tsx の `useDraggable`/`useDroppable` が書き込む値と一致させる。
 */
export type DragActiveData = { kind: 'palette'; name: string } | { kind: 'node'; id: string }
export type DropOverData = { kind: 'append'; containerId: string }

export interface ResolveDropDeps {
  getComponent: (name: string) => ComponentDef | undefined
  addComponent: (component: ComponentDef, parentId: string) => void
  moveNode: (id: string, toParentId: string, beforeId?: string | null) => void
}

/**
 * `DndContext` の `onDragEnd` が実際に呼ぶ、ドロップ結果の解決ロジック。App.tsx から
 * 純粋関数として切り出してある — dnd-kit のポインタドラッグは jsdom では確実に
 * 再現できないため、ここを直接テストすることで「ドラッグ&ドロップがドキュメント木を
 * 正しく更新する」ことを、実際に使われているのと同じコードパスで検証できる。
 */
export function resolveDrop(active: DragActiveData | undefined, over: DropOverData | undefined, deps: ResolveDropDeps): void {
  if (!active || !over) return

  if (active.kind === 'palette') {
    const component = deps.getComponent(active.name)
    if (component) deps.addComponent(component, over.containerId)
    return
  }

  if (active.id === over.containerId) return // 自分自身の上には落とせない
  deps.moveNode(active.id, over.containerId, null)
}
