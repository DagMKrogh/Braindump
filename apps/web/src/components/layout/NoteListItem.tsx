import type { LocalNote } from '@braindump/shared'
import { getType } from '../../lib/noteTypeRegistry'
import s from '../../styles/layout.module.css'

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

interface Props {
  note: LocalNote
  isActive: boolean
  onClick: () => void
}

export function NoteListItem({ note, isActive, onClick }: Props) {
  const typeDef = getType(note.type)

  return (
    <div
      className={`${s.noteItem} ${isActive ? s.noteItemActive : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className={s.noteItemHeader}>
        <span className={s.noteItemTitle}>{note.title || 'Untitled'}</span>
        {note.syncStatus === 'pending' && <span className={s.syncDot} title="Pending sync" />}
      </div>
      <div className={s.noteItemMeta}>
        {typeDef && (
          <span
            className={s.typeBadge}
            style={{ background: `${typeDef.color}22`, color: typeDef.color }}
          >
            {typeDef.label}
          </span>
        )}
        <span className={s.noteItemDate}>{formatDate(note.updatedAt)}</span>
      </div>
    </div>
  )
}
