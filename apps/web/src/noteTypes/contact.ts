import type { NoteTypeDefinition } from '@braindump/shared'

export const contactType: NoteTypeDefinition = {
  id: 'contact',
  label: 'Contact',
  icon: 'UserCircle',
  color: '#f472b6',
  system: true,
  metadataFields: [
    { key: 'email', label: 'Email', type: 'text', placeholder: 'name@example.com' },
    { key: 'phone', label: 'Phone', type: 'text', placeholder: '+1 555 000 0000' },
    { key: 'org', label: 'Organization', type: 'text' },
    { key: 'role', label: 'Role', type: 'text' },
    { key: 'lastContacted', label: 'Last Contacted', type: 'date' },
  ],
  defaultMetadata: {},
  searchableMetadataFields: ['email', 'org', 'role'],
  contentTemplate: () => ({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Notes' }] },
      { type: 'paragraph' },
    ],
  }),
}
