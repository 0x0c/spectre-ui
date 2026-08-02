import { useDocumentStore } from '../store/documentStore'
import { usePreviewDevice, usePreviewEnv, usePreviewStore } from '../store/previewStore'
import type { InterpolationScope } from '../expression/interpolate'
import { NodeView } from './NodeView'
import { colorValue } from './tokens'

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
      </div>
    </div>
  )
}
