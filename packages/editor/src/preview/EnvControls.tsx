import { DEVICE_PRESETS, FONT_SCALE_PRESETS, LOCALE_PRESETS, usePreviewStore } from '../store/previewStore'
import { useDocumentStore } from '../store/documentStore'

/**
 * デバイス・ロケール・テーマ・フォントスケールの切り替え (SU-0003 Detailed design 項目8) と
 * undo/redo、そして近似プレビューであることを明示するバナー (ADR-0005 の「Consequences」)。
 */
export function EnvControls() {
  const deviceId = usePreviewStore((s) => s.deviceId)
  const theme = usePreviewStore((s) => s.theme)
  const locale = usePreviewStore((s) => s.locale)
  const fontScale = usePreviewStore((s) => s.fontScale)
  const setDevice = usePreviewStore((s) => s.setDevice)
  const setTheme = usePreviewStore((s) => s.setTheme)
  const setLocale = usePreviewStore((s) => s.setLocale)
  const setFontScale = usePreviewStore((s) => s.setFontScale)

  const undo = useDocumentStore((s) => s.undo)
  const redo = useDocumentStore((s) => s.redo)
  const canUndo = useDocumentStore((s) => s.undoStack.length > 0)
  const canRedo = useDocumentStore((s) => s.redoStack.length > 0)

  return (
    <div className="env-controls">
      <div className="env-controls-row">
        <select value={deviceId} onChange={(e) => setDevice(e.target.value)} aria-label="デバイス">
          {DEVICE_PRESETS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
        <select value={locale} onChange={(e) => setLocale(e.target.value)} aria-label="ロケール">
          {LOCALE_PRESETS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select value={theme} onChange={(e) => setTheme(e.target.value as 'light' | 'dark')} aria-label="テーマ">
          <option value="light">ライト</option>
          <option value="dark">ダーク</option>
        </select>
        <select value={fontScale} onChange={(e) => setFontScale(Number(e.target.value))} aria-label="文字サイズ">
          {FONT_SCALE_PRESETS.map((f) => (
            <option key={f} value={f}>
              {Math.round(f * 100)}%
            </option>
          ))}
        </select>
        <span className="env-controls-spacer" />
        <button type="button" onClick={() => undo()} disabled={!canUndo} title="元に戻す">
          ↶
        </button>
        <button type="button" onClick={() => redo()} disabled={!canRedo} title="やり直す">
          ↷
        </button>
      </div>
      <p className="fidelity-banner">
        これは近似プレビューです。SwiftUI / Jetpack Compose の実機とは、フォントの折り返しや行間、スクロールの挙動などが
        異なる場合があります。公開前の最終確認は実機ミラー（SU-0009、この変更の対象外）で行ってください。
      </p>
    </div>
  )
}
