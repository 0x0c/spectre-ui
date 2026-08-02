import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SIZES, MIN_SIZES, readPersistedLayout, useWorkspaceStore } from './workspaceStore'

describe('workspaceStore', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useWorkspaceStore.getState().resetLayout()
  })

  it('swaps the two panels when one moves into an occupied slot', () => {
    useWorkspaceStore.getState().movePanel('palette', 'right')

    const slots = useWorkspaceStore.getState().slots
    expect(slots.right).toBe('palette')
    expect(slots.left).toBe('inspector')
  })

  it('cycles a panel through the slots in order, and wraps around', () => {
    const { cyclePanel } = useWorkspaceStore.getState()
    cyclePanel('palette', 1) // left -> center
    cyclePanel('palette', 1) // center -> right
    cyclePanel('palette', 1) // right -> bottom
    expect(useWorkspaceStore.getState().slots.bottom).toBe('palette')

    cyclePanel('palette', 1) // bottom -> left で一周する
    expect(useWorkspaceStore.getState().slots.left).toBe('palette')
  })

  it('clamps a size to its floor so a drag cannot squeeze a panel out of existence', () => {
    useWorkspaceStore.getState().setSize('leftWidth', 0)
    expect(useWorkspaceStore.getState().sizes.leftWidth).toBe(MIN_SIZES.leftWidth)

    useWorkspaceStore.getState().setSize('centerSplit', 5)
    expect(useWorkspaceStore.getState().sizes.centerSplit).toBe(MIN_SIZES.centerSplitMax)
  })

  it('reads back the arrangement it saved', () => {
    useWorkspaceStore.getState().movePanel('palette', 'bottom')
    useWorkspaceStore.getState().setSize('rightWidth', 420)

    const restored = readPersistedLayout()
    expect(restored.slots.bottom).toBe('palette')
    expect(restored.slots.left).toBe('data')
    expect(restored.sizes.rightWidth).toBe(420)
  })

  it('falls back to the shipped arrangement when the saved value is unusable', () => {
    window.localStorage.setItem('spectre-editor-workspace-v1', '{ not json')
    expect(readPersistedLayout().slots).toEqual({ left: 'palette', center: 'canvas', right: 'inspector', bottom: 'data' })

    // 同じパネルが2つのスロットに現れる保存内容でも、どのパネルも見失わない
    window.localStorage.setItem(
      'spectre-editor-workspace-v1',
      JSON.stringify({ slots: { left: 'palette', center: 'palette', right: 'inspector', bottom: 'data' } }),
    )
    const placed = Object.values(readPersistedLayout().slots)
    expect(new Set(placed)).toEqual(new Set(['palette', 'canvas', 'inspector', 'data']))
  })

  it('resets to the shipped arrangement', () => {
    useWorkspaceStore.getState().movePanel('canvas', 'bottom')
    useWorkspaceStore.getState().setSize('bottomHeight', 400)

    useWorkspaceStore.getState().resetLayout()

    expect(useWorkspaceStore.getState().slots.center).toBe('canvas')
    expect(useWorkspaceStore.getState().sizes).toEqual(DEFAULT_SIZES)
  })
})
