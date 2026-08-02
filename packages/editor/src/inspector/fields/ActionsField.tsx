import { ActionEditor } from '../../actions/ActionEditor'

export function ActionsField({ label, value, onChange }: { label: string; value: unknown[] | undefined; onChange: (v: unknown[]) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <ActionEditor value={value} onChange={onChange} />
    </div>
  )
}
