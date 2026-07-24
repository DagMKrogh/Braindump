import type { NoteTypeDefinition } from '@braindump/shared'

export const aiAgentType: NoteTypeDefinition = {
  id: 'ai-agent',
  label: 'AI Agent Note',
  icon: 'Bot',
  color: '#a78bfa',
  system: true,
  metadataFields: [
    { key: 'model', label: 'Model', type: 'text', placeholder: 'claude-sonnet-4-6' },
    { key: 'qualityRating', label: 'Quality', type: 'select', options: ['1', '2', '3', '4', '5'] },
  ],
  defaultMetadata: {},
  searchableMetadataFields: ['model'],
  contentTemplate: () => ({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Prompt' }] },
      { type: 'paragraph' },
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Output' }] },
      { type: 'paragraph' },
    ],
  }),
}
