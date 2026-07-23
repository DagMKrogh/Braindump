export type BuiltInNoteType =
  | 'daily-jot'
  | 'short-meeting'
  | 'meeting'
  | 'task'
  | 'code-segment'
  | 'tech-doc'
  | 'contact'
  | 'secret'
  | 'appointment'
  | 'ai-agent'
  | 'scratch'

export type BuiltInCalendarType =
  | 'meeting'
  | 'appointment'
  | 'scheduled-task'
  | 'deadline'
  | 'focus-block'
  | 'on-call-shift'
  | 'release-deploy'
  | 'review-retro'
  | 'reminder'

// Custom types use the prefix 'custom:' followed by a UUID
export type CustomNoteType = `custom:${string}`

export type NoteType = BuiltInNoteType | CustomNoteType

export type SyncStatus = 'synced' | 'pending' | 'conflict'

export interface Note {
  id: string
  userId: string
  type: NoteType
  title: string
  content: object // Tiptap ProseMirror JSON doc
  metadata: Record<string, unknown>
  tags: string[]
  collectionId: string | null
  topicId: string | null
  linkedNoteIds: string[]
  isPinned: boolean
  isEncrypted: boolean
  dateRef: string | null // ISO 8601 — canonical date for calendar markers
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

// Note as stored in the local store (adds client-only fields)
export interface LocalNote extends Note {
  syncStatus: SyncStatus
  localOnly: boolean // true = note has never been pushed to any server
}
