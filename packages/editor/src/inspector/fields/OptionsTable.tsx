interface Option {
  value?: string
  label?: string
  enabled?: boolean
}

/** `editor.widget: "options"` — `{value,label}` の表エディタ (docs/editor.md §2)。 */
export function OptionsTable({ value, onChange }: { value: unknown; onChange: (next: Option[]) => void }) {
  const options: Option[] = Array.isArray(value) ? value : []

  function update(index: number, patch: Partial<Option>) {
    onChange(options.map((o, i) => (i === index ? { ...o, ...patch } : o)))
  }

  if (typeof value === 'string') {
    return <p className="field-hint">式 ({value}) にバインドされています。表編集は静的な選択肢のときだけ使えます。</p>
  }

  return (
    <div className="options-table">
      {options.map((option, i) => (
        <div key={i} className="options-row">
          <input
            aria-label="value"
            placeholder="value"
            value={option.value ?? ''}
            onChange={(e) => update(i, { value: e.target.value })}
          />
          <input
            aria-label="label"
            placeholder="label"
            value={option.label ?? ''}
            onChange={(e) => update(i, { label: e.target.value })}
          />
          <button type="button" aria-label="この選択肢を削除" onClick={() => onChange(options.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...options, { value: '', label: '' }])}>
        + 選択肢を追加
      </button>
    </div>
  )
}
