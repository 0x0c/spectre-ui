import { useEffect, useState } from 'react'
import { DndContext, type DragEndEvent } from '@dnd-kit/core'
import { editorManifest } from './manifest/editorManifest'
import { useDocumentStore } from './store/documentStore'
import productDetail from './sample/productDetail'
import { Palette } from './palette/Palette'
import { Canvas } from './canvas/Canvas'
import { TreePanel } from './tree-panel/TreePanel'
import { Inspector } from './inspector/Inspector'
import { DataPanel } from './data/DataPanel'
import { ActionCatalogPanel } from './actions/ActionCatalogPanel'
import { EnvControls } from './preview/EnvControls'
import { DocumentToolbar } from './toolbar/DocumentToolbar'
import { resolveDrop, type DragActiveData, type DropOverData } from './dnd/resolveDrop'

type BottomTab = 'data' | 'actions'

/**
 * トップレベルの画面構成。docs/editor.md §1 のワイヤフレーム
 * (パレット | キャンバス+ツリー | インスペクタ、下段にデータ/アクション) をなぞる。
 * ドラッグ&ドロップは `DndContext` をここ1箇所に置き、パレット (`palette:<name>`) と
 * 既存ノード (`node:<id>`) の2種類の draggable を、コンテナの `append:<id>` droppable
 * （そのコンテナの末尾に追加）へ落とす形にしている — 兄弟間の細かい並べ替えは
 * ツリーパネルの ↑↓ ボタンで行う (NodeView.tsx 冒頭のコメント参照)。
 */
export default function App() {
  const loadDocument = useDocumentStore((s) => s.loadDocument)
  const addComponent = useDocumentStore((s) => s.addComponent)
  const moveNode = useDocumentStore((s) => s.moveNode)
  const [bottomTab, setBottomTab] = useState<BottomTab>('data')

  // 初回マウント時のみ、同梱サンプル (examples/screens/product-detail.json) を読み込む。
  // `loadDocument` は zustand のアクションで参照が安定しているので、依存配列は空でよい。
  useEffect(() => {
    loadDocument(productDetail)
  }, [loadDocument])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    resolveDrop(active.data.current as DragActiveData | undefined, over?.data.current as DropOverData | undefined, {
      getComponent: (name) => editorManifest.componentsByName.get(name),
      addComponent: (component, parentId) => addComponent(component, parentId),
      moveNode: (id, toParentId, beforeId) => moveNode(id, toParentId, beforeId),
    })
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="app-shell">
        <DocumentToolbar />
        <EnvControls />
        <div className="app-main">
          <aside className="app-palette">
            <Palette />
          </aside>
          <main className="app-canvas-col">
            <Canvas />
            <TreePanel />
          </main>
          <aside className="app-inspector">
            <Inspector />
          </aside>
        </div>
        <div className="app-bottom">
          <div className="app-bottom-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={bottomTab === 'data'} className={bottomTab === 'data' ? 'tab-active' : ''} onClick={() => setBottomTab('data')}>
              データ
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={bottomTab === 'actions'}
              className={bottomTab === 'actions' ? 'tab-active' : ''}
              onClick={() => setBottomTab('actions')}
            >
              アクションカタログ
            </button>
          </div>
          {bottomTab === 'data' && <DataPanel />}
          {bottomTab === 'actions' && <ActionCatalogPanel />}
        </div>
      </div>
    </DndContext>
  )
}
