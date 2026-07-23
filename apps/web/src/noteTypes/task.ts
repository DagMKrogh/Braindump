import type { NoteTypeDefinition } from '@braindump/shared'

export const taskType: NoteTypeDefinition = {
  id: 'task',
  label: 'Task',
  icon: 'CheckSquare',
  color: '#22c55e',
  system: true,
  metadataFields: [
    { key: 'status', label: 'Status', type: 'select', options: ['open', 'in-progress', 'done', 'cancelled'], required: true },
    { key: 'priority', label: 'Priority', type: 'select', options: ['low', 'medium', 'high'] },
    { key: 'dueDate', label: 'Due Date', type: 'date' },
  ],
  defaultMetadata: { status: 'open', priority: 'medium' },
  calendarDateField: 'dueDate',
  searchableMetadataFields: ['priority', 'status'],
  contentTemplate: () => ({
    type: 'doc',
    content: [{ type: 'paragraph' }],
  }),
}
