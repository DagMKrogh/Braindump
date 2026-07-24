import { useState } from 'react'
import { X } from 'lucide-react'
import type { LocalNote } from '@braindump/shared'
import { getType } from '../../lib/noteTypeRegistry'
import s from '../../styles/layout.module.css'

interface Props {
  note: LocalNote
  onSave: (changes: { metadata: Record<string, unknown> }) => void
}

/** Editable comma-separated list of names/values (e.g. attendees). */
function UserListField({ value, onChange }: Readonly<{ value: string[]; onChange: (v: string[]) => void }>) {
  const [input, setInput] = useState('')

  function add() {
    const trimmed = input.trim()
    if (!trimmed || value.includes(trimmed)) return
    onChange([...value, trimmed])
    setInput('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
        {value.map((v) => (
          <span key={v} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
            fontSize: '0.75rem', padding: '0.1rem 0.4rem',
            background: 'var(--color-surface-2)', borderRadius: 12,
            border: '1px solid var(--color-border)',
          }}>
            {v}
            <button
              onClick={() => onChange(value.filter(x => x !== v))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-text-muted)', display: 'flex' }}
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.3rem' }}>
        <input
          className={s.metaInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="Add name…"
          style={{ flex: 1 }}
        />
        <button
          className={`${s.btn} ${s.btnGhost}`}
          onClick={add}
          disabled={!input.trim()}
          style={{ flexShrink: 0 }}
        >
          Add
        </button>
      </div>
    </div>
  )
}

export function MetadataPanel({ note, onSave }: Props) {
  const typeDef = getType(note.type)
  if (!typeDef || typeDef.metadataFields.length === 0) return null

  const meta = note.metadata as Record<string, unknown>

  function handleChange(key: string, value: unknown) {
    onSave({ metadata: { ...meta, [key]: value } })
  }

  return (
    <div className={s.metadataPanel}>
      {typeDef.metadataFields.map((field) => {
        const value = meta[field.key]

        if (field.type === 'user-list') {
          return (
            <div key={field.key} className={s.metaField} style={{ minWidth: 200, flex: 1 }}>
              <label className={s.metaLabel}>{field.label}</label>
              <UserListField
                value={Array.isArray(value) ? (value as string[]) : []}
                onChange={(v) => handleChange(field.key, v)}
              />
            </div>
          )
        }

        if (field.type === 'select' && field.options) {
          return (
            <div key={field.key} className={s.metaField}>
              <label className={s.metaLabel}>{field.label}</label>
              <select
                className={`${s.metaInput} ${s.metaSelect}`}
                value={(value as string) ?? ''}
                onChange={(e) => handleChange(field.key, e.target.value)}
              >
                {!field.required && <option value="">—</option>}
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          )
        }

        if (field.type === 'boolean') {
          return (
            <div key={field.key} className={s.metaField}>
              <label className={s.metaLabel}>{field.label}</label>
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => handleChange(field.key, e.target.checked)}
                style={{ marginTop: '0.25rem' }}
              />
            </div>
          )
        }

        if (field.type === 'textarea') {
          return (
            <div key={field.key} className={s.metaField} style={{ minWidth: 200, flex: 1 }}>
              <label className={s.metaLabel}>{field.label}</label>
              <textarea
                className={s.metaInput}
                defaultValue={(value as string) ?? ''}
                placeholder={field.placeholder}
                rows={2}
                onBlur={(e) => handleChange(field.key, e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>
          )
        }

        const inputType =
          field.type === 'date' ? 'date' :
          field.type === 'datetime' ? 'datetime-local' :
          field.type === 'number' ? 'number' : 'text'

        return (
          <div key={field.key} className={s.metaField}>
            <label className={s.metaLabel}>{field.label}</label>
            <input
              type={inputType}
              className={s.metaInput}
              defaultValue={(value as string) ?? ''}
              placeholder={field.placeholder}
              onBlur={(e) => handleChange(field.key, e.target.value || undefined)}
            />
          </div>
        )
      })}
    </div>
  )
}
