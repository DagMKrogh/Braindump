import type { FieldDefinition } from './noteTypeDefinition.js'

export interface CustomNoteTypeRecord {
  id: string // UUID; used as 'custom:<id>' in note.type
  userId: string
  label: string
  icon: string
  color: string
  metadataFields: FieldDefinition[]
  defaultMetadata: Record<string, unknown>
  contentTemplate: object // Tiptap JSON doc
  calendarDateField: string | null
  searchableMetadataFields: string[]
  isCalendarEvent: boolean
  startTimeField: string | null
  endTimeField: string | null
  allDayDefault: boolean
  createdAt: string
  updatedAt: string
}
