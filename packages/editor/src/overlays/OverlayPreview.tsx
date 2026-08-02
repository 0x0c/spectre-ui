import { useEffect, useRef } from 'react'
import type { SpectreOverlay } from '@spectre-ui/manifest/generated'
import { useDocumentStore } from '../store/documentStore'
import { previewText, type InterpolationScope } from '../expression/interpolate'
import { StaticNode } from '../canvas/NodeView'
import { colorValue } from '../canvas/tokens'

type OverlayRecord = SpectreOverlay & Record<string, unknown>

interface Props {
  scope: InterpolationScope
  theme: 'light' | 'dark'
}

/**
 * 選択中のオーバレイを、ドキュメントが指定した見え方でキャンバスに重ねる
 * (SU-0014 Detailed design 項目7)。
 *
 * これは実機のプレビューではなく、`presentation` の指定が画面のどこに何を出すのかを
 * 確かめるためのもの。実機との差は EnvControls のバナーが一括して断ってある。
 */
export function OverlayPreview({ scope, theme }: Props) {
  const doc = useDocumentStore((s) => s.document)
  const selectedId = useDocumentStore((s) => s.selectedOverlayId)
  const selectOverlay = useDocumentStore((s) => s.selectOverlay)
  const surfaceRef = useRef<HTMLDivElement>(null)

  const overlay = ((doc.overlays ?? []) as OverlayRecord[]).find((item) => item.id === selectedId)
  const presentationStyle = ((overlay?.presentation ?? {}) as Record<string, unknown>).style

  // デバイス枠はキャンバスの見えている範囲より背が高いことがある。中央のダイアログが
  // 枠の中央に来ると画面の外に落ちるので、選んだ時点で見える位置まで送る。
  useEffect(() => {
    surfaceRef.current?.scrollIntoView?.({ block: 'center' })
  }, [selectedId, presentationStyle])

  if (!overlay) return null

  const presentation = (overlay.presentation ?? {}) as Record<string, unknown>
  const dismissible = overlay.dismissible !== false
  const dimBackground = presentation.dimBackground !== false
  const style = overlay.kind === 'sheet' ? ((presentation.style as string | undefined) ?? 'sheet') : 'dialog'
  const text = (value: unknown) => (value == null ? '' : previewText(value, scope))

  const surface = colorValue('surface', theme)
  const onSurface = colorValue('onSurface', theme)

  return (
    <div
      className={`overlay-preview overlay-preview-${overlay.kind === 'toast' ? 'toast' : style}`}
      // 背景の暗転は presentation.dimBackground の指定そのもの。既定は暗転する。
      style={{ background: dimBackground && overlay.kind !== 'toast' ? 'rgba(0,0,0,0.4)' : 'transparent' }}
      onClick={() => {
        if (dismissible) selectOverlay(null)
      }}
    >
      <div
        ref={surfaceRef}
        className="overlay-preview-surface"
        style={{ background: surface, color: onSurface }}
        onClick={(event) => event.stopPropagation()}
      >
        {overlay.kind === 'toast' ? (
          <span>{text(overlay.message)}</span>
        ) : (
          <>
            {overlay.icon != null && <div className="overlay-preview-icon">{String(overlay.icon)}</div>}
            {overlay.title != null && <strong className="overlay-preview-title">{text(overlay.title)}</strong>}
            {overlay.message != null && <p className="overlay-preview-message">{text(overlay.message)}</p>}
            {overlay.kind === 'sheet' && overlay.root != null && (
              <StaticNode node={overlay.root as never} scope={scope} theme={theme} />
            )}
            {overlay.kind === 'alert' && (
              <div className={overlay.buttonLayout === 'vertical' ? 'overlay-preview-buttons-vertical' : 'overlay-preview-buttons'}>
                {((overlay.buttons ?? []) as { label?: string; role?: string }[]).map((button, index) => (
                  <button key={index} type="button" disabled>
                    {text(button.label)}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
