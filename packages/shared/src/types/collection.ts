export interface Topic {
  id: string
  userId: string
  name: string
  color?: string
  createdAt: string
}

export interface Collection {
  id: string
  userId: string
  topicId: string | null
  parentId: string | null
  name: string
  createdAt: string
}

export interface Tag {
  id: string
  userId: string
  name: string // hierarchical: 'dev/backend'
  noteCount?: number
}
