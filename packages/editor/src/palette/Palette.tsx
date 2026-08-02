import { useDraggable } from '@dnd-kit/core'
import type { ComponentDef } from '@spectre-ui/manifest/editor-schema'
import { editorManifest } from '../manifest/editorManifest'
import { useDocumentStore } from '../store/documentStore'
import { findNodeById } from '../tree/nodeOps'

const CATEGORY_LABEL: Record<string, string> = {
  layout: 'レイアウト',
  content: '表示',
  input: '入力',
}

function paletteGroups(): [string, ComponentDef[]][] {
  const groups = new Map<string, ComponentDef[]>()
  for (const component of editorManifest.components) {
    // Screen はドキュメントのルート専用 (rootOnly) — 2つ目の Screen を子として
    // ドラッグインできてしまうと木の不変条件が壊れるので、パレットには出さない。
    if (component.rootOnly) continue
    if (!groups.has(component.category)) groups.set(component.category, [])
    groups.get(component.category)!.push(component)
  }
  return [...groups.entries()]
}

function PaletteItem({ component }: { component: ComponentDef }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `palette:${component.name}`,
    data: { kind: 'palette', name: component.name },
  })
  const addComponent = useDocumentStore((s) => s.addComponent)
  const selectedNodeId = useDocumentStore((s) => s.selectedNodeId)
  const document = useDocumentStore((s) => s.document)

  // ドラッグはポインタ操作が前提。キーボード・スクリーンリーダーからも同じ結果に
  // 到達できるよう、クリックでも「選択中のコンテナ（なければルート）に追加」できるようにする —
  // dnd-kit の KeyboardSensor 配線までは今回のパスに含めていない (roadmap Log 参照)。
  function handleClick() {
    const selected = selectedNodeId ? findNodeById(document.root, selectedNodeId) : undefined
    const selectedAcceptsChildren = selected && editorManifest.componentsByName.get(selected.node.type)?.acceptsChildren
    addComponent(component, selectedAcceptsChildren ? selectedNodeId! : document.root.id!)
  }

  return (
    <button
      ref={setNodeRef}
      type="button"
      className="palette-item"
      style={{ opacity: isDragging ? 0.4 : 1 }}
      onClick={handleClick}
      title={`${component.name} を追加（ドラッグ、またはクリックで選択中のコンテナに追加）`}
      {...listeners}
      {...attributes}
    >
      {component.name}
    </button>
  )
}

export function Palette() {
  return (
    <div className="palette">
      {paletteGroups().map(([category, components]) => (
        <div key={category} className="palette-group">
          <div className="palette-group-title">{CATEGORY_LABEL[category] ?? category}</div>
          <div className="palette-grid">
            {components.map((component) => (
              <PaletteItem key={component.name} component={component} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
