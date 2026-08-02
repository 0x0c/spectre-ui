import type { SpectreNode } from '@spectre-ui/manifest/generated'
import type { ComponentDef } from '@spectre-ui/manifest/editor-schema'

let counter = 0

/** `commonNodeProps.id` の説明の通り、id はエディタが自動採番する。 */
export function generateNodeId(type: string): string {
  counter += 1
  return `${type.toLowerCase()}_${Date.now().toString(36)}${counter.toString(36)}`
}

/** パレットからドラッグされたコンポーネントの初期ノードを、宣言済みの default 値で作る。 */
export function createNode(component: ComponentDef): SpectreNode {
  const props: Record<string, unknown> = {}
  for (const { name, spec } of component.props) {
    if (spec.default !== undefined) {
      props[name] = spec.default
    } else if (spec.required) {
      props[name] = spec.type === 'number' ? 0 : spec.type === 'boolean' ? false : ''
    }
  }
  const node = { id: generateNodeId(component.name), type: component.name, props } as SpectreNode
  if (component.acceptsChildren) node.children = []
  return node
}

/** インポートされたドキュメントなど、id を持たないノードに自動採番する（破壊的）。 */
export function assignMissingIds(node: SpectreNode): void {
  if (!node.id) node.id = generateNodeId(node.type)
  for (const child of node.children ?? []) assignMissingIds(child)
  if (node.fallback) assignMissingIds(node.fallback)
  if (node.repeat?.emptyView) assignMissingIds(node.repeat.emptyView)
}

export interface FoundNode {
  node: SpectreNode
  parent: SpectreNode | null
}

/**
 * id でノードを探す。`children` / `fallback` / `repeat.emptyView` を辿る — この3つは
 * すべてのノードに共通のスロット (SpectreNodeCommon)。型ごとの追加スロット
 * (Screen.bottomBar、List.header/footer など) は、この一巡目のキャンバス実装では
 * ツリーパネル・ドラッグ&ドロップの対象に含めない (roadmap の Log に明記)。
 */
export function findNodeById(root: SpectreNode, id: string): FoundNode | undefined {
  if (root.id === id) return { node: root, parent: null }
  for (const child of root.children ?? []) {
    if (child.id === id) return { node: child, parent: root }
    const found = findNodeById(child, id)
    if (found) return found
  }
  if (root.fallback) {
    if (root.fallback.id === id) return { node: root.fallback, parent: root }
    const found = findNodeById(root.fallback, id)
    if (found) return found
  }
  if (root.repeat?.emptyView) {
    if (root.repeat.emptyView.id === id) return { node: root.repeat.emptyView, parent: root }
    const found = findNodeById(root.repeat.emptyView, id)
    if (found) return found
  }
  return undefined
}

/** ルートからの深さ（ルート自身が1）。見つからなければ -1。 */
export function depthOf(root: SpectreNode, id: string, depth = 1): number {
  if (root.id === id) return depth
  for (const child of root.children ?? []) {
    const found = depthOf(child, id, depth + 1)
    if (found !== -1) return found
  }
  return -1
}

export function countNodes(root: SpectreNode): number {
  let count = 1
  for (const child of root.children ?? []) count += countNodes(child)
  if (root.fallback) count += countNodes(root.fallback)
  if (root.repeat?.emptyView) count += countNodes(root.repeat.emptyView)
  return count
}

export function treeDepth(root: SpectreNode): number {
  const children = root.children ?? []
  if (children.length === 0) return 1
  return 1 + Math.max(...children.map(treeDepth))
}

export function insertChild(parent: SpectreNode, child: SpectreNode, index?: number): void {
  if (!parent.children) parent.children = []
  if (index === undefined || index < 0 || index > parent.children.length) {
    parent.children.push(child)
  } else {
    parent.children.splice(index, 0, child)
  }
}

export function removeNodeById(root: SpectreNode, id: string): SpectreNode | undefined {
  const children = root.children
  if (children) {
    const idx = children.findIndex((c) => c.id === id)
    if (idx !== -1) return children.splice(idx, 1)[0]
    for (const child of children) {
      const removed = removeNodeById(child, id)
      if (removed) return removed
    }
  }
  if (root.fallback?.id === id) {
    const removed = root.fallback
    root.fallback = undefined
    return removed
  }
  return undefined
}

function isDescendantOrSelf(node: SpectreNode, id: string): boolean {
  if (node.id === id) return true
  return (node.children ?? []).some((c) => isDescendantOrSelf(c, id))
}

/**
 * ノードを木の中で移動する（既存の位置から取り除き、`toParentId` の `children` に挿入する）。
 * 挿入位置は数値インデックスではなく `beforeId`（その手前に挿す。`null`/未指定なら末尾）で
 * 指定する — 数値インデックスだと、同じコンテナ内で後方へ動かすときに「取り除いた分だけ
 * ずれる」off-by-one が起きやすい。`beforeId` は取り除いたあとで改めて探すので、
 * このズレが構造的に発生しない。
 *
 * 自分自身または自分の子孫への移動は無視する（無限ループになる）。
 */
export function moveNodeBefore(root: SpectreNode, id: string, toParentId: string, beforeId?: string | null): boolean {
  const found = findNodeById(root, id)
  if (!found) return false
  if (isDescendantOrSelf(found.node, toParentId)) return false
  if (id === beforeId) return false

  const targetParent = toParentId === root.id ? root : findNodeById(root, toParentId)?.node
  if (!targetParent) return false

  removeNodeById(root, id)
  const freshIndex = beforeId ? (targetParent.children ?? []).findIndex((c) => c.id === beforeId) : -1
  insertChild(targetParent, found.node, freshIndex === -1 ? undefined : freshIndex)
  return true
}
