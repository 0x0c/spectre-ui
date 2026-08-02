import type { SpectreLayout, SpectreNode } from '@spectre-ui/manifest/generated'
import { editorManifest } from '../manifest/editorManifest'
import { useDocumentStore } from '../store/documentStore'

/**
 * `layout` / `style` / `a11y` は全ノード共通のフィールドだが、`commonNodeProps` の
 * マニフェスト表現は `{"type": "layout"}` のように種類名だけで、中の shape までは
 * 持たない（実体は generated.ts の SpectreLayout/SpectreStyle/SpectreA11y という
 * TypeScript の形）。そのためコンポーネント固有の Props タブ (PropField.tsx) とは違い、
 * ここは手書きの固定フィールド集合になっている。
 */
function useFieldCommit(nodeId: string) {
  const updateNodeField = useDocumentStore((s) => s.updateNodeField)
  return (path: (string | number)[], value: unknown) => updateNodeField(nodeId, path, value)
}

function TokenSelect({ tokens, value, onChange, allowNone = true }: { tokens: string[]; value: string | undefined; onChange: (v: string | undefined) => void; allowNone?: boolean }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
      {allowNone && <option value="" />}
      {tokens.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  )
}

function SizeInput({ value, onChange }: { value: SpectreLayout['width']; onChange: (v: SpectreLayout['width']) => void }) {
  const mode = value === 'fill' || value === 'wrap' ? value : typeof value === 'number' ? 'number' : 'unset'
  return (
    <span className="size-input">
      <select
        value={mode}
        onChange={(e) => {
          const next = e.target.value
          if (next === 'unset') onChange(undefined)
          else if (next === 'number') onChange(0)
          else onChange(next as 'fill' | 'wrap')
        }}
      >
        <option value="unset">—</option>
        <option value="fill">fill</option>
        <option value="wrap">wrap</option>
        <option value="number">px</option>
      </select>
      {mode === 'number' && <input type="number" value={typeof value === 'number' ? value : 0} onChange={(e) => onChange(Number(e.target.value))} />}
    </span>
  )
}

export function LayoutPanel({ node }: { node: SpectreNode }) {
  const commit = useFieldCommit(node.id!)
  const layout = node.layout ?? {}
  const spacingTokens = Object.keys(editorManifest.tokens.spacing)
  return (
    <div className="common-panel">
      <div className="field">
        <label>width</label>
        <SizeInput value={layout.width} onChange={(v) => commit(['layout', 'width'], v)} />
      </div>
      <div className="field">
        <label>height</label>
        <SizeInput value={layout.height} onChange={(v) => commit(['layout', 'height'], v)} />
      </div>
      <div className="field">
        <label>weight（flex の伸び率）</label>
        <input
          type="number"
          value={layout.weight ?? ''}
          onChange={(e) => commit(['layout', 'weight'], e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </div>
      <div className="field">
        <label>alignSelf</label>
        <TokenSelect tokens={['start', 'center', 'end', 'stretch']} value={layout.alignSelf} onChange={(v) => commit(['layout', 'alignSelf'], v)} />
      </div>
      <div className="field">
        <label>padding（均等）</label>
        <TokenSelect tokens={spacingTokens} value={typeof layout.padding === 'string' ? layout.padding : undefined} onChange={(v) => commit(['layout', 'padding'], v)} />
      </div>
      <div className="field">
        <label>margin（均等）</label>
        <TokenSelect tokens={spacingTokens} value={typeof layout.margin === 'string' ? layout.margin : undefined} onChange={(v) => commit(['layout', 'margin'], v)} />
      </div>
    </div>
  )
}

export function StylePanel({ node }: { node: SpectreNode }) {
  const commit = useFieldCommit(node.id!)
  const style = node.style ?? {}
  const colorTokens = editorManifest.tokens.color
  const radiusTokens = Object.keys(editorManifest.tokens.radius)
  return (
    <div className="common-panel">
      <div className="field">
        <label>background</label>
        <TokenSelect tokens={colorTokens} value={style.background} onChange={(v) => commit(['style', 'background'], v)} />
      </div>
      <div className="field">
        <label>foreground</label>
        <TokenSelect tokens={colorTokens} value={style.foreground} onChange={(v) => commit(['style', 'foreground'], v)} />
      </div>
      <div className="field">
        <label>radius</label>
        <TokenSelect tokens={radiusTokens} value={style.radius} onChange={(v) => commit(['style', 'radius'], v)} />
      </div>
      <div className="field">
        <label>elevation</label>
        <TokenSelect tokens={['0', '1', '2', '3']} value={style.elevation !== undefined ? String(style.elevation) : undefined} onChange={(v) => commit(['style', 'elevation'], v === undefined ? undefined : Number(v))} />
      </div>
      <div className="field">
        <label>opacity</label>
        <input
          type="number"
          min={0}
          max={1}
          step={0.1}
          value={style.opacity ?? ''}
          onChange={(e) => commit(['style', 'opacity'], e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </div>
    </div>
  )
}

export function A11yPanel({ node }: { node: SpectreNode }) {
  const commit = useFieldCommit(node.id!)
  const a11y = node.a11y ?? {}
  return (
    <div className="common-panel">
      <div className="field">
        <label>label</label>
        <input value={a11y.label ?? ''} onChange={(e) => commit(['a11y', 'label'], e.target.value || undefined)} />
      </div>
      <div className="field">
        <label>hint</label>
        <input value={a11y.hint ?? ''} onChange={(e) => commit(['a11y', 'hint'], e.target.value || undefined)} />
      </div>
      <div className="field">
        <label>role</label>
        <TokenSelect tokens={['button', 'image', 'header', 'link', 'none']} value={a11y.role} onChange={(v) => commit(['a11y', 'role'], v)} />
      </div>
      <div className="field switch-field-row">
        <label>hidden</label>
        <input type="checkbox" checked={Boolean(a11y.hidden)} onChange={(e) => commit(['a11y', 'hidden'], e.target.checked)} />
      </div>
      <div className="field">
        <label>liveRegion</label>
        <TokenSelect tokens={['off', 'polite', 'assertive']} value={a11y.liveRegion} onChange={(v) => commit(['a11y', 'liveRegion'], v)} />
      </div>
    </div>
  )
}

export function VisibilityPanel({ node }: { node: SpectreNode }) {
  const commit = useFieldCommit(node.id!)
  return (
    <div className="common-panel">
      <div className="field">
        <label>
          visibleWhen <span className="fx-badge">fx</span>
        </label>
        <input
          value={node.visibleWhen ?? ''}
          placeholder="${data.product.stock > 0}"
          onChange={(e) => commit(['visibleWhen'], e.target.value || undefined)}
        />
        <p className="field-hint">空欄なら常に表示。単純パス以外はこの近似プレビューでは評価されません（既定で表示扱い）。</p>
      </div>
    </div>
  )
}
