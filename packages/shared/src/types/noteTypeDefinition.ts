export interface FieldDefinition {
  key: string
  label: string
  type:
    | 'text'
    | 'textarea'
    | 'date'
    | 'datetime'
    | 'number'
    | 'boolean'
    | 'select'
    | 'multi-select'
    | 'user-list'
  options?: string[] // for select / multi-select
  required?: boolean
  placeholder?: string
}

export interface NoteTypeDefinition {
  id: string
  label: string
  icon: string // icon name from Lucide icon set
  color: string // hex — used for calendar badges and type pills
  system: boolean // true = built-in, false = user-defined

  // Metadata panel
  metadataFields: FieldDefinition[]
  defaultMetadata: Record<string, unknown>

  // Content template: returns a default Tiptap JSON doc
  contentTemplate: () => object

  // Search
  searchableMetadataFields?: string[]

  // Calendar (optional — only set on calendar event types)
  isCalendarEvent?: boolean
  startTimeField?: string // metadata field key for start datetime
  endTimeField?: string // metadata field key for end datetime
  allDayDefault?: boolean
  calendarDateField?: string // for non-event types shown as markers
}
