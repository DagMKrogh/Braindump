import { useEffect, useCallback } from 'react'
import type { NoteType } from '@braindump/shared'
import { useNotesStore } from '../stores/notesStore'
import { getAllNotes, upsertNote, softDeleteNote, getNoteById } from '../lib/localStore'
import { getType } from '../lib/noteTypeRegistry'
import { localBridge } from '../lib/localBridge'
import { todayDateRef, todayJotTitle } from '../noteTypes/dailyJot'

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

  const createNote = useCallback(async (type: NoteType, collectionId?: string | null): Promise<string> => {
    // Daily jot: one per day — reuse existing if found
    if (type === 'daily-jot') {
      const todayRef = todayDateRef()
      const existing = notes.find(
        (n) => n.type === 'daily-jot' && !n.deletedAt && n.dateRef === todayRef,
      )
      if (existing) {
        setActiveNoteId(existing.id)
        return existing.id
      }
    }

    const typeDef = getType(type)
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    const isDailyJot = type === 'daily-jot'
    let title = 'New Note'
    if (isDailyJot) title = todayJotTitle()
    else if (typeDef?.label) title = `New ${typeDef.label}`
    const note = {
      id,
      userId: 'local',
      type,
      title,
      content: typeDef ? typeDef.contentTemplate() : { type: 'doc', content: [{ type: 'paragraph' }] },
      metadata: typeDef ? { ...typeDef.defaultMetadata } : {},
      tags: [],
      collectionId: collectionId ?? null,
      topicId: null,
      linkedNoteIds: [],
      isPinned: false,
      isEncrypted: false,
      dateRef: isDailyJot ? todayDateRef() : null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending' as const,
      localOnly: true,
    }
    await upsertNote(note)
    storeUpsert(note)
    setActiveNoteId(id)
    localBridge.send('note:upsert', note)
    return id
  }, [notes, storeUpsert, setActiveNoteId])

  const saveNote = useCallback(async (id: string, changes: Partial<{ title: string; content: object; metadata: Record<string, unknown>; tags: string[]; linkedNoteIds: string[]; collectionId: string | null }>) => {
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
    localBridge.send('note:upsert', updated)
  }, [storeUpsert])

  const deleteNote = useCallback(async (id: string) => {
    await softDeleteNote(id)
    removeNote(id)
    localBridge.send('note:delete', { id })
    if (activeNoteId === id) setActiveNoteId(null)
  }, [removeNote, activeNoteId, setActiveNoteId])

  const mergeNotes = useCallback(async (ids: string[]): Promise<string | null> => {
    if (ids.length < 2) return null
    const sources = (await Promise.all(ids.map(getNoteById))).filter(Boolean) as NonNullable<Awaited<ReturnType<typeof getNoteById>>>[]
    if (sources.length < 2) return null

    // Sort by createdAt so oldest content comes first
    sources.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    // Merge Tiptap content: insert a heading separator between each note's body
    const mergedContent: object[] = []
    for (let i = 0; i < sources.length; i++) {
      const note = sources[i]!
      if (i > 0) {
        mergedContent.push({ type: 'horizontalRule' })
        mergedContent.push({
          type: 'heading', attrs: { level: 2 },
          content: [{ type: 'text', text: note.title || 'Untitled' }],
        })
      }
      const doc = note.content as { content?: object[] }
      if (doc.content) mergedContent.push(...doc.content)
    }

    // Union tags and linkedNoteIds (exclude the merged note IDs themselves)
    const idSet = new Set(ids)
    const tags = [...new Set(sources.flatMap((n) => n.tags))]
    const linkedNoteIds = [...new Set(sources.flatMap((n) => n.linkedNoteIds))].filter((lid) => !idSet.has(lid))

    const first = sources[0]!
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    const merged = {
      id,
      userId: first.userId || 'local',
      type: first.type,
      title: `${first.title || 'Untitled'} (merged)`,
      content: { type: 'doc', content: mergedContent },
      metadata: { ...first.metadata },
      tags,
      collectionId: first.collectionId,
      topicId: first.topicId,
      linkedNoteIds,
      isPinned: sources.some((n) => n.isPinned),
      isEncrypted: false,
      dateRef: first.dateRef,
      createdAt: first.createdAt,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending' as const,
      localOnly: true,
    }

    await upsertNote(merged)
    storeUpsert(merged)
    localBridge.send('note:upsert', merged)

    // Delete source notes
    for (const sid of ids) {
      await softDeleteNote(sid)
      removeNote(sid)
      localBridge.send('note:delete', { id: sid })
    }

    setActiveNoteId(id)
    return id
  }, [storeUpsert, removeNote, setActiveNoteId])

  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null

  return { notes, activeNote, activeNoteId, setActiveNoteId, createNote, saveNote, deleteNote, mergeNotes }
}
