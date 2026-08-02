import type { SpectreOverlay } from '@spectre-ui/manifest/generated'
import { type OverlayKind, useDocumentStore } from '../store/documentStore'

const KIND_LABELS: Record<OverlayKind, string> = {
  sheet: 'シート',
  alert: 'アラート',
  toast: 'トースト',
}

/** 見た目のオプションが取りうる値。docs/spec/schema.md §3.1・§3.2 と同じ並び。 */
const STYLES = ['sheet', 'fullScreen', 'dialog'] as const
const TONES = ['neutral', 'success', 'warning', 'error'] as const
const BUTTON_LAYOUTS = ['auto', 'horizontal', 'vertical'] as const
const DETENTS = ['small', 'medium', 'large'] as const

type OverlayRecord = SpectreOverlay & Record<string, unknown>

/**
 * オーバレイの一覧と編集 (SU-0014 Detailed design 項目7)。
 *
 * 表示オプションのフィールドはどれも「未指定」を選べる。仕様では、書かなかったキーは
 * 既定値で補われずに欠けたままになる (docs/spec/schema.md §3.1)。エディタから
 * 「既定のまま」と「明示的に既定と同じ値を書いた」を区別できないと、その区別を
 * ドキュメントに残せない。
 */
export function OverlayPanel() {
  const doc = useDocumentStore((s) => s.document)
  const selectedId = useDocumentStore((s) => s.selectedOverlayId)
  const selectOverlay = useDocumentStore((s) => s.selectOverlay)
  const addOverlay = useDocumentStore((s) => s.addOverlay)
  const removeOverlay = useDocumentStore((s) => s.removeOverlay)
  const update = useDocumentStore((s) => s.updateOverlayField)

  const overlays = (doc.overlays ?? []) as OverlayRecord[]
  const selected = overlays.find((overlay) => overlay.id === selectedId) ?? null

  return (
    <div className="overlay-panel">
      <div className="overlay-list">
        <div className="overlay-list-actions">
          {(Object.keys(KIND_LABELS) as OverlayKind[]).map((kind) => (
            <button key={kind} type="button" onClick={() => addOverlay(kind)}>
              + {KIND_LABELS[kind]}
            </button>
          ))}
        </div>
        {overlays.length === 0 && <p className="field-hint">オーバレイはまだありません。</p>}
        <ul>
          {overlays.map((overlay) => (
            <li key={overlay.id}>
              <button
                type="button"
                className={overlay.id === selectedId ? 'chip chip-active' : 'chip'}
                onClick={() => selectOverlay(overlay.id)}
              >
                {overlay.id}（{KIND_LABELS[overlay.kind as OverlayKind]}）
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="overlay-editor">
        {!selected && <p className="inspector-empty">オーバレイを選ぶと、ここで表示オプションを編集できます。</p>}
        {selected && (
          <>
            <div className="inspector-header">
              <strong>{KIND_LABELS[selected.kind as OverlayKind]}</strong>
              <button type="button" onClick={() => removeOverlay(selected.id)}>
                削除
              </button>
            </div>

            <TextField label="id" value={selected.id} onCommit={(v) => update(selected.id, ['id'], v)} />
            <TextField
              label="title"
              value={(selected.title as string) ?? ''}
              onCommit={(v) => update(selected.id, ['title'], v || undefined)}
            />
            {selected.kind !== 'sheet' && (
              <TextField
                label="message"
                value={(selected.message as string) ?? ''}
                onCommit={(v) => update(selected.id, ['message'], v || undefined)}
              />
            )}
            <OptionalBoolField
              label="dismissible"
              value={selected.dismissible as boolean | undefined}
              onChange={(v) => update(selected.id, ['dismissible'], v)}
            />

            {selected.kind === 'sheet' && <SheetFields overlay={selected} update={update} />}
            {selected.kind === 'alert' && <AlertFields overlay={selected} update={update} />}
            {selected.kind === 'toast' && <ToastFields overlay={selected} update={update} />}
          </>
        )}
      </div>
    </div>
  )
}

type UpdateFn = (id: string, path: (string | number)[], value: unknown) => void

function SheetFields({ overlay, update }: { overlay: OverlayRecord; update: UpdateFn }) {
  const presentation = (overlay.presentation ?? {}) as Record<string, unknown>
  const detents = (overlay.detents as string[] | undefined) ?? []

  return (
    <fieldset className="prop-fieldset">
      <legend>presentation（見え方）</legend>
      <OptionalEnumField
        label="style"
        options={STYLES}
        value={presentation.style as string | undefined}
        onChange={(v) => update(overlay.id, ['presentation', 'style'], v)}
      />
      <OptionalBoolField
        label="dimBackground"
        value={presentation.dimBackground as boolean | undefined}
        onChange={(v) => update(overlay.id, ['presentation', 'dimBackground'], v)}
      />
      <OptionalBoolField
        label="dismissOnBackdrop"
        value={presentation.dismissOnBackdrop as boolean | undefined}
        onChange={(v) => update(overlay.id, ['presentation', 'dismissOnBackdrop'], v)}
      />
      <OptionalBoolField
        label="dragToDismiss"
        value={presentation.dragToDismiss as boolean | undefined}
        onChange={(v) => update(overlay.id, ['presentation', 'dragToDismiss'], v)}
      />
      <div className="field">
        <label>detents</label>
        <div className="token-chips">
          {DETENTS.map((detent) => {
            const on = detents.includes(detent)
            return (
              <button
                key={detent}
                type="button"
                className={on ? 'chip chip-active' : 'chip'}
                onClick={() => {
                  const next = on ? detents.filter((d) => d !== detent) : [...detents, detent]
                  update(overlay.id, ['detents'], next.length > 0 ? next : undefined)
                }}
              >
                {detent}
              </button>
            )
          })}
        </div>
      </div>
    </fieldset>
  )
}

function AlertFields({ overlay, update }: { overlay: OverlayRecord; update: UpdateFn }) {
  const presentation = (overlay.presentation ?? {}) as Record<string, unknown>
  const buttons = (overlay.buttons ?? []) as { label?: string; role?: string }[]

  return (
    <>
      <fieldset className="prop-fieldset">
        <legend>表示オプション</legend>
        <OptionalEnumField
          label="tone"
          options={TONES}
          value={overlay.tone as string | undefined}
          onChange={(v) => update(overlay.id, ['tone'], v)}
        />
        <TextField
          label="icon"
          value={(overlay.icon as string) ?? ''}
          onCommit={(v) => update(overlay.id, ['icon'], v || undefined)}
        />
        <OptionalEnumField
          label="buttonLayout"
          options={BUTTON_LAYOUTS}
          value={overlay.buttonLayout as string | undefined}
          onChange={(v) => update(overlay.id, ['buttonLayout'], v)}
        />
        <OptionalBoolField
          label="presentation.dimBackground"
          value={presentation.dimBackground as boolean | undefined}
          onChange={(v) => update(overlay.id, ['presentation', 'dimBackground'], v)}
        />
        <OptionalBoolField
          label="presentation.dismissOnBackdrop"
          value={presentation.dismissOnBackdrop as boolean | undefined}
          onChange={(v) => update(overlay.id, ['presentation', 'dismissOnBackdrop'], v)}
        />
      </fieldset>
      <fieldset className="prop-fieldset">
        <legend>buttons</legend>
        {buttons.map((button, index) => (
          <div key={index} className="options-row">
            <input
              aria-label={`buttons[${index}].label`}
              defaultValue={button.label ?? ''}
              onBlur={(e) => update(overlay.id, ['buttons', index, 'label'], e.target.value)}
            />
            <select
              aria-label={`buttons[${index}].role`}
              value={button.role ?? 'default'}
              onChange={(e) => update(overlay.id, ['buttons', index, 'role'], e.target.value)}
            >
              {['default', 'cancel', 'destructive'].map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
        ))}
        <p className="field-hint">アラートのボタンは1〜3個です（docs/spec/schema.md §3）。</p>
      </fieldset>
    </>
  )
}

function ToastFields({ overlay, update }: { overlay: OverlayRecord; update: UpdateFn }) {
  return (
    <fieldset className="prop-fieldset">
      <legend>表示オプション</legend>
      <OptionalEnumField
        label="tone"
        options={TONES}
        value={overlay.tone as string | undefined}
        onChange={(v) => update(overlay.id, ['tone'], v)}
      />
      <div className="field">
        <label htmlFor={`${overlay.id}-durationMs`}>durationMs</label>
        <input
          id={`${overlay.id}-durationMs`}
          type="number"
          min={1000}
          max={10000}
          defaultValue={(overlay.durationMs as number | undefined) ?? ''}
          onBlur={(e) => update(overlay.id, ['durationMs'], e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </div>
      <p className="field-hint">トーストは `presentation` を取りません（docs/spec/schema.md §3.1）。</p>
    </fieldset>
  )
}

function TextField({ label, value, onCommit }: { label: string; value: string; onCommit: (value: string) => void }) {
  return (
    <div className="field">
      <label htmlFor={`overlay-${label}`}>{label}</label>
      {/* defaultValue + onBlur にしてあるのは、1文字ごとに undo 履歴を積まないため。 */}
      <input id={`overlay-${label}`} key={value} defaultValue={value} onBlur={(e) => onCommit(e.target.value)} />
    </div>
  )
}

const UNSET = '（未指定）'

function OptionalBoolField({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean | undefined
  onChange: (value: boolean | undefined) => void
}) {
  return (
    <div className="field">
      <label htmlFor={`overlay-${label}`}>{label}</label>
      <select
        id={`overlay-${label}`}
        value={value === undefined ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value === 'true')}
      >
        <option value="">{UNSET}</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    </div>
  )
}

function OptionalEnumField({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly string[]
  value: string | undefined
  onChange: (value: string | undefined) => void
}) {
  return (
    <div className="field">
      <label htmlFor={`overlay-${label}`}>{label}</label>
      <select
        id={`overlay-${label}`}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
      >
        <option value="">{UNSET}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}
