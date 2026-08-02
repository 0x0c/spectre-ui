import { create } from 'zustand'

/**
 * 作業領域の配置 (SU-0013)。どのパネルがどのスロットにいるか、各スロットの大きさは
 * どれだけか、の2つだけを持つ。
 *
 * ドキュメントストアと分けてあるのは、パネルの大きさがドキュメントの編集ではないため。
 * ADR-0005 が Immer のパッチで組み立てた undo/redo 履歴に、作業領域の操作を
 * 混ぜるわけにはいかない（元に戻すべきなのは画面の編集であって、パネルの幅ではない）。
 */

export type PanelId = 'palette' | 'canvas' | 'inspector' | 'data'
export type SlotId = 'left' | 'center' | 'right' | 'bottom'

export const SLOT_IDS: SlotId[] = ['left', 'center', 'right', 'bottom']

/** スロット -> そこに置かれたパネル。1スロットに1パネルで、空きスロットもありうる。 */
export type SlotAssignment = Record<SlotId, PanelId | null>

export interface WorkspaceSizes {
  /** 左スロットの幅 (px)。 */
  leftWidth: number
  /** 右スロットの幅 (px)。 */
  rightWidth: number
  /** 下スロットの高さ (px)。 */
  bottomHeight: number
  /** 中央スロットの上下分割比 (0〜1)。キャンバスとドキュメント木の境界。 */
  centerSplit: number
}

export const DEFAULT_SLOTS: SlotAssignment = {
  left: 'palette',
  center: 'canvas',
  right: 'inspector',
  bottom: 'data',
}

export const DEFAULT_SIZES: WorkspaceSizes = {
  leftWidth: 200,
  rightWidth: 300,
  bottomHeight: 220,
  centerSplit: 0.6,
}

/**
 * 下限。ドラッグでパネルを消してしまえないようにする (SU-0013 Detailed design 項目2)。
 * 上限は「反対側のパネルが下限を割らないこと」で決まるため、実行時に画面幅から求める。
 */
export const MIN_SIZES = {
  leftWidth: 140,
  rightWidth: 180,
  bottomHeight: 96,
  centerSplit: 0.2,
  centerSplitMax: 0.9,
} as const

const STORAGE_KEY = 'spectre-editor-workspace-v1'

export interface WorkspaceState {
  slots: SlotAssignment
  sizes: WorkspaceSizes
  /** ハンドルを掴んでいるパネル。掴んでいなければ null。 */
  draggingPanel: PanelId | null

  setSize: <K extends keyof WorkspaceSizes>(key: K, value: number) => void
  /** `panel` を `slot` へ移す。移動先にパネルがいれば、そのパネルと入れ替える。 */
  movePanel: (panel: PanelId, slot: SlotId) => void
  /** ハンドルのキーボード操作。次のスロットへ送り、そこにいるパネルと入れ替える。 */
  cyclePanel: (panel: PanelId, direction: 1 | -1) => void
  beginPanelDrag: (panel: PanelId) => void
  endPanelDrag: () => void
  resetLayout: () => void
}

const PANEL_IDS = Object.values(DEFAULT_SLOTS).filter((panel): panel is PanelId => panel !== null)

function isPanelId(value: unknown): value is PanelId {
  return typeof value === 'string' && (PANEL_IDS as string[]).includes(value)
}

function clampSize<K extends keyof WorkspaceSizes>(key: K, value: number): number {
  if (key === 'centerSplit') return Math.min(MIN_SIZES.centerSplitMax, Math.max(MIN_SIZES.centerSplit, value))
  const floor = MIN_SIZES[key as 'leftWidth' | 'rightWidth' | 'bottomHeight']
  return Math.max(floor, Math.round(value))
}

/**
 * 保存済みの配置。壊れた値や旧版のキーは黙って捨て、出荷時の配置に戻す。
 *
 * ストアの初期化で1度だけ呼ぶ。読み込み直しの挙動をテストから確かめられるように
 * 公開してある。
 */
export function readPersistedLayout(): { slots: SlotAssignment; sizes: WorkspaceSizes } {
  const fallback = { slots: { ...DEFAULT_SLOTS }, sizes: { ...DEFAULT_SIZES } }
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<{ slots: SlotAssignment; sizes: WorkspaceSizes }>
    const slots = { ...DEFAULT_SLOTS }
    const seen = new Set<PanelId>()
    for (const slot of SLOT_IDS) {
      const panel = parsed.slots?.[slot]
      // 同じパネルが2つのスロットに現れる保存内容は、片方を捨てて整合させる。
      if (panel && isPanelId(panel) && !seen.has(panel)) {
        slots[slot] = panel
        seen.add(panel)
      } else {
        slots[slot] = null
      }
    }
    // どのスロットにも現れなかったパネルは、空いているスロットへ戻す。見失わせない。
    for (const [slot, panel] of Object.entries(DEFAULT_SLOTS) as [SlotId, PanelId][]) {
      if (!seen.has(panel)) {
        const empty = SLOT_IDS.find((s) => slots[s] === null) ?? slot
        slots[empty] = panel
        seen.add(panel)
      }
    }
    const sizes = { ...DEFAULT_SIZES }
    for (const key of Object.keys(DEFAULT_SIZES) as (keyof WorkspaceSizes)[]) {
      const value = parsed.sizes?.[key]
      if (typeof value === 'number' && Number.isFinite(value)) sizes[key] = clampSize(key, value)
    }
    return { slots, sizes }
  } catch {
    return fallback
  }
}

function persist(state: { slots: SlotAssignment; sizes: WorkspaceSizes }): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ slots: state.slots, sizes: state.sizes }))
  } catch {
    // プライベートブラウジングなどで保存できないことがある。配置が残らないだけで、
    // 編集そのものには影響しないので黙って続ける。
  }
}

export function slotOf(slots: SlotAssignment, panel: PanelId): SlotId | null {
  return SLOT_IDS.find((slot) => slots[slot] === panel) ?? null
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  ...readPersistedLayout(),
  draggingPanel: null,

  setSize: (key, value) =>
    set((state) => {
      const sizes = { ...state.sizes, [key]: clampSize(key, value) }
      persist({ slots: state.slots, sizes })
      return { sizes }
    }),

  movePanel: (panel, slot) =>
    set((state) => {
      const from = slotOf(state.slots, panel)
      if (from === slot) return state
      const slots = { ...state.slots }
      if (!from) return state
      const displaced = slots[slot]
      slots[slot] = panel
      // 移動元には、移動先にいたパネルを入れる（いなければ空になる）。
      slots[from] = displaced
      persist({ slots, sizes: state.sizes })
      return { slots, draggingPanel: null }
    }),

  cyclePanel: (panel, direction) => {
    const from = slotOf(get().slots, panel)
    if (!from) return
    const next = SLOT_IDS[(SLOT_IDS.indexOf(from) + direction + SLOT_IDS.length) % SLOT_IDS.length]
    get().movePanel(panel, next)
  },

  beginPanelDrag: (panel) => set({ draggingPanel: panel }),
  endPanelDrag: () => set({ draggingPanel: null }),

  resetLayout: () =>
    set(() => {
      const next = { slots: { ...DEFAULT_SLOTS }, sizes: { ...DEFAULT_SIZES } }
      persist(next)
      return { ...next, draggingPanel: null }
    }),
}))
