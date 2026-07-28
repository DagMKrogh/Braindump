import { useRef, useCallback } from 'react'
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

const LONG_PRESS_MS = 500

interface Props {
  note: LocalNote
  isActive: boolean
  isSelected?: boolean
  selectMode?: boolean
  onClick: () => void
  onLongPress?: () => void
}

export function NoteListItem({ note, isActive, isSelected, selectMode, onClick, onLongPress }: Props) {
  const typeDef = getType(note.type)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  const onPointerDown = useCallback(() => {
    if (!onLongPress) return
    didLongPress.current = false
    pressTimer.current = setTimeout(() => {
      didLongPress.current = true
      onLongPress()
    }, LONG_PRESS_MS)
  }, [onLongPress])

  const onPointerUp = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }, [])

  const handleClick = useCallback(() => {
    if (didLongPress.current) { didLongPress.current = false; return }
    onClick()
  }, [onClick])

  return (
    <div
      className={`${s.noteItem} ${isActive && !selectMode ? s.noteItemActive : ''} ${isSelected ? s.noteItemSelected : ''}`}
      onClick={handleClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      role="button"
      tabIndex={0}
      data-note-item
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); return }
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
        e.preventDefault()
        const all = Array.from(document.querySelectorAll<HTMLElement>('[data-note-item]'))
        const idx = all.indexOf(e.currentTarget as HTMLElement)
        if (e.key === 'ArrowDown') all[idx + 1]?.focus()
        else if (idx === 0) document.querySelector<HTMLElement>('[data-note-search]')?.focus()
        else all[idx - 1]?.focus()
      }}
    >
      <div className={s.noteItemHeader}>
        {selectMode && (
          <span className={s.noteCheckbox}>
            <input
              type="checkbox"
              checked={isSelected ?? false}
              onChange={() => onClick()}
              onClick={(e) => e.stopPropagation()}
              tabIndex={-1}
            />
          </span>
        )}
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
