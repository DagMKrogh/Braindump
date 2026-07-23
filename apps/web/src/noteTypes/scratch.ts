import type { NoteTypeDefinition } from '@braindump/shared'

export const scratchType: NoteTypeDefinition = {
  id: 'scratch',
  label: 'Quick Note',
  icon: 'StickyNote',
  color: '#94a3b8',
  system: true,
  metadataFields: [],
  defaultMetadata: {},
  contentTemplate: () => ({
    type: 'doc',
    content: [{ type: 'paragraph' }],
  }),
}
