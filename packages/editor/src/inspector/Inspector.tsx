import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { SpectreNode } from '@spectre-ui/manifest/generated'
import type { ComponentDef } from '@spectre-ui/manifest/editor-schema'
import { useDocumentStore } from '../store/documentStore'
import { editorManifest } from '../manifest/editorManifest'
import { findNodeById } from '../tree/nodeOps'
import { PropField } from './fields/PropField'
import { A11yPanel, LayoutPanel, StylePanel, VisibilityPanel } from './CommonPanels'

type Tab = 'props' | 'layout' | 'style' | 'a11y' | 'visibility'

const TAB_LABEL: Record<Tab, string> = {
  props: 'プロパティ',
  layout: 'レイアウト',
  style: 'スタイル',
  a11y: 'アクセシビリティ',
  visibility: '表示条件',
}

/** マニフェスト駆動のインスペクタ (SU-0003 Detailed design 項目1)。 */
export function Inspector() {
  const doc = useDocumentStore((s) => s.document)
  const selectedNodeId = useDocumentStore((s) => s.selectedNodeId)
  const [tab, setTab] = useState<Tab>('props')

  const found = selectedNodeId
    ? selectedNodeId === doc.root.id
      ? { node: doc.root }
      : findNodeById(doc.root, selectedNodeId)
    : undefined

  if (!found) {
    return (
      <div className="inspector inspector-empty">
        <p>キャンバスまたはツリーでノードを選択してください。</p>
      </div>
    )
  }

  const node = found.node
  const componentDef = editorManifest.componentsByName.get(node.type)

  return (
    <div className="inspector">
      <div className="inspector-header">
        <strong>{node.type}</strong>
        <span className="inspector-node-id">{node.id}</span>
      </div>
      <div className="inspector-tabs" role="tablist">
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'tab-active' : ''} onClick={() => setTab(t)}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>
      <div className="inspector-body">
        {tab === 'props' && (componentDef ? <PropsPanel key={node.id} node={node} componentDef={componentDef} /> : <UnknownComponentNotice type={node.type} />)}
        {tab === 'layout' && <LayoutPanel key={node.id} node={node} />}
        {tab === 'style' && <StylePanel key={node.id} node={node} />}
        {tab === 'a11y' && <A11yPanel key={node.id} node={node} />}
        {tab === 'visibility' && <VisibilityPanel key={node.id} node={node} />}
      </div>
    </div>
  )
}

function UnknownComponentNotice({ type }: { type: string }) {
  return (
    <p className="field-error">
      「{type}」はマニフェストに載っていないコンポーネントです。`fallback` があれば古いクライアントはそちらを描画します
      (docs/compatibility.md §3)。プロパティはここでは編集できません — JSON 経由で編集してください。
    </p>
  )
}

function PropsPanel({ node, componentDef }: { node: SpectreNode; componentDef: ComponentDef }) {
  const updateNodeProp = useDocumentStore((s) => s.updateNodeProp)
  // `values` は選択中ノードは変えずに props だけが外部から変わった場合 (undo/redo など) に
  // フォームを追従させる。ノードそのものが変わったときは `key={node.id}` で作り直す。
  const { control } = useForm<Record<string, unknown>>({ values: node.props as Record<string, unknown> })

  function commit(path: string[], value: unknown) {
    updateNodeProp(node.id!, path, value)
  }

  if (componentDef.props.length === 0) {
    return <p className="field-hint">このコンポーネントに編集可能なプロパティはありません。</p>
  }

  return (
    <div className="props-panel">
      {componentDef.props.map(({ name, spec }) => (
        <PropField key={name} control={control} path={[name]} spec={spec} label={name} commit={commit} />
      ))}
    </div>
  )
}
