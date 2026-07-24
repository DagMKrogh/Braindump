/**
 * Local store abstraction — IndexedDB (Dexie) on web, SQLite (tauri-plugin-sql) on desktop.
 * All app code reads/writes through this module. Backend is selected at runtime via isTauri().
 */
import Dexie, { type Table } from 'dexie'
import type { LocalNote } from '@braindump/shared'
import type { Collection, Tag, Topic } from '@braindump/shared'
import type { CustomNoteTypeRecord } from '@braindump/shared'
import { isTauri } from './isTauri'
import * as sqlite from './sqliteStore'

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

// ── Notes ──────────────────────────────────────────────────────────────────

export async function getAllNotes(): Promise<LocalNote[]> {
  if (isTauri()) return sqlite.getAllNotes()
  const all = await db.notes.toArray()
  return all.filter((n) => !n.deletedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getNoteById(id: string): Promise<LocalNote | undefined> {
  if (isTauri()) return sqlite.getNoteById(id)
  return db.notes.get(id)
}

export async function upsertNote(note: LocalNote): Promise<void> {
  if (isTauri()) return sqlite.upsertNote(note)
  await db.notes.put(note)
}

export async function upsertNotes(notes: LocalNote[]): Promise<void> {
  if (isTauri()) return sqlite.upsertNotes(notes)
  await db.notes.bulkPut(notes)
}

export async function softDeleteNote(id: string): Promise<void> {
  if (isTauri()) return sqlite.softDeleteNote(id)
  await db.notes.update(id, { deletedAt: new Date().toISOString(), syncStatus: 'pending' })
}

export async function getPendingNotes(): Promise<LocalNote[]> {
  if (isTauri()) return sqlite.getPendingNotes()
  return db.notes.where('syncStatus').equals('pending').toArray()
}

// ── Collections ────────────────────────────────────────────────────────────

export async function upsertCollections(collections: Collection[]): Promise<void> {
  if (isTauri()) return sqlite.upsertCollections(collections)
  await db.collections.bulkPut(collections)
}

export async function getAllCollections(): Promise<Collection[]> {
  if (isTauri()) return sqlite.getAllCollections()
  return db.collections.toArray()
}

export async function saveCollection(collection: Collection): Promise<void> {
  if (isTauri()) return sqlite.saveCollection(collection)
  await db.collections.put(collection)
}

export async function deleteCollection(id: string): Promise<void> {
  if (isTauri()) return sqlite.deleteCollection(id)
  await db.collections.delete(id)
}

// ── Topics ─────────────────────────────────────────────────────────────────

export async function upsertTopics(topics: Topic[]): Promise<void> {
  if (isTauri()) return sqlite.upsertTopics(topics)
  await db.topics.bulkPut(topics)
}

export async function getAllTopics(): Promise<Topic[]> {
  if (isTauri()) return sqlite.getAllTopics()
  return db.topics.toArray()
}

export async function saveTopic(topic: Topic): Promise<void> {
  if (isTauri()) return sqlite.saveTopic(topic)
  await db.topics.put(topic)
}

export async function deleteTopic(id: string): Promise<void> {
  if (isTauri()) return sqlite.deleteTopic(id)
  await db.topics.delete(id)
}

// ── Tags ───────────────────────────────────────────────────────────────────

export async function upsertTags(tags: Tag[]): Promise<void> {
  if (isTauri()) return sqlite.upsertTags(tags)
  await db.tags.bulkPut(tags)
}

export async function getAllTags(): Promise<Tag[]> {
  if (isTauri()) return sqlite.getAllTags()
  return db.tags.toArray()
}

// ── Custom note types ──────────────────────────────────────────────────────

export async function upsertCustomNoteTypes(types: CustomNoteTypeRecord[]): Promise<void> {
  if (isTauri()) return sqlite.upsertCustomNoteTypes(types)
  await db.customNoteTypes.bulkPut(types)
}

export async function getAllCustomNoteTypes(): Promise<CustomNoteTypeRecord[]> {
  if (isTauri()) return sqlite.getAllCustomNoteTypes()
  return db.customNoteTypes.toArray()
}

export async function saveCustomNoteType(record: CustomNoteTypeRecord): Promise<void> {
  if (isTauri()) return sqlite.saveCustomNoteType(record)
  await db.customNoteTypes.put(record)
}

export async function deleteCustomNoteType(id: string): Promise<void> {
  if (isTauri()) return sqlite.deleteCustomNoteType(id)
  await db.customNoteTypes.delete(id)
}
