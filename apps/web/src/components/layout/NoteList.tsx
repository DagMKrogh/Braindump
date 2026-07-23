import { useState, useMemo } from 'react'
import { Plus, FileText } from 'lucide-react'
import type { LocalNote, NoteType } from '@braindump/shared'
import { NoteListItem } from './NoteListItem'
import { TypePicker } from '../ui/TypePicker'
import s from '../../styles/layout.module.css'

interface Props {
  notes: LocalNote[]
  activeNoteId: string | null
  onSelectNote: (id: string) => void
  onCreateNote: (type: NoteType) => void
}

export function NoteList({ notes, activeNoteId, onSelectNote, onCreateNote }: Props) {
  const [query, setQuery] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  const filtered = useMemo(() => {
    if (!query.trim()) return notes
    const q = query.toLowerCase()
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
    )
  }, [notes, query])

  return (
    <div className={s.noteListPanel}>
      <div className={s.noteListHeader}>
        <div className={s.noteListActions}>
          <input
            className={s.searchInput}
            placeholder="Filter notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div style={{ position: 'relative' }}>
            <button
              className={`${s.btn} ${s.btnPrimary} ${s.btnIcon}`}
              onClick={() => setPickerOpen((v) => !v)}
              title="New note"
            >
              <Plus size={15} />
            </button>
            {pickerOpen && (
              <TypePicker
                onSelect={(type) => {
                  setPickerOpen(false)
                  onCreateNote(type)
                }}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>
        </div>
      </div>

      <div className={s.noteListItems}>
        {filtered.length === 0 ? (
          <div className={s.noteListEmpty}>
            <FileText size={32} strokeWidth={1} />
            <span>{query ? 'No notes match your search' : 'No notes yet'}</span>
            {!query && (
              <span className={s.editorEmptyHint}>Click + to create your first note</span>
            )}
          </div>
        ) : (
          filtered.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              isActive={note.id === activeNoteId}
              onClick={() => onSelectNote(note.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
