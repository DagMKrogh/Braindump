import { create } from 'zustand'
import type { Collection, Tag, Topic } from '@braindump/shared'

interface CollectionsState {
  collections: Collection[]
  topics: Topic[]
  tags: Tag[]
  setCollections: (collections: Collection[]) => void
  setTopics: (topics: Topic[]) => void
  setTags: (tags: Tag[]) => void
}

export const useCollectionsStore = create<CollectionsState>((set) => ({
  collections: [],
  topics: [],
  tags: [],
  setCollections: (collections) => set({ collections }),
  setTopics: (topics) => set({ topics }),
  setTags: (tags) => set({ tags }),
}))
