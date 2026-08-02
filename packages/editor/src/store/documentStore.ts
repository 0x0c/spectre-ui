import { create } from 'zustand'
import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer'
import type { SpectreDocument, SpectreNode } from '@spectre-ui/manifest/generated'
import { SpectreLimits } from '@spectre-ui/manifest/generated'
import type { ComponentDef } from '@spectre-ui/manifest/editor-schema'
import {
  assignMissingIds,
  countNodes,
  createNode,
  depthOf,
  findNodeById,
  insertChild,
  moveNodeBefore,
  removeNodeById,
} from '../tree/nodeOps'

enablePatches()

interface HistoryEntry {
  patches: Patch[]
  inversePatches: Patch[]
}

// docs/adr/ADR-0005-editor-stack: Immer の patch/inversePatch をそのまま undo/redo の
// 履歴スタックに積む。これは同時にデバイスミラー (SU-0009、このパスの対象外) への配信単位や、
// 将来の協調編集のマージ単位にも転用できる設計を、今のうちから壊さないための選択。
const MAX_HISTORY = 200

export const EMPTY_DOCUMENT: SpectreDocument = {
  schemaVersion: '1.0',
  id: 'untitled',
  meta: { title: '新規ドキュメント' },
  data: {},
  state: {},
  root: { id: 'screen', type: 'Screen', props: { scrollable: true }, children: [] } as SpectreNode,
}

export interface DocumentStoreState {
  document: SpectreDocument
  selectedNodeId: string | null
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  lastError: string | null

  loadDocument: (doc: SpectreDocument) => void
  apply: (recipe: (draft: SpectreDocument) => void) => void
  undo: () => void
  redo: () => void
  select: (id: string | null) => void
  clearError: () => void

  addComponent: (component: ComponentDef, parentId: string, beforeId?: string | null) => string | undefined
  removeNode: (id: string) => void
  moveNode: (id: string, toParentId: string, beforeId?: string | null) => void
  /** `node.props` の下のパスを書き換える（コンポーネント固有のプロパティ）。 */
  updateNodeProp: (id: string, propPath: (string | number)[], value: unknown) => void
  /** ノード自体の下のパスを書き換える（`layout` / `style` / `a11y` / `visibleWhen` など、`props` の外にある共通フィールド）。 */
  updateNodeField: (id: string, fieldPath: (string | number)[], value: unknown) => void
  updateDocumentField: (field: 'data' | 'state', value: Record<string, unknown>) => void
}

function setAtPath(root: Record<string, unknown>, path: (string | number)[], value: unknown): void {
  let cursor = root
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]
    const next = cursor[key as string]
    if (next === undefined || next === null || typeof next !== 'object') {
      cursor[key as string] = typeof path[i + 1] === 'number' ? [] : {}
    }
    cursor = cursor[key as string] as Record<string, unknown>
  }
  cursor[path[path.length - 1] as string] = value
}

export const useDocumentStore = create<DocumentStoreState>((set, get) => ({
  document: cloneWithIds(EMPTY_DOCUMENT),
  selectedNodeId: null,
  undoStack: [],
  redoStack: [],
  lastError: null,

  loadDocument: (doc) =>
    set(() => ({
      document: cloneWithIds(doc),
      selectedNodeId: null,
      undoStack: [],
      redoStack: [],
      lastError: null,
    })),

  apply: (recipe) =>
    set((state) => {
      const [nextDoc, patches, inversePatches] = produceWithPatches(state.document, recipe)
      if (patches.length === 0) return state
      const undoStack = [...state.undoStack, { patches, inversePatches }].slice(-MAX_HISTORY)
      return { document: nextDoc, undoStack, redoStack: [] }
    }),

  undo: () =>
    set((state) => {
      const entry = state.undoStack.at(-1)
      if (!entry) return state
      const nextDoc = applyPatches(state.document, entry.inversePatches)
      return { document: nextDoc, undoStack: state.undoStack.slice(0, -1), redoStack: [...state.redoStack, entry] }
    }),

  redo: () =>
    set((state) => {
      const entry = state.redoStack.at(-1)
      if (!entry) return state
      const nextDoc = applyPatches(state.document, entry.patches)
      return { document: nextDoc, undoStack: [...state.undoStack, entry], redoStack: state.redoStack.slice(0, -1) }
    }),

  select: (id) => set({ selectedNodeId: id }),
  clearError: () => set({ lastError: null }),

  addComponent: (component, parentId, beforeId) => {
    const state = get()
    const root = state.document.root

    // docs/architecture.md §7 の上限をここで強制する — テストだけでなく、実際に
    // 追加を拒否する経路として。上限を超える追加は静かに失敗させず、理由を出す。
    if (countNodes(root) + 1 > SpectreLimits.maxNodes) {
      set({ lastError: `ノード数の上限 (${SpectreLimits.maxNodes}) に達しているため追加できません` })
      return undefined
    }
    const parentDepth = depthOf(root, parentId)
    if (parentDepth === -1) {
      set({ lastError: '追加先のノードが見つかりません' })
      return undefined
    }
    if (parentDepth + 1 > SpectreLimits.maxDepth) {
      set({ lastError: `深さの上限 (${SpectreLimits.maxDepth}) に達しているため追加できません` })
      return undefined
    }

    const newNode = createNode(component)
    get().apply((draft) => {
      const parent = parentId === draft.root.id ? draft.root : findNodeById(draft.root, parentId)?.node
      if (!parent) return
      const index = beforeId ? (parent.children ?? []).findIndex((c) => c.id === beforeId) : -1
      insertChild(parent, newNode, index === -1 ? undefined : index)
    })
    set({ selectedNodeId: newNode.id, lastError: null })
    return newNode.id
  },

  removeNode: (id) => {
    get().apply((draft) => {
      removeNodeById(draft.root, id)
    })
    set((state) => (state.selectedNodeId === id ? { selectedNodeId: null } : state))
  },

  moveNode: (id, toParentId, beforeId) => {
    get().apply((draft) => {
      moveNodeBefore(draft.root, id, toParentId, beforeId)
    })
  },

  updateNodeProp: (id, propPath, value) => {
    get().apply((draft) => {
      const target = id === draft.root.id ? draft.root : findNodeById(draft.root, id)?.node
      if (!target) return
      setAtPath(target.props as Record<string, unknown>, propPath, value)
    })
  },

  updateNodeField: (id, fieldPath, value) => {
    get().apply((draft) => {
      const target = id === draft.root.id ? draft.root : findNodeById(draft.root, id)?.node
      if (!target) return
      setAtPath(target as unknown as Record<string, unknown>, fieldPath, value)
    })
  },

  updateDocumentField: (field, value) => {
    get().apply((draft) => {
      draft[field] = value
    })
  },
}))

function cloneWithIds(doc: SpectreDocument): SpectreDocument {
  const cloned = structuredClone(doc)
  assignMissingIds(cloned.root)
  return cloned
}
