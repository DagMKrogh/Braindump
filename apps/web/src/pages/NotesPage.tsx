import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { NoteList } from '../components/layout/NoteList'
import { NoteEditor } from '../components/editor/NoteEditor'
import { MetadataPanel } from '../components/editor/MetadataPanel'
import { useNotes } from '../hooks/useNotes'
import s from '../styles/layout.module.css'

export function NotesPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { notes, activeNote, activeNoteId, setActiveNoteId, createNote, saveNote, deleteNote } = useNotes()

  // Sync URL param → active note
  useEffect(() => {
    if (id && id !== activeNoteId) setActiveNoteId(id)
  }, [id, activeNoteId, setActiveNoteId])

  const handleSelectNote = (noteId: string) => {
    setActiveNoteId(noteId)
    navigate(`/notes/${noteId}`, { replace: true })
  }

  const handleCreateNote = async (type: Parameters<typeof createNote>[0]) => {
    const newId = await createNote(type)
    navigate(`/notes/${newId}`, { replace: true })
  }

  const handleSave = (changes: Parameters<typeof saveNote>[1]) => {
    if (activeNoteId) saveNote(activeNoteId, changes)
  }

  const handleDelete = async () => {
    if (!activeNoteId) return
    await deleteNote(activeNoteId)
    navigate('/notes', { replace: true })
  }

  return (
    <>
      <NoteList
        notes={notes}
        activeNoteId={activeNoteId}
        onSelectNote={handleSelectNote}
        onCreateNote={handleCreateNote}
      />

      <div className={s.editorPanel}>
        {activeNote ? (
          <>
            <MetadataPanel note={activeNote} onSave={handleSave} />
            <NoteEditor
              key={activeNote.id}
              note={activeNote}
              onSave={handleSave}
              onDelete={handleDelete}
            />
          </>
        ) : (
          <div className={s.editorEmpty}>
            <FileText size={48} strokeWidth={1} style={{ opacity: 0.3 }} />
            <span>Select a note or create a new one</span>
            <span className={s.editorEmptyHint}>Press N to create a quick note</span>
          </div>
        )}
      </div>
    </>
  )
}
