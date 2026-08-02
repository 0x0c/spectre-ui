import { useCallback, useEffect, useRef, useState } from 'react'
import { DndContext, type DragEndEvent } from '@dnd-kit/core'
import { editorManifest } from './manifest/editorManifest'
import { useDocumentStore } from './store/documentStore'
import { MIN_SIZES, type PanelId, type SlotId, useWorkspaceStore } from './store/workspaceStore'
import { Palette } from './palette/Palette'
import { Canvas } from './canvas/Canvas'
import { TreePanel } from './tree-panel/TreePanel'
import { Inspector } from './inspector/Inspector'
import { DataPanel } from './data/DataPanel'
import { ActionCatalogPanel } from './actions/ActionCatalogPanel'
import { OverlayPanel } from './overlays/OverlayPanel'
import { EnvControls } from './preview/EnvControls'
import { DocumentToolbar } from './toolbar/DocumentToolbar'
import { Panel } from './workspace/Panel'
import { Splitter } from './workspace/Splitter'
import { resolveDrop, type DragActiveData, type DropOverData } from './dnd/resolveDrop'

type BottomTab = 'data' | 'actions' | 'overlays'

const PANEL_TITLES: Record<PanelId, string> = {
  palette: 'パレット',
  canvas: 'キャンバス',
  inspector: 'インスペクタ',
  data: 'データとアクション',
}

/**
 * トップレベルの画面構成。docs/editor.md §1 のワイヤフレーム
 * (パレット | キャンバス+ツリー | インスペクタ、下段にデータ/アクション) をなぞる。
 *
 * 配置そのものは固定ではない (SU-0013)。4つのスロット (左・中央・右・下) に、どの
 * パネルが入るかは workspaceStore が持ち、境界のスプリッタで大きさを変えられる。
 *
 * ドラッグ&ドロップは `DndContext` をここ1箇所に置き、パレット (`palette:<name>`) と
 * 既存ノード (`node:<id>`) の2種類の draggable を、コンテナの `append:<id>` droppable
 * （そのコンテナの末尾に追加）へ落とす形にしている — 兄弟間の細かい並べ替えは
 * ツリーパネルの ↑↓ ボタンで行う (NodeView.tsx 冒頭のコメント参照)。
 */
export default function App() {
  const addComponent = useDocumentStore((s) => s.addComponent)
  const moveNode = useDocumentStore((s) => s.moveNode)
  const slots = useWorkspaceStore((s) => s.slots)
  const sizes = useWorkspaceStore((s) => s.sizes)
  const setSize = useWorkspaceStore((s) => s.setSize)
  const endPanelDrag = useWorkspaceStore((s) => s.endPanelDrag)
  const [bottomTab, setBottomTab] = useState<BottomTab>('data')
  const shellRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)

  // ハンドルを掴んだままパネルのヘッダ以外で離したときに、掴んだ状態が残らないようにする。
  useEffect(() => {
    const cancel = () => endPanelDrag()
    window.addEventListener('pointerup', cancel)
    return () => window.removeEventListener('pointerup', cancel)
  }, [endPanelDrag])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    resolveDrop(active.data.current as DragActiveData | undefined, over?.data.current as DropOverData | undefined, {
      getComponent: (name) => editorManifest.componentsByName.get(name),
      addComponent: (component, parentId) => addComponent(component, parentId),
      moveNode: (id, toParentId, beforeId) => moveNode(id, toParentId, beforeId),
    })
  }

  // 上限は画面の大きさから決める。定数にすると、狭い画面で反対側のパネルを
  // 画面の外へ押し出せてしまう (SU-0013 Detailed design 項目2)。
  const maxSide = Math.max(MIN_SIZES.leftWidth, Math.round((globalThis.innerWidth ?? 1280) * 0.45))
  const maxBottom = Math.max(MIN_SIZES.bottomHeight, Math.round((globalThis.innerHeight ?? 800) * 0.6))

  const leftFromPointer = useCallback(
    (event: { clientX: number }) => event.clientX - (mainRef.current?.getBoundingClientRect().left ?? 0),
    [],
  )
  const rightFromPointer = useCallback(
    (event: { clientX: number }) => (mainRef.current?.getBoundingClientRect().right ?? 0) - event.clientX,
    [],
  )
  const bottomFromPointer = useCallback(
    (event: { clientY: number }) => (shellRef.current?.getBoundingClientRect().bottom ?? 0) - event.clientY,
    [],
  )

  function renderPanel(slot: SlotId) {
    const id = slots[slot]
    if (!id) return null
    return (
      <Panel id={id} slot={slot} title={PANEL_TITLES[id]}>
        {id === 'palette' && <Palette />}
        {id === 'canvas' && <CanvasPanelBody />}
        {id === 'inspector' && <Inspector />}
        {id === 'data' && (
          <>
            <div className="app-bottom-tabs" role="tablist">
              <TabButton current={bottomTab} value="data" label="データ" onSelect={setBottomTab} />
              <TabButton current={bottomTab} value="actions" label="アクションカタログ" onSelect={setBottomTab} />
              <TabButton current={bottomTab} value="overlays" label="オーバレイ" onSelect={setBottomTab} />
            </div>
            {bottomTab === 'data' && <DataPanel />}
            {bottomTab === 'actions' && <ActionCatalogPanel />}
            {bottomTab === 'overlays' && <OverlayPanel />}
          </>
        )}
      </Panel>
    )
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="app-shell" ref={shellRef}>
        <DocumentToolbar />
        <EnvControls />
        <div className="app-main" ref={mainRef} style={{ gridTemplateColumns: `${sizes.leftWidth}px 6px 1fr 6px ${sizes.rightWidth}px` }}>
          {renderPanel('left')}
          <Splitter
            orientation="vertical"
            label="左パネルの幅"
            value={sizes.leftWidth}
            min={MIN_SIZES.leftWidth}
            max={maxSide}
            fromPointer={leftFromPointer}
            onChange={(value) => setSize('leftWidth', value)}
          />
          {renderPanel('center')}
          <Splitter
            orientation="vertical"
            label="右パネルの幅"
            value={sizes.rightWidth}
            min={MIN_SIZES.rightWidth}
            max={maxSide}
            fromPointer={rightFromPointer}
            onChange={(value) => setSize('rightWidth', value)}
          />
          {renderPanel('right')}
        </div>
        <Splitter
          orientation="horizontal"
          label="下パネルの高さ"
          value={sizes.bottomHeight}
          min={MIN_SIZES.bottomHeight}
          max={maxBottom}
          fromPointer={bottomFromPointer}
          onChange={(value) => setSize('bottomHeight', value)}
        />
        <div className="app-bottom" style={{ height: sizes.bottomHeight }}>
          {renderPanel('bottom')}
        </div>
      </div>
    </DndContext>
  )
}

function TabButton({
  current,
  value,
  label,
  onSelect,
}: {
  current: BottomTab
  value: BottomTab
  label: string
  onSelect: (value: BottomTab) => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={current === value}
      className={current === value ? 'tab-active' : ''}
      onClick={() => onSelect(value)}
    >
      {label}
    </button>
  )
}

/** キャンバスとドキュメント木。この2つの境界だけはパネルの内側にある。 */
function CanvasPanelBody() {
  const centerSplit = useWorkspaceStore((s) => s.sizes.centerSplit)
  const setSize = useWorkspaceStore((s) => s.setSize)
  const columnRef = useRef<HTMLDivElement>(null)

  const splitFromPointer = useCallback((event: { clientY: number }) => {
    const rect = columnRef.current?.getBoundingClientRect()
    if (!rect || rect.height === 0) return 0
    return (event.clientY - rect.top) / rect.height
  }, [])

  return (
    <div className="app-canvas-col" ref={columnRef}>
      <div style={{ flex: `${centerSplit} 1 0`, minHeight: 0, display: 'flex' }}>
        <Canvas />
      </div>
      <Splitter
        orientation="horizontal"
        label="キャンバスとツリーの境界"
        value={centerSplit}
        min={MIN_SIZES.centerSplit}
        max={MIN_SIZES.centerSplitMax}
        step={0.05}
        fromPointer={splitFromPointer}
        onChange={(value) => setSize('centerSplit', value)}
      />
      <div style={{ flex: `${1 - centerSplit} 1 0`, minHeight: 0, display: 'flex' }}>
        <TreePanel />
      </div>
    </div>
  )
}
