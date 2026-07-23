import type { LocalNote } from '@braindump/shared'
import { getType } from '../../lib/noteTypeRegistry'
import s from '../../styles/layout.module.css'

interface Props {
  note: LocalNote
  onSave: (changes: { metadata: Record<string, unknown> }) => void
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
