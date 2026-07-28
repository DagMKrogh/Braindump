import { useEffect, useCallback, useMemo, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { FileText, Link2 } from 'lucide-react'
import { NoteList } from '../components/layout/NoteList'
import { NoteEditor } from '../components/editor/NoteEditor'
import { MetadataPanel } from '../components/editor/MetadataPanel'
import { TagInput } from '../components/editor/TagInput'
import { DiagramEditor } from '../components/editor/DiagramEditor'
import { LinkedTasksPanel } from '../components/tasks/LinkedTasksPanel'
import { useNotes } from '../hooks/useNotes'
import { NAVIGATE_NOTE_EVENT } from '../lib/extensions/NoteLink'
import { EDIT_DIAGRAM_EVENT, type DiagramData } from '../lib/extensions/DiagramBlock'
import type { LocalNote } from '@braindump/shared'
import s from '../styles/layout.module.css'

function BacklinksPanel({ notes, onNavigate }: Readonly<{ notes: LocalNote[]; onNavigate: (id: string) => void }>) {
  return (
    <div style={{
      flexShrink: 0,
      borderTop: '1px solid var(--color-border)',
      maxHeight: 160,
      overflowY: 'auto',
      padding: '0.5rem 1.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
        <Link2 size={12} style={{ color: 'var(--color-text-muted)' }} />
        <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
          Referenced by {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </span>
      </div>
      {notes.map((n) => (
        <button
          key={n.id}
          onClick={() => onNavigate(n.id)}
          style={{
            display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
            padding: '0.2rem 0', fontSize: '0.8rem', color: 'var(--color-accent)', cursor: 'pointer',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {n.title || 'Untitled'}
        </button>
      ))}
    </div>
  )
}

export function NotesPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const collectionFilter = searchParams.get('collection')
  const { notes, activeNote, activeNoteId, setActiveNoteId, createNote, saveNote, deleteNote, mergeNotes } = useNotes()
  const [editingDiagram, setEditingDiagram] = useState<DiagramData | null>(null)

  // Sync URL param → active note
  useEffect(() => {
    if (id && id !== activeNoteId) setActiveNoteId(id)
  }, [id, activeNoteId, setActiveNoteId])

  const handleSelectNote = useCallback((noteId: string) => {
    setActiveNoteId(noteId)
    navigate(`/notes/${noteId}`, { replace: true })
  }, [setActiveNoteId, navigate])

  // Listen for note-link click navigation from the Tiptap NoteLink extension
  useEffect(() => {
    const handler = (e: Event) => {
      const { noteId } = (e as CustomEvent<{ noteId: string }>).detail
      handleSelectNote(noteId)
    }
    window.addEventListener(NAVIGATE_NOTE_EVENT, handler)
    return () => window.removeEventListener(NAVIGATE_NOTE_EVENT, handler)
  }, [handleSelectNote])

  // Listen for diagram block clicks to open the diagram editor
  useEffect(() => {
    const handler = (e: Event) => {
      const data = (e as CustomEvent<DiagramData>).detail
      setEditingDiagram(data)
    }
    window.addEventListener(EDIT_DIAGRAM_EVENT, handler)
    return () => window.removeEventListener(EDIT_DIAGRAM_EVENT, handler)
  }, [])

  // Close diagram editor when switching notes
  useEffect(() => {
    setEditingDiagram(null)
  }, [activeNoteId])

  // Notes that link to the currently active note (backlinks)
  const backlinks = useMemo(() =>
    activeNote
      ? notes.filter((n) => !n.deletedAt && n.linkedNoteIds.includes(activeNote.id))
      : [],
  [notes, activeNote])

  // Filter by active collection (set via sidebar click → ?collection=<id>)
  const visibleNotes = useMemo(
    () => collectionFilter ? notes.filter((n) => n.collectionId === collectionFilter) : notes,
    [notes, collectionFilter],
  )

  const handleCreateNote = async (type: Parameters<typeof createNote>[0]) => {
    try {
      const newId = await createNote(type, collectionFilter ?? undefined)
      navigate(`/notes/${newId}`, { replace: true })
    } catch (err) {
      console.error('[handleCreateNote] failed:', err)
      alert(`Failed to create note: ${String(err)}`)
    }
  }

  const handleSave = (changes: Parameters<typeof saveNote>[1]) => {
    if (activeNoteId) saveNote(activeNoteId, changes)
  }

  const handleDelete = async () => {
    if (!activeNoteId) return
    await deleteNote(activeNoteId)
    navigate('/notes', { replace: true })
  }

  const handleMerge = async (ids: string[]) => {
    const newId = await mergeNotes(ids)
    if (newId) navigate(`/notes/${newId}`, { replace: true })
  }

  return (
    <>
      <NoteList
        notes={visibleNotes}
        activeNoteId={activeNoteId}
        onSelectNote={handleSelectNote}
        onCreateNote={handleCreateNote}
        onMergeNotes={handleMerge}
      />

      <div className={s.editorPanel}>
        {activeNote ? (
          <>
            <MetadataPanel note={activeNote} onSave={handleSave} />
            <TagInput
              tags={activeNote.tags}
              onChange={(tags) => handleSave({ tags })}
            />
            <NoteEditor
              key={activeNote.id}
              note={activeNote}
              onSave={handleSave}
              onDelete={handleDelete}
            />
            <LinkedTasksPanel noteId={activeNote.id} onNavigate={handleSelectNote} />
            {backlinks.length > 0 && (
              <BacklinksPanel notes={backlinks} onNavigate={handleSelectNote} />
            )}
            {editingDiagram && (
              <DiagramEditor
                key={editingDiagram.diagramId}
                diagram={editingDiagram}
                onClose={() => setEditingDiagram(null)}
              />
            )}
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
