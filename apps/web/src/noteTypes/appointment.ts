import type { NoteTypeDefinition } from '@braindump/shared'

export const appointmentType: NoteTypeDefinition = {
  id: 'appointment',
  label: 'Appointment',
  icon: 'CalendarCheck',
  color: '#34d399',
  system: true,
  isCalendarEvent: true,
  startTimeField: 'start',
  endTimeField: 'end',
  allDayDefault: false,
  metadataFields: [
    { key: 'start', label: 'Start', type: 'datetime', required: true },
    { key: 'end', label: 'End', type: 'datetime' },
    { key: 'location', label: 'Location', type: 'text' },
    { key: 'attendees', label: 'Attendees', type: 'text', placeholder: 'Alice, Bob…' },
  ],
  defaultMetadata: {},
  contentTemplate: () => ({
    type: 'doc',
    content: [{ type: 'paragraph' }],
  }),
}
