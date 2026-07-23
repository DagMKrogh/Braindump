import type { NoteTypeDefinition } from '@braindump/shared'

export const techDocType: NoteTypeDefinition = {
  id: 'tech-doc',
  label: 'Technical Doc',
  icon: 'BookOpen',
  color: '#8b5cf6',
  system: true,
  metadataFields: [
    { key: 'version', label: 'Version', type: 'text', placeholder: '1.0.0' },
    { key: 'relatedLinks', label: 'Related Links', type: 'textarea', placeholder: 'https://...' },
  ],
  defaultMetadata: {},
  contentTemplate: () => ({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Overview' }] },
      { type: 'paragraph' },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Details' }] },
      { type: 'paragraph' },
    ],
  }),
}
