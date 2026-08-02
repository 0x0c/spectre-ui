import { useDocumentStore } from '../store/documentStore'
import { usePreviewDevice, usePreviewEnv, usePreviewStore } from '../store/previewStore'
import type { InterpolationScope } from '../expression/interpolate'
import { NodeView } from './NodeView'
import { colorValue } from './tokens'
import { OverlayPreview } from '../overlays/OverlayPreview'

/**
 * 近似プレビュー本体 (SU-0003 Detailed design 項目2・8)。ADR-0005 の通り、これは3つ目の
 * レンダラであって実機と完全一致しない — その注意書きはここではなく EnvControls の
 * バナーに一箇所だけ出す（あちこちに重複させない）。
 */
export function Canvas() {
  const doc = useDocumentStore((s) => s.document)
  const select = useDocumentStore((s) => s.select)
  const device = usePreviewDevice()
  const theme = usePreviewStore((s) => s.theme)
  const env = usePreviewEnv()

  const scope: InterpolationScope = { data: doc.data, state: doc.state, env }
  const isEmpty = (doc.root.children?.length ?? 0) === 0

  return (
    <div className="canvas-scroll" onClick={() => select(null)}>
      <div
        className="device-frame"
        style={{
          width: device.width,
          minHeight: Math.min(device.height, 760),
          background: colorValue('background', theme),
          fontSize: `${env.fontScale * 100}%`,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <NodeView node={doc.root} scope={scope} theme={theme} />
        {/* 空のキャンバスで次の一手を示す (SU-0013 Detailed design 項目1)。ルートを
            消してしまうことはできないので、子が0件かどうかだけを見ればよい。 */}
        {isEmpty && (
          <p className="canvas-empty">
            パレットからコンポーネントをドラッグして置いてください。
            <br />
            サンプルを読みたいときは、ツールバーの「サンプルを開く」から。
          </p>
        )}
        <OverlayPreview scope={scope} theme={theme} />
      </div>
    </div>
  )
}
