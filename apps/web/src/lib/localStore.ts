/**
 * Local store abstraction over IndexedDB (via Dexie).
 * On desktop (Tauri) this is replaced by the SQLite backend.
 * All app code reads/writes through this module — never directly to IndexedDB.
 */
import Dexie, { type Table } from 'dexie'
import type { LocalNote } from '@braindump/shared'
import type { Collection, Tag, Topic } from '@braindump/shared'
import type { CustomNoteTypeRecord } from '@braindump/shared'

class BraindumpDB extends Dexie {
  notes!: Table<LocalNote>
  collections!: Table<Collection>
  topics!: Table<Topic>
  tags!: Table<Tag>
  customNoteTypes!: Table<CustomNoteTypeRecord>

  constructor() {
    super('braindump')
    this.version(1).stores({
      notes: 'id, type, collectionId, topicId, dateRef, updatedAt, syncStatus, deletedAt',
      collections: 'id, userId, parentId, topicId',
      topics: 'id, userId',
      tags: 'id, userId, name',
      customNoteTypes: 'id, userId',
    })
  }
}

export const db = new BraindumpDB()

// Notes
export async function getAllNotes(): Promise<LocalNote[]> {
  return db.notes.where('deletedAt').equals('').or('deletedAt').equals(null as unknown as string).toArray()
}

export async function getNoteById(id: string): Promise<LocalNote | undefined> {
  return db.notes.get(id)
}

export async function upsertNote(note: LocalNote): Promise<void> {
  await db.notes.put(note)
}

export async function upsertNotes(notes: LocalNote[]): Promise<void> {
  await db.notes.bulkPut(notes)
}

export async function softDeleteNote(id: string): Promise<void> {
  await db.notes.update(id, { deletedAt: new Date().toISOString(), syncStatus: 'pending' })
}

export async function getPendingNotes(): Promise<LocalNote[]> {
  return db.notes.where('syncStatus').equals('pending').toArray()
}

// Collections / Topics / Tags
export async function upsertCollections(collections: Collection[]): Promise<void> {
  await db.collections.bulkPut(collections)
}

export async function upsertTopics(topics: Topic[]): Promise<void> {
  await db.topics.bulkPut(topics)
}

export async function upsertTags(tags: Tag[]): Promise<void> {
  await db.tags.bulkPut(tags)
}

export async function getAllCollections(): Promise<Collection[]> {
  return db.collections.toArray()
}

export async function getAllTopics(): Promise<Topic[]> {
  return db.topics.toArray()
}

export async function getAllTags(): Promise<Tag[]> {
  return db.tags.toArray()
}

// Custom note types
export async function upsertCustomNoteTypes(types: CustomNoteTypeRecord[]): Promise<void> {
  await db.customNoteTypes.bulkPut(types)
}

export async function getAllCustomNoteTypes(): Promise<CustomNoteTypeRecord[]> {
  return db.customNoteTypes.toArray()
}
