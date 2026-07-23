import type { NoteTypeDefinition } from '@braindump/shared'

export const meetingType: NoteTypeDefinition = {
  id: 'meeting',
  label: 'Meeting',
  icon: 'Users',
  color: '#6366f1',
  system: true,
  isCalendarEvent: true,
  startTimeField: 'start',
  endTimeField: 'end',
  allDayDefault: false,
  metadataFields: [
    { key: 'start', label: 'Start', type: 'datetime', required: true },
    { key: 'end', label: 'End', type: 'datetime' },
    { key: 'attendees', label: 'Attendees', type: 'user-list' },
  ],
  defaultMetadata: { attendees: [] },
  searchableMetadataFields: ['attendees'],
  contentTemplate: () => ({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Agenda' }] },
      { type: 'paragraph' },
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Notes' }] },
      { type: 'paragraph' },
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Action Items' }] },
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] },
    ],
  }),
}
