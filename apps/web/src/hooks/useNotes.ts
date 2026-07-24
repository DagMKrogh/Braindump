import { useEffect, useCallback } from 'react'
import type { NoteType } from '@braindump/shared'
import { useNotesStore } from '../stores/notesStore'
import { getAllNotes, upsertNote, softDeleteNote, getNoteById } from '../lib/localStore'
import { getType } from '../lib/noteTypeRegistry'

export function useNotes() {
  const { notes, activeNoteId, setNotes, upsertNote: storeUpsert, removeNote, setActiveNoteId, setLoading } = useNotesStore()

  // Load all notes from IndexedDB on mount
  useEffect(() => {
    setLoading(true)
    getAllNotes().then((loaded) => {
      setNotes(loaded)
      setLoading(false)
    })
  }, [setNotes, setLoading])

  const createNote = useCallback(async (type: NoteType): Promise<string> => {
    const typeDef = getType(type)
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    const note = {
      id,
      userId: 'local',
      type,
      title: typeDef ? `New ${typeDef.label}` : 'New Note',
      content: typeDef ? typeDef.contentTemplate() : { type: 'doc', content: [{ type: 'paragraph' }] },
      metadata: typeDef ? { ...typeDef.defaultMetadata } : {},
      tags: [],
      collectionId: null,
      topicId: null,
      linkedNoteIds: [],
      isPinned: false,
      isEncrypted: false,
      dateRef: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending' as const,
      localOnly: true,
    }
    await upsertNote(note)
    storeUpsert(note)
    setActiveNoteId(id)
    return id
  }, [storeUpsert, setActiveNoteId])

  const saveNote = useCallback(async (id: string, changes: Partial<{ title: string; content: object; metadata: Record<string, unknown>; tags: string[]; linkedNoteIds: string[] }>) => {
    const existing = await getNoteById(id)
    if (!existing) return
    const updated = {
      ...existing,
      ...changes,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending' as const,
    }
    await upsertNote(updated)
    storeUpsert(updated)
  }, [storeUpsert])

  const deleteNote = useCallback(async (id: string) => {
    await softDeleteNote(id)
    removeNote(id)
    if (activeNoteId === id) setActiveNoteId(null)
  }, [removeNote, activeNoteId, setActiveNoteId])

  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null

  return { notes, activeNote, activeNoteId, setActiveNoteId, createNote, saveNote, deleteNote }
}
