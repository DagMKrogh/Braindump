import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LocalNote, NoteType } from '@braindump/shared'
import { useUIStore } from '../stores/uiStore'
import { useNotesStore } from '../stores/notesStore'
import { upsertNote as localUpsert } from '../lib/localStore'
import { getType } from '../lib/noteTypeRegistry'

function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable
}

async function createQuickNote(
  type: NoteType,
  storeUpsert: (note: LocalNote) => void,
  setActiveNoteId: (id: string) => void,
): Promise<string> {
  const typeDef = getType(type)
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  const note = {
    id, userId: 'local', type,
    title: typeDef ? `New ${typeDef.label}` : 'New Note',
    content: typeDef ? typeDef.contentTemplate() : { type: 'doc', content: [{ type: 'paragraph' }] },
    metadata: typeDef ? { ...typeDef.defaultMetadata } : {},
    tags: [], collectionId: null, topicId: null,
    linkedNoteIds: [], isPinned: false, isEncrypted: false, dateRef: null,
    createdAt: now, updatedAt: now, deletedAt: null,
    syncStatus: 'pending' as const, localOnly: true,
  }
  await localUpsert(note)
  storeUpsert(note)
  setActiveNoteId(id)
  return id
}

export function useGlobalShortcuts() {
  const navigate = useNavigate()
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore()
  const { upsertNote: storeUpsert, setActiveNoteId } = useNotesStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K → open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
        return
      }
      // Escape → close command palette
      if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false)
        return
      }
      // N → new scratch note (only when no input is focused, no modifiers)
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && !isInputFocused()) {
        e.preventDefault()
        createQuickNote('scratch', storeUpsert, setActiveNoteId)
          .then(id => navigate(`/notes/${id}`))
          .catch(console.error)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [commandPaletteOpen, navigate, setCommandPaletteOpen, storeUpsert, setActiveNoteId])
}

export { createQuickNote }
