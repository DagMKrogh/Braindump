import type { NoteTypeDefinition } from '@braindump/shared'

function todayHeading(): string {
  const now = new Date()
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' })
  const full = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  return `${weekday}, ${full}`
}

export function todayDateRef(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function todayJotTitle(): string {
  return todayHeading()
}

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
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: todayHeading() }] },
      { type: 'paragraph' },
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Tasks' }] },
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] },
    ],
  }),
}
