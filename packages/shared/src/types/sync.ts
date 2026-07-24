import type { Note } from './note.js'
import type { Collection, Tag, Topic } from './collection.js'
import type { CustomNoteTypeRecord } from './customNoteType.js'

export type SyncMode = 'local-only' | 'synced' | 'offline'

// Server → Client WebSocket events
export type ServerEvent =
  | { type: 'note:created'; payload: Note }
  | { type: 'note:updated'; payload: Partial<Note> & { id: string } }
  | { type: 'note:deleted'; payload: { id: string } }
  | { type: 'collection:updated'; payload: Collection }
  | { type: 'tag:updated'; payload: Tag[] }
  | { type: 'topic:updated'; payload: Topic }
  | { type: 'ping' }

// Client → Server WebSocket events
export type ClientEvent =
  | { type: 'pong' }
  | { type: 'subscribe'; payload: { deviceId: string } }

// Delta sync response
export interface DeltaResponse {
  notes: Note[]
  collections: Collection[]
  topics: Topic[]
  tags: Tag[]
  customNoteTypes: CustomNoteTypeRecord[]
  cursor: string // ISO 8601 timestamp
}

// Sync push request
export interface SyncPushRequest {
  deviceId: string
  notes: Note[]
}
