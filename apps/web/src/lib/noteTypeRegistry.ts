import type { NoteTypeDefinition } from '@braindump/shared'
import type { CustomNoteTypeRecord } from '@braindump/shared'
import { builtInTypes } from '../noteTypes'

let registry: Map<string, NoteTypeDefinition> = new Map(builtInTypes.map((t) => [t.id, t]))

export function initRegistry(customTypes: CustomNoteTypeRecord[]) {
  const custom: NoteTypeDefinition[] = customTypes.map((c) => ({
    id: `custom:${c.id}`,
    label: c.label,
    icon: c.icon,
    color: c.color,
    system: false,
    metadataFields: c.metadataFields,
    defaultMetadata: c.defaultMetadata,
    contentTemplate: () => c.contentTemplate,
    searchableMetadataFields: c.searchableMetadataFields,
    isCalendarEvent: c.isCalendarEvent,
    startTimeField: c.startTimeField ?? undefined,
    endTimeField: c.endTimeField ?? undefined,
    allDayDefault: c.allDayDefault,
    calendarDateField: c.calendarDateField ?? undefined,
  }))

  registry = new Map([...builtInTypes, ...custom].map((t) => [t.id, t]))
}

export function getType(id: string): NoteTypeDefinition | undefined {
  return registry.get(id)
}

export function getAllTypes(): NoteTypeDefinition[] {
  return Array.from(registry.values())
}

export function getCalendarTypes(): NoteTypeDefinition[] {
  return getAllTypes().filter((t) => t.isCalendarEvent)
}
