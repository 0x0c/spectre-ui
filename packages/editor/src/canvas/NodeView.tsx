import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { SpectreNode } from '@spectre-ui/manifest/generated'
import { SpectreLimits } from '@spectre-ui/manifest/generated'
import { editorManifest } from '../manifest/editorManifest'
import { useDocumentStore } from '../store/documentStore'
import { evaluateCondition, interpolate, stringifyValue, type InterpolationScope } from '../expression/interpolate'
import { ContainerChrome, LeafContent, cardChrome, containerLayoutStyle, type RenderContext } from './componentViews'
import { layoutStyle, visualStyle } from './layoutStyle'
import { colorValue } from './tokens'

interface CommonProps {
  scope: InterpolationScope
  theme: 'light' | 'dark'
}

/**
 * ヘッダ・下部固定領域など、`children` 以外のスロット (Screen.appBar/bottomBar,
 * List.header/footer) を静的に（選択・ドラッグの対象にせず）描く。この一巡目のスコープは
 * `children` 配列だけをドラッグ&ドロップ・ツリーパネルの対象にしている — roadmap の Log 参照。
 */
export function StaticNode({ node, scope, theme }: { node: SpectreNode | null | undefined } & CommonProps): ReactNode {
  if (!node) return null
  const visibility = node.visibleWhen !== undefined ? evaluateCondition(node.visibleWhen, scope) : { value: true, evaluated: true }
  if (!visibility.value) return null

  const manifestDef = editorManifest.componentsByName.get(node.type)
  const ctx: RenderContext = { scope, theme, renderStatic: (n) => <StaticNode node={n || undefined} scope={scope} theme={theme} /> }
  const outerStyle: CSSProperties = { ...layoutStyle(node.layout), ...visualStyle(node.style, theme), ...cardChrome(node) }

  if (manifestDef?.acceptsChildren) {
    return (
      <div style={outerStyle}>
        <ContainerChrome node={node} ctx={ctx} position="before" />
        <div style={containerLayoutStyle(node)}>
          {(node.children ?? []).map((child, i) => (
            <StaticNode key={child.id ?? i} node={child} scope={scope} theme={theme} />
          ))}
        </div>
        <ContainerChrome node={node} ctx={ctx} position="after" />
      </div>
    )
  }
  return (
    <div style={outerStyle}>
      <LeafContent node={node} ctx={ctx} />
    </div>
  )
}

/** VStack/HStack/... の空のコンテナに出す「ここにドラッグ」の案内。 */
function EmptyDropHint({ isOver }: { isOver: boolean }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: isOver ? '#3B5BDB' : '#9AA0AC',
        border: `1px dashed ${isOver ? '#3B5BDB' : '#C7C8CC'}`,
        borderRadius: 6,
        padding: '10px 8px',
        textAlign: 'center',
      }}
    >
      ここにパレットからドラッグ
    </div>
  )
}

interface NodeViewProps extends CommonProps {
  node: SpectreNode
}

/** 木の中を再帰して選択可能・ドラッグ可能なキャンバスノードを描く、メインのエントリポイント。 */
export function NodeView({ node, scope, theme }: NodeViewProps): ReactNode {
  if (node.repeat) {
    // `visibleWhen` は repeat の内側では item/index を参照できてよいはずなので、
    // repeat の展開後・スコープに item/index を足したあとに、要素ごとに評価する
    // (RepeatedNode 側)。ここで先に評価してしまうと item/index が未束縛のまま判定してしまう。
    return <RepeatedNode node={node} scope={scope} theme={theme} />
  }
  const visibility = node.visibleWhen !== undefined ? evaluateCondition(node.visibleWhen, scope) : { value: true, evaluated: true }
  if (!visibility.value) return null
  return <InteractiveNode node={node} scope={scope} theme={theme} unevaluatedVisibility={!visibility.evaluated} />
}

function RepeatedNode({ node, scope, theme }: NodeViewProps): ReactNode {
  const repeat = node.repeat!
  const items = interpolate(repeat.for, scope)
  const asName = repeat.as ?? 'item'
  const indexAsName = repeat.indexAs ?? 'index'

  if (!Array.isArray(items) || items.length === 0) {
    return repeat.emptyView ? <StaticNode node={repeat.emptyView} scope={scope} theme={theme} /> : null
  }

  // docs/architecture.md §7: repeat の展開は maxRepeatItems (500) を超えない。
  // ドキュメント側の limit があれば、それとこの上限の小さい方を使う。
  const cap = Math.min(items.length, repeat.limit ?? Infinity, SpectreLimits.maxRepeatItems)
  const { repeat: _omit, ...withoutRepeat } = node
  void _omit

  return (
    <>
      {items.slice(0, cap).map((item, index) => {
        const itemScope: InterpolationScope = { ...scope, [asName]: item, [indexAsName]: index }
        const visibility = node.visibleWhen !== undefined ? evaluateCondition(node.visibleWhen, itemScope) : { value: true, evaluated: true }
        if (!visibility.value) return null
        const keyExpr = repeat.key ? interpolate(repeat.key, itemScope) : index
        return (
          <InteractiveNode
            // 展開された各要素は木の中に実在するノードではない（実在するのは repeat を
            // 持つ元ノード1つだけ）ので、選択は元ノードの id にマップし、ドラッグ&ドロップは
            // 無効にする — さもないと「選択されて見えるのに Inspector は空」「ドラッグしても
            // 何も起きない」という事故になる。
            key={stringifyValue(keyExpr) || index}
            node={{ ...withoutRepeat, id: `${node.id}__${index}` } as SpectreNode}
            scope={itemScope}
            theme={theme}
            unevaluatedVisibility={false}
            selectId={node.id}
            interactiveDnd={false}
          />
        )
      })}
    </>
  )
}

interface InteractiveNodeProps extends NodeViewProps {
  unevaluatedVisibility: boolean
  /** repeat で展開された要素用: クリックしたとき実際に選択する id（元ノードの id）。 */
  selectId?: string
  /** repeat で展開された要素はドキュメント木に実在しないので、ドラッグ&ドロップの対象にしない。 */
  interactiveDnd?: boolean
}

function InteractiveNode({ node, scope, theme, unevaluatedVisibility, selectId, interactiveDnd = true }: InteractiveNodeProps): ReactNode {
  const selectedNodeId = useDocumentStore((s) => s.selectedNodeId)
  const select = useDocumentStore((s) => s.select)
  const manifestDef = editorManifest.componentsByName.get(node.type)
  const effectiveSelectId = selectId ?? node.id

  const draggable = useDraggable({ id: `node:${node.id}`, data: { kind: 'node', id: node.id }, disabled: !interactiveDnd })
  const droppable = useDroppable({
    id: `append:${node.id}`,
    data: { kind: 'append', containerId: node.id },
    disabled: !interactiveDnd || !manifestDef?.acceptsChildren,
  })

  const selected = selectedNodeId === effectiveSelectId
  const ctx: RenderContext = { scope, theme, renderStatic: (n) => <StaticNode node={n || undefined} scope={scope} theme={theme} /> }

  const outerStyle: CSSProperties = {
    ...layoutStyle(node.layout),
    ...visualStyle(node.style, theme),
    ...cardChrome(node),
    position: 'relative',
    boxSizing: 'border-box',
    outline: selected ? `2px solid ${colorValue('primary', theme)}` : unevaluatedVisibility ? `1px dashed ${colorValue('warning', theme)}` : undefined,
    outlineOffset: selected ? 1 : undefined,
    opacity: draggable.isDragging ? 0.4 : 1,
    cursor: interactiveDnd ? 'grab' : 'default',
  }

  function handleClick(event: React.MouseEvent) {
    event.stopPropagation()
    select(effectiveSelectId ?? null)
  }

  const inner = manifestDef?.acceptsChildren ? (
    <>
      <ContainerChrome node={node} ctx={ctx} position="before" />
      <div
        ref={droppable.setNodeRef}
        style={{
          ...containerLayoutStyle(node),
          minHeight: 28,
          borderRadius: 4,
          background: droppable.isOver ? 'rgba(59,91,219,0.08)' : undefined,
        }}
      >
        {(node.children ?? []).length === 0 && <EmptyDropHint isOver={droppable.isOver} />}
        {(node.children ?? []).map((child) => (
          <Fragment key={child.id}>
            <NodeView node={child} scope={scope} theme={theme} />
          </Fragment>
        ))}
      </div>
      <ContainerChrome node={node} ctx={ctx} position="after" />
    </>
  ) : (
    <LeafContent node={node} ctx={ctx} />
  )

  return (
    <div
      ref={draggable.setNodeRef}
      style={outerStyle}
      onClick={handleClick}
      title={unevaluatedVisibility ? 'fx: visibleWhen はこの近似プレビューでは評価されません（既定で表示）' : undefined}
      data-node-id={effectiveSelectId}
      data-node-type={node.type}
      {...draggable.listeners}
      {...draggable.attributes}
    >
      {inner}
    </div>
  )
}
