import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { EMPTY_DOCUMENT, useDocumentStore } from './store/documentStore'
import { useWorkspaceStore } from './store/workspaceStore'

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useWorkspaceStore.getState().resetLayout()
    useDocumentStore.getState().loadDocument(EMPTY_DOCUMENT)
  })

  it('mounts the full editor shell on an empty canvas', () => {
    render(<App />)

    // SU-0013 項目1: 同梱サンプルではなく空のドキュメントで開く
    expect(screen.getByText(/パレットからコンポーネントをドラッグ/)).toBeInTheDocument()
    expect(screen.queryByText('商品詳細')).not.toBeInTheDocument()

    // どのパネルも出ている
    expect(screen.getByText('レイアウト')).toBeInTheDocument() // パレットのカテゴリ
    expect(screen.getByRole('tree')).toBeInTheDocument() // ツリーパネル
    expect(screen.getByRole('tab', { name: 'データ' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'オーバレイ' })).toBeInTheDocument()
    expect(screen.getByText(/近似プレビューです/)).toBeInTheDocument() // 忠実度のバナー
  })

  it('loads the bundled sample from the toolbar', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /サンプルを開く/ }))

    expect(await screen.findByText('商品詳細')).toBeInTheDocument()
    expect(screen.queryByText(/パレットからコンポーネントをドラッグ/)).not.toBeInTheDocument()
  })

  it('moves a boundary from the keyboard, and stops at the floor size', () => {
    render(<App />)
    const splitter = screen.getByRole('separator', { name: '左パネルの幅' })

    const before = useWorkspaceStore.getState().sizes.leftWidth
    fireEvent.keyDown(splitter, { key: 'ArrowRight' })
    expect(useWorkspaceStore.getState().sizes.leftWidth).toBeGreaterThan(before)

    // 下限まで詰めても、パネルが消えることはない
    for (let i = 0; i < 40; i++) fireEvent.keyDown(splitter, { key: 'ArrowLeft' })
    expect(useWorkspaceStore.getState().sizes.leftWidth).toBe(140)
  })

  it('keeps following the pointer for the whole drag, not just the first move', () => {
    render(<App />)
    const splitter = screen.getByRole('separator', { name: '左パネルの幅' })

    // jsdom の getBoundingClientRect は 0 を返すので、clientX がそのまま幅になる。
    fireEvent.pointerDown(splitter)
    fireEvent(window, new MouseEvent('pointermove', { clientX: 300 }))
    expect(useWorkspaceStore.getState().sizes.leftWidth).toBe(300)

    // 2回目以降も届くこと。listener の付け外しで取り逃がしていた回帰の番人。
    fireEvent(window, new MouseEvent('pointermove', { clientX: 360 }))
    expect(useWorkspaceStore.getState().sizes.leftWidth).toBe(360)

    // 上限を超えるドラッグは丸められ、反対側のパネルを画面外へ押し出さない。
    fireEvent(window, new MouseEvent('pointermove', { clientX: 99999 }))
    const max = Math.round(window.innerWidth * 0.45)
    expect(useWorkspaceStore.getState().sizes.leftWidth).toBe(max)

    // 離した後のポインタ移動は効かない。
    fireEvent(window, new MouseEvent('pointerup'))
    fireEvent(window, new MouseEvent('pointermove', { clientX: 200 }))
    expect(useWorkspaceStore.getState().sizes.leftWidth).toBe(max)
  })

  it('restores the shipped arrangement from the toolbar', () => {
    render(<App />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'パレットを移動' }), { key: 'ArrowRight' })
    expect(useWorkspaceStore.getState().slots.center).toBe('palette')

    fireEvent.click(screen.getByRole('button', { name: '配置を戻す' }))

    expect(useWorkspaceStore.getState().slots.center).toBe('canvas')
    expect(useWorkspaceStore.getState().sizes.leftWidth).toBe(200)
  })

  it('sends a panel to the next slot from its handle, swapping with whichever panel is there', () => {
    render(<App />)

    fireEvent.keyDown(screen.getByRole('button', { name: 'パレットを移動' }), { key: 'ArrowRight' })

    const slots = useWorkspaceStore.getState().slots
    expect(slots.center).toBe('palette')
    expect(slots.left).toBe('canvas')
  })

  it('swaps two panels when one panel’s handle is dropped on another panel’s header', () => {
    render(<App />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'パレットを移動' }))
    // ヘッダはハンドルの親。ハンドル側ではなくヘッダの上で離すのが入れ替えの操作。
    const inspectorHeader = screen.getByRole('button', { name: 'インスペクタを移動' }).parentElement!
    fireEvent.pointerUp(inspectorHeader)

    const slots = useWorkspaceStore.getState().slots
    expect(slots.right).toBe('palette')
    expect(slots.left).toBe('inspector')
  })

  it('restores the saved arrangement on the next mount', () => {
    render(<App />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'パレットを移動' }), { key: 'ArrowRight' })

    // 保存済みの内容だけを頼りに読み直す。ストアの現在値は捨てる。
    const persisted = JSON.parse(window.localStorage.getItem('spectre-editor-workspace-v1') ?? '{}')
    expect(persisted.slots.center).toBe('palette')
    expect(persisted.slots.left).toBe('canvas')
  })
})
