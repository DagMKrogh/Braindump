import {
  pgTable, uuid, text, jsonb, boolean, timestamp, index
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id:           uuid('id').primaryKey().defaultRandom(),
  email:        text('email').notNull().unique(),
  name:         text('name').notNull(),
  avatarUrl:    text('avatar_url'),
  googleId:     text('google_id').unique(),
  passwordHash: text('password_hash'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
})

export const notes = pgTable('notes', {
  id:             uuid('id').primaryKey(),
  userId:         uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type:           text('type').notNull(),
  title:          text('title').notNull().default(''),
  content:        jsonb('content').notNull().default({}),
  metadata:       jsonb('metadata').notNull().default({}),
  tags:           jsonb('tags').notNull().default([]),       // text[]
  collectionId:   uuid('collection_id'),
  topicId:        uuid('topic_id'),
  linkedNoteIds:  jsonb('linked_note_ids').notNull().default([]), // uuid[]
  isPinned:       boolean('is_pinned').notNull().default(false),
  isEncrypted:    boolean('is_encrypted').notNull().default(false),
  dateRef:        text('date_ref'),                          // ISO date string
  createdAt:      timestamp('created_at').notNull(),
  updatedAt:      timestamp('updated_at').notNull(),
  deletedAt:      timestamp('deleted_at'),
}, (t) => ({
  userIdIdx: index('notes_user_id_idx').on(t.userId),
  updatedAtIdx: index('notes_updated_at_idx').on(t.updatedAt),
  typeIdx: index('notes_type_idx').on(t.type),
}))

export const collections = pgTable('collections', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name:       text('name').notNull(),
  color:      text('color'),
  icon:       text('icon'),
  parentId:   uuid('parent_id'),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
  updatedAt:  timestamp('updated_at').notNull().defaultNow(),
})

export const topics = pgTable('topics', {
  id:           uuid('id').primaryKey().defaultRandom(),
  userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name:         text('name').notNull(),
  collectionId: uuid('collection_id').references(() => collections.id, { onDelete: 'set null' }),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
})

export const refreshTokens = pgTable('refresh_tokens', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash:  text('token_hash').notNull().unique(),
  expiresAt:  timestamp('expires_at').notNull(),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
  revokedAt:  timestamp('revoked_at'),
}, (t) => ({
  userIdIdx: index('refresh_tokens_user_id_idx').on(t.userId),
}))

export const shareLinks = pgTable('share_links', {
  id:           uuid('id').primaryKey().defaultRandom(),
  noteId:       uuid('note_id').notNull().references(() => notes.id, { onDelete: 'cascade' }),
  userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  slug:         text('slug').notNull().unique(),
  passwordHash: text('password_hash'),
  expiresAt:    timestamp('expires_at'),
  isActive:     boolean('is_active').notNull().default(true),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  slugIdx: index('share_links_slug_idx').on(t.slug),
  noteIdIdx: index('share_links_note_id_idx').on(t.noteId),
}))

export const customNoteTypes = pgTable('custom_note_types', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  definition: jsonb('definition').notNull(),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
  updatedAt:  timestamp('updated_at').notNull().defaultNow(),
  deletedAt:  timestamp('deleted_at'),
}, (t) => ({
  userIdIdx: index('custom_note_types_user_id_idx').on(t.userId),
}))
