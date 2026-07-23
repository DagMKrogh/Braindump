import type { NoteTypeDefinition } from '@braindump/shared'

export const codeSegmentType: NoteTypeDefinition = {
  id: 'code-segment',
  label: 'Code Segment',
  icon: 'Code2',
  color: '#0ea5e9',
  system: true,
  metadataFields: [
    { key: 'language', label: 'Language', type: 'text', required: true, placeholder: 'typescript' },
    { key: 'source', label: 'Source / Reference', type: 'text', placeholder: 'https://...' },
  ],
  defaultMetadata: { language: 'typescript' },
  searchableMetadataFields: ['language', 'source'],
  contentTemplate: () => ({
    type: 'doc',
    content: [
      { type: 'paragraph' },
      { type: 'codeBlock', attrs: { language: 'typescript' }, content: [{ type: 'text', text: '' }] },
    ],
  }),
}
