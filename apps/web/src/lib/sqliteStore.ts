/**
 * SQLite storage backend for the Tauri desktop app.
 * Uses @tauri-apps/plugin-sql (backed by tauri-plugin-sql in Rust).
 *
 * All functions mirror the localStore.ts API exactly so localStore.ts
 * can delegate here when running inside Tauri.
 */
import Database from '@tauri-apps/plugin-sql'
import type { LocalNote } from '@braindump/shared'
import type { Collection, Tag, Topic } from '@braindump/shared'
import type { CustomNoteTypeRecord } from '@braindump/shared'

// ── DB singleton ───────────────────────────────────────────────────────────

let _db: Database | null = null

async function getDb(): Promise<Database> {
  if (_db) return _db
  _db = await Database.load('sqlite:braindump.db')
  await migrate(_db)
  return _db
}

// ── Schema migrations ──────────────────────────────────────────────────────

async function migrate(db: Database): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '{}',
      metadata TEXT NOT NULL DEFAULT '{}',
      tags TEXT NOT NULL DEFAULT '[]',
      collectionId TEXT,
      topicId TEXT,
      linkedNoteIds TEXT NOT NULL DEFAULT '[]',
      isPinned INTEGER NOT NULL DEFAULT 0,
      isEncrypted INTEGER NOT NULL DEFAULT 0,
      dateRef TEXT,
      syncStatus TEXT NOT NULL DEFAULT 'pending',
      localOnly INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      topicId TEXT,
      parentId TEXT,
      name TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT,
      createdAt TEXT NOT NULL
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      name TEXT NOT NULL,
      noteCount INTEGER
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      noteId TEXT,
      fileName TEXT NOT NULL,
      mimeType TEXT NOT NULL,
      data TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS custom_note_types (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      label TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      metadataFields TEXT NOT NULL DEFAULT '[]',
      defaultMetadata TEXT NOT NULL DEFAULT '{}',
      contentTemplate TEXT NOT NULL DEFAULT '{}',
      calendarDateField TEXT,
      searchableMetadataFields TEXT NOT NULL DEFAULT '[]',
      isCalendarEvent INTEGER NOT NULL DEFAULT 0,
      startTimeField TEXT,
      endTimeField TEXT,
      allDayDefault INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `)
}

// ── Serialisation helpers ──────────────────────────────────────────────────

function noteFromRow(r: Record<string, unknown>): LocalNote {
  return {
    id: r['id'] as string,
    userId: r['userId'] as string,
    type: r['type'] as LocalNote['type'],
    title: r['title'] as string,
    content: JSON.parse(r['content'] as string) as object,
    metadata: JSON.parse(r['metadata'] as string) as Record<string, unknown>,
    tags: JSON.parse(r['tags'] as string) as string[],
    collectionId: (r['collectionId'] as string | null) ?? null,
    topicId: (r['topicId'] as string | null) ?? null,
    linkedNoteIds: JSON.parse(r['linkedNoteIds'] as string) as string[],
    isPinned: Boolean(r['isPinned']),
    isEncrypted: Boolean(r['isEncrypted']),
    dateRef: (r['dateRef'] as string | null) ?? null,
    syncStatus: r['syncStatus'] as 'synced' | 'pending' | 'conflict',
    localOnly: Boolean(r['localOnly']),
    createdAt: r['createdAt'] as string,
    updatedAt: r['updatedAt'] as string,
    deletedAt: (r['deletedAt'] as string | null) ?? null,
  }
}

// ── Notes ──────────────────────────────────────────────────────────────────

export async function getAllNotes(): Promise<LocalNote[]> {
  const db = await getDb()
  const rows = await db.select<Record<string, unknown>[]>(
    'SELECT * FROM notes WHERE deletedAt IS NULL ORDER BY updatedAt DESC'
  )
  return rows.map(noteFromRow)
}

export async function getNoteById(id: string): Promise<LocalNote | undefined> {
  const db = await getDb()
  const rows = await db.select<Record<string, unknown>[]>('SELECT * FROM notes WHERE id = $1', [id])
  return rows[0] ? noteFromRow(rows[0]) : undefined
}

export async function upsertNote(note: LocalNote): Promise<void> {
  const db = await getDb()
  await db.execute(`
    INSERT INTO notes (id, userId, type, title, content, metadata, tags, collectionId, topicId,
      linkedNoteIds, isPinned, isEncrypted, dateRef, syncStatus, localOnly, createdAt, updatedAt, deletedAt)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    ON CONFLICT(id) DO UPDATE SET
      userId=excluded.userId, type=excluded.type, title=excluded.title,
      content=excluded.content, metadata=excluded.metadata, tags=excluded.tags,
      collectionId=excluded.collectionId, topicId=excluded.topicId,
      linkedNoteIds=excluded.linkedNoteIds, isPinned=excluded.isPinned,
      isEncrypted=excluded.isEncrypted, dateRef=excluded.dateRef,
      syncStatus=excluded.syncStatus, localOnly=excluded.localOnly,
      updatedAt=excluded.updatedAt, deletedAt=excluded.deletedAt
  `, [
    note.id, note.userId, note.type, note.title,
    JSON.stringify(note.content), JSON.stringify(note.metadata),
    JSON.stringify(note.tags), note.collectionId, note.topicId,
    JSON.stringify(note.linkedNoteIds), note.isPinned ? 1 : 0,
    note.isEncrypted ? 1 : 0, note.dateRef,
    note.syncStatus, note.localOnly ? 1 : 0,
    note.createdAt, note.updatedAt, note.deletedAt,
  ])
}

export async function upsertNotes(notes: LocalNote[]): Promise<void> {
  for (const n of notes) await upsertNote(n)
}

export async function softDeleteNote(id: string): Promise<void> {
  const db = await getDb()
  await db.execute(
    "UPDATE notes SET deletedAt = $1, syncStatus = 'pending' WHERE id = $2",
    [new Date().toISOString(), id]
  )
}

export async function getPendingNotes(): Promise<LocalNote[]> {
  const db = await getDb()
  const rows = await db.select<Record<string, unknown>[]>(
    "SELECT * FROM notes WHERE syncStatus = 'pending'"
  )
  return rows.map(noteFromRow)
}

// ── Collections ────────────────────────────────────────────────────────────

export async function getAllCollections(): Promise<Collection[]> {
  const db = await getDb()
  return db.select<Collection[]>('SELECT * FROM collections')
}

export async function upsertCollections(collections: Collection[]): Promise<void> {
  for (const c of collections) await saveCollection(c)
}

export async function saveCollection(c: Collection): Promise<void> {
  const db = await getDb()
  await db.execute(`
    INSERT INTO collections (id, userId, topicId, parentId, name, createdAt)
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT(id) DO UPDATE SET userId=excluded.userId, topicId=excluded.topicId,
      parentId=excluded.parentId, name=excluded.name
  `, [c.id, c.userId, c.topicId, c.parentId, c.name, c.createdAt])
}

export async function deleteCollection(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM collections WHERE id = $1', [id])
}

// ── Topics ─────────────────────────────────────────────────────────────────

export async function getAllTopics(): Promise<Topic[]> {
  const db = await getDb()
  return db.select<Topic[]>('SELECT * FROM topics')
}

export async function upsertTopics(topics: Topic[]): Promise<void> {
  for (const t of topics) await saveTopic(t)
}

export async function saveTopic(t: Topic): Promise<void> {
  const db = await getDb()
  await db.execute(`
    INSERT INTO topics (id, userId, name, color, createdAt)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, color=excluded.color
  `, [t.id, t.userId, t.name, t.color ?? null, t.createdAt])
}

export async function deleteTopic(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM topics WHERE id = $1', [id])
}

// ── Tags ───────────────────────────────────────────────────────────────────

export async function getAllTags(): Promise<Tag[]> {
  const db = await getDb()
  return db.select<Tag[]>('SELECT * FROM tags')
}

export async function upsertTags(tags: Tag[]): Promise<void> {
  const db = await getDb()
  for (const t of tags) {
    await db.execute(`
      INSERT INTO tags (id, userId, name, noteCount) VALUES ($1,$2,$3,$4)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, noteCount=excluded.noteCount
    `, [t.id, t.userId, t.name, t.noteCount ?? null])
  }
}

// ── Custom note types ──────────────────────────────────────────────────────

function cntFromRow(r: Record<string, unknown>): CustomNoteTypeRecord {
  return {
    id: r['id'] as string,
    userId: r['userId'] as string,
    label: r['label'] as string,
    icon: r['icon'] as string,
    color: r['color'] as string,
    metadataFields: JSON.parse(r['metadataFields'] as string),
    defaultMetadata: JSON.parse(r['defaultMetadata'] as string),
    contentTemplate: JSON.parse(r['contentTemplate'] as string),
    calendarDateField: (r['calendarDateField'] as string | null) ?? null,
    searchableMetadataFields: JSON.parse(r['searchableMetadataFields'] as string),
    isCalendarEvent: Boolean(r['isCalendarEvent']),
    startTimeField: (r['startTimeField'] as string | null) ?? null,
    endTimeField: (r['endTimeField'] as string | null) ?? null,
    allDayDefault: Boolean(r['allDayDefault']),
    createdAt: r['createdAt'] as string,
    updatedAt: r['updatedAt'] as string,
  }
}

export async function getAllCustomNoteTypes(): Promise<CustomNoteTypeRecord[]> {
  const db = await getDb()
  const rows = await db.select<Record<string, unknown>[]>('SELECT * FROM custom_note_types')
  return rows.map(cntFromRow)
}

export async function upsertCustomNoteTypes(types: CustomNoteTypeRecord[]): Promise<void> {
  for (const t of types) await saveCustomNoteType(t)
}

export async function saveCustomNoteType(t: CustomNoteTypeRecord): Promise<void> {
  const db = await getDb()
  await db.execute(`
    INSERT INTO custom_note_types
      (id, userId, label, icon, color, metadataFields, defaultMetadata, contentTemplate,
       calendarDateField, searchableMetadataFields, isCalendarEvent, startTimeField, endTimeField,
       allDayDefault, createdAt, updatedAt)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    ON CONFLICT(id) DO UPDATE SET
      label=excluded.label, icon=excluded.icon, color=excluded.color,
      metadataFields=excluded.metadataFields, defaultMetadata=excluded.defaultMetadata,
      contentTemplate=excluded.contentTemplate, calendarDateField=excluded.calendarDateField,
      searchableMetadataFields=excluded.searchableMetadataFields,
      isCalendarEvent=excluded.isCalendarEvent, startTimeField=excluded.startTimeField,
      endTimeField=excluded.endTimeField, allDayDefault=excluded.allDayDefault,
      updatedAt=excluded.updatedAt
  `, [
    t.id, t.userId, t.label, t.icon, t.color,
    JSON.stringify(t.metadataFields), JSON.stringify(t.defaultMetadata),
    JSON.stringify(t.contentTemplate), t.calendarDateField,
    JSON.stringify(t.searchableMetadataFields), t.isCalendarEvent ? 1 : 0,
    t.startTimeField, t.endTimeField, t.allDayDefault ? 1 : 0,
    t.createdAt, t.updatedAt,
  ])
}

export async function deleteCustomNoteType(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM custom_note_types WHERE id = $1', [id])
}

// ── Assets ────────────────────────────────────────────────────────────────

export async function saveAsset(asset: { id: string; noteId: string | null; fileName: string; mimeType: string; data: string; createdAt: string }): Promise<void> {
  const db = await getDb()
  await db.execute(`
    INSERT INTO assets (id, noteId, fileName, mimeType, data, createdAt)
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT(id) DO UPDATE SET noteId=excluded.noteId, fileName=excluded.fileName,
      mimeType=excluded.mimeType, data=excluded.data
  `, [asset.id, asset.noteId, asset.fileName, asset.mimeType, asset.data, asset.createdAt])
}

export async function getAssetById(id: string): Promise<{ id: string; noteId: string | null; fileName: string; mimeType: string; data: string; createdAt: string } | undefined> {
  const db = await getDb()
  const rows = await db.select<Record<string, unknown>[]>('SELECT * FROM assets WHERE id = $1', [id])
  if (!rows[0]) return undefined
  const r = rows[0]
  return {
    id: r['id'] as string,
    noteId: (r['noteId'] as string | null) ?? null,
    fileName: r['fileName'] as string,
    mimeType: r['mimeType'] as string,
    data: r['data'] as string,
    createdAt: r['createdAt'] as string,
  }
}

export async function getAssetsByNoteId(noteId: string): Promise<{ id: string; noteId: string | null; fileName: string; mimeType: string; data: string; createdAt: string }[]> {
  const db = await getDb()
  const rows = await db.select<Record<string, unknown>[]>('SELECT * FROM assets WHERE noteId = $1', [noteId])
  return rows.map((r) => ({
    id: r['id'] as string,
    noteId: (r['noteId'] as string | null) ?? null,
    fileName: r['fileName'] as string,
    mimeType: r['mimeType'] as string,
    data: r['data'] as string,
    createdAt: r['createdAt'] as string,
  }))
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM assets WHERE id = $1', [id])
}
