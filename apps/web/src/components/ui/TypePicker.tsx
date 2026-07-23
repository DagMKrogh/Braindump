import { useEffect, useRef } from 'react'
import type { NoteType } from '@braindump/shared'
import { getAllTypes } from '../../lib/noteTypeRegistry'
import s from '../../styles/layout.module.css'

interface Props {
  onSelect: (type: NoteType) => void
  onClose: () => void
}

export function TypePicker({ onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const types = getAllTypes().filter((t) => !t.isCalendarEvent)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={ref}
      className={s.typePicker}
      style={{ top: 'calc(100% + 4px)', right: 0 }}
    >
      {types.map((t) => (
        <button
          key={t.id}
          className={s.typePickerItem}
          onClick={() => onSelect(t.id as NoteType)}
        >
          <span className={s.typePickerDot} style={{ background: t.color }} />
          {t.label}
        </button>
      ))}
    </div>
  )
}
