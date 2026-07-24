import type { NoteTypeDefinition } from '@braindump/shared'

export const secretType: NoteTypeDefinition = {
  id: 'secret',
  label: 'Secret',
  icon: 'Lock',
  color: '#ef4444',
  system: true,
  metadataFields: [
    { key: 'category', label: 'Category', type: 'select', options: ['password', 'api-key', 'token', 'certificate', 'other'] },
    { key: 'expiry', label: 'Expires', type: 'date' },
  ],
  defaultMetadata: { category: 'password' },
  searchableMetadataFields: ['category'],
  contentTemplate: () => ({
    type: 'doc',
    content: [{ type: 'paragraph' }],
  }),
}
