import { useState, useMemo, useCallback } from 'react'
import { Plus, FileText, Merge, X } from 'lucide-react'
import type { LocalNote, NoteType } from '@braindump/shared'
import { NoteListItem } from './NoteListItem'
import { TypePicker } from '../ui/TypePicker'
import s from '../../styles/layout.module.css'

interface Props {
  notes: LocalNote[]
  activeNoteId: string | null
  onSelectNote: (id: string) => void
  onCreateNote: (type: NoteType) => void
  onMergeNotes?: (ids: string[]) => void
}

export function NoteList({ notes, activeNoteId, onSelectNote, onCreateNote, onMergeNotes }: Props) {
  const [query, setQuery] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const selectMode = selected.size > 0

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelected(new Set()), [])

  function onSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      document.querySelector<HTMLElement>('[data-note-item]')?.focus()
    } else if (e.key === 'Escape') {
      if (selectMode) clearSelection()
      else setQuery('')
    }
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return notes
    const q = query.toLowerCase()
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
    )
  }, [notes, query])

  const [mergeConfirm, setMergeConfirm] = useState(false)

  const handleMerge = () => {
    if (selected.size < 2 || !onMergeNotes) return
    setMergeConfirm(true)
  }

  const confirmMerge = () => {
    if (!onMergeNotes) return
    onMergeNotes([...selected])
    clearSelection()
    setMergeConfirm(false)
  }

  return (
    <div className={s.noteListPanel}>
      <div className={s.noteListHeader}>
        {selectMode ? (
          <div className={s.noteListActions}>
            {mergeConfirm ? (
              <>
                <span className={s.selectionCount}>Delete {selected.size} notes and merge?</span>
                <button
                  className={`${s.btn} ${s.btnPrimary} ${s.btnSmall}`}
                  onClick={confirmMerge}
                >
                  Yes, merge
                </button>
                <button
                  className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`}
                  onClick={() => setMergeConfirm(false)}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span className={s.selectionCount}>{selected.size} selected</span>
                <button
                  className={`${s.btn} ${s.btnPrimary} ${s.btnSmall}`}
                  onClick={handleMerge}
                  disabled={selected.size < 2}
                  title="Merge selected notes"
                >
                  <Merge size={13} /> Merge
                </button>
                <button
                  className={`${s.btn} ${s.btnGhost} ${s.btnIcon}`}
                  onClick={clearSelection}
                  title="Cancel selection"
                >
                  <X size={14} />
                </button>
              </>
            )}
          </div>
        ) : (
          <div className={s.noteListActions}>
            <input
              data-note-search
              className={s.searchInput}
              placeholder="Filter notes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
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
        )}
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
              isSelected={selected.has(note.id)}
              selectMode={selectMode}
              onClick={() => selectMode ? toggleSelect(note.id) : onSelectNote(note.id)}
              onLongPress={() => toggleSelect(note.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
