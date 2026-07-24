import type { NoteTypeDefinition } from '@braindump/shared'

export const shortMeetingType: NoteTypeDefinition = {
  id: 'short-meeting',
  label: 'Short Meeting',
  icon: 'MessageSquare',
  color: '#818cf8',
  system: true,
  metadataFields: [
    { key: 'start', label: 'Time', type: 'datetime' },
    { key: 'attendees', label: 'Attendees', type: 'text', placeholder: 'Alice, Bob…' },
  ],
  defaultMetadata: {},
  searchableMetadataFields: ['attendees'],
  contentTemplate: () => ({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Notes' }] },
      { type: 'paragraph' },
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Action Items' }] },
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] },
    ],
  }),
}
