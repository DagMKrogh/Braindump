import type { NoteTypeDefinition } from '@braindump/shared'

export const dailyJotType: NoteTypeDefinition = {
  id: 'daily-jot',
  label: 'Daily Jot',
  icon: 'Sun',
  color: '#f59e0b',
  system: true,
  metadataFields: [
    {
      key: 'energy',
      label: 'Energy',
      type: 'select',
      options: ['low', 'medium', 'high'],
    },
  ],
  defaultMetadata: { energy: 'medium' },
  calendarDateField: 'createdAt',
  contentTemplate: () => ({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: "Today's Notes" }] },
      { type: 'paragraph' },
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Tasks' }] },
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] },
    ],
  }),
}
