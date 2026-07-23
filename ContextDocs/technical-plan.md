# Braindump — Technical Plan

> Companion to `plan.md`. Covers implementation architecture, structure, schema, and API design.

---

## 1. Monorepo Structure

A pnpm workspace monorepo keeps all packages in one repo with shared TypeScript types and tooling.

```
braindump/
├── apps/
│   ├── web/              # React PWA (Vite)
│   ├── desktop/          # Tauri app (wraps web app)
│   └── sync-service/     # Node.js + Fastify backend
├── packages/
│   └── shared/           # Shared TypeScript types, constants, utils
├── docker/
│   └── sync-service/     # Dockerfile + docker-compose for Zima deployment
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.base.json
```

### Package responsibilities

| Package | Contents |
|---|---|
| `apps/web` | React app, Tiptap editor, Zustand stores, routing, PWA manifest |
| `apps/desktop` | Tauri config, Rust src (minimal), points at web app as frontend |
| `apps/sync-service` | Fastify server, auth, WebSocket hub, REST API, DB access |
| `packages/shared` | `NoteType`, `NoteSchema`, API request/response types, sync event types |

### Shared types approach

The `packages/shared` package is imported by both `web` and `sync-service`. This ensures API contracts are never out of sync. Example:

```ts
// packages/shared/src/types/note.ts
export type NoteType =
  | 'daily-jot' | 'short-meeting' | 'meeting' | 'task'
  | 'code-segment' | 'tech-doc' | 'contact' | 'secret'
  | 'appointment' | 'ai-agent' | 'scratch'

export interface Note {
  id: string           // UUID
  userId: string
  type: NoteType
  title: string
  content: object      // Tiptap JSON (ProseMirror doc)
  metadata: NoteMetadata
  tags: string[]
  collectionId: string | null
  topicId: string | null
  linkedNoteIds: string[]
  createdAt: string    // ISO 8601
  updatedAt: string
  deletedAt: string | null
}
```

---

## 2. Database Schema (PostgreSQL)

### Tables

```sql
-- Users
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id   TEXT UNIQUE NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Topics (high-level groupings)
CREATE TABLE topics (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Collections (nested notebooks)
CREATE TABLE collections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  topic_id    UUID REFERENCES topics(id) ON DELETE SET NULL,
  parent_id   UUID REFERENCES collections(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Tags
CREATE TABLE tags (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name    TEXT NOT NULL,  -- stored as 'dev/backend' for hierarchy
  UNIQUE(user_id, name)
);

-- Notes
CREATE TABLE notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  topic_id      UUID REFERENCES topics(id) ON DELETE SET NULL,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL DEFAULT '',
  content       JSONB NOT NULL DEFAULT '{}',    -- Tiptap JSON doc
  metadata      JSONB NOT NULL DEFAULT '{}',    -- type-specific fields
  is_encrypted  BOOLEAN DEFAULT false,          -- for secrets
  pinned_at     TIMESTAMPTZ,
  date_ref      TIMESTAMPTZ,                    -- canonical date for calendar (due date, meeting date, etc.)
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  deleted_at    TIMESTAMPTZ                     -- soft delete
);

-- Note <-> Tag join
CREATE TABLE note_tags (
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  tag_id  UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

-- Bi-directional links
CREATE TABLE note_links (
  source_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  target_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  PRIMARY KEY (source_id, target_id)
);

-- Sync: track client sync state
CREATE TABLE sync_cursors (
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id  TEXT NOT NULL,
  cursor_at  TIMESTAMPTZ NOT NULL DEFAULT now(),  -- last synced timestamp
  PRIMARY KEY (user_id, device_id)
);

-- Full-text search index
CREATE INDEX notes_fts ON notes USING GIN (
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content::text, ''))
);
CREATE INDEX notes_date_ref ON notes(user_id, date_ref) WHERE deleted_at IS NULL;
CREATE INDEX notes_type ON notes(user_id, type) WHERE deleted_at IS NULL;
```

### Metadata shapes per note type

The `metadata` JSONB column holds type-specific fields:

```ts
// packages/shared/src/types/metadata.ts

interface MeetingMeta   { attendees: string[]; agenda?: string; actionItems?: string[] }
interface TaskMeta      { dueDate?: string; priority?: 'low'|'medium'|'high'; status: 'open'|'done'|'cancelled' }
interface CodeSegMeta   { language: string; source?: string }
interface ContactMeta   { email?: string; phone?: string; org?: string; role?: string; lastContacted?: string }
interface AppointmentMeta { location?: string; attendees?: string[]; allDay?: boolean }
interface AiAgentMeta   { model?: string; promptUsed?: string; qualityRating?: 1|2|3|4|5 }
interface SecretMeta    { category?: string; expiry?: string }  // value stored encrypted in content
```

---

## 3. Sync Service — API Design

### REST Endpoints

```
POST   /auth/google          → exchange Google code for JWT
POST   /auth/refresh         → refresh JWT
GET    /auth/me              → current user

GET    /notes                → list notes (filter: type, tags, collectionId, topicId, dateFrom, dateTo, q)
POST   /notes                → create note
GET    /notes/:id            → get note
PATCH  /notes/:id            → update note (partial)
DELETE /notes/:id            → soft delete note

GET    /collections          → list collections (tree)
POST   /collections          → create collection
PATCH  /collections/:id      → rename/move
DELETE /collections/:id

GET    /topics               → list topics
POST   /topics               → create topic
PATCH  /topics/:id
DELETE /topics/:id

GET    /tags                 → list all user tags with counts
DELETE /tags/:id             → remove tag (unlinks from notes)

GET    /sync/delta?since=<ISO>&deviceId=<id>  → get all changes since cursor
POST   /sync/push            → push a batch of local changes
```

### WebSocket Events

Clients open a WS connection on `/ws` with their JWT. The server pushes change events in real time.

```ts
// Server → Client
type ServerEvent =
  | { type: 'note:created';  payload: Note }
  | { type: 'note:updated';  payload: Partial<Note> & { id: string } }
  | { type: 'note:deleted';  payload: { id: string } }
  | { type: 'tag:updated';   payload: { tags: Tag[] } }
  | { type: 'ping' }

// Client → Server
type ClientEvent =
  | { type: 'pong' }
  | { type: 'subscribe'; payload: { deviceId: string } }
```

### Sync Protocol (local-first, server-optional)

The sync engine lives in `apps/web/src/lib/sync.ts` and runs as a background service regardless of server availability.

#### Write path (always the same)

```
User edits note
  → write to local store (SQLite / IndexedDB) immediately
  → mark note syncStatus = 'pending'
  → UI updates instantly from local store (no server round-trip)
  → sync engine picks up pending note and attempts push to server
      → if server reachable: push succeeds, mark syncStatus = 'synced'
      → if server unreachable: note stays 'pending', added to retry queue
```

#### On app start / reconnect

```
1. Check if sync server is configured → if not, stop here (local-only mode)
2. Open WebSocket connection
3. Pull delta: GET /sync/delta?since=<lastCursor>&deviceId=X
4. Merge server changes into local store (server wins on conflict by updatedAt)
5. Push all locally pending notes: POST /sync/push
6. Update sync cursor to now
7. WS stays open — server pushes future changes in real time
```

#### Connection loss during editing

```
WS disconnect detected
  → useSyncStore status → 'offline'
  → UI shows offline indicator
  → all writes continue normally to local store, marked 'pending'
  → background engine polls server health every 15s
  → on reconnect: run reconnect flow above (steps 2–7)
  → pending notes flushed, status → 'synced'
```

#### First-time server setup (local notes already exist)

```
User opens Settings → adds sync server URL → authenticates via Google OAuth
  → sync engine runs full push of all localOnly notes to server
  → marks all notes syncStatus = 'synced', localOnly = false
  → from this point forward: all writes sync to server
```

### Search

Search always runs against the **local store** — it is instant and works fully offline. When a sync server is connected, the local store is kept up to date, so search results are always comprehensive.

The server search endpoint (`GET /notes?q=...`) is used only for the export/share flow where the server renders content. Client search never hits the server.

#### Local search implementation

- Desktop (SQLite): FTS5 virtual table for full-text search with filter columns
- Web (IndexedDB / Dexie.js): Dexie's `where()` for filter queries + client-side fuzzy match for full-text (FlexSearch or Fuse.js — lightweight, runs in-browser)

```ts
// SQLite FTS5 table (desktop local store)
CREATE VIRTUAL TABLE notes_fts USING fts5(
  title, content_text,  -- content_text = extracted plain text from Tiptap JSON
  content=notes,
  content_rowid=rowid
);
```

#### Server search (still defined, used for render/share only)

`GET /notes?q=text&type=task&tags=dev/backend&dateFrom=2026-01-01&dateTo=2026-07-01`

---

## 4. Frontend Architecture

### Routing

Using React Router v6.

```
/                     → redirect to /notes
/notes                → note list + editor (default view)
/notes/:id            → specific note open
/calendar             → calendar view
/search               → search results
/settings             → user settings
/auth/callback        → Google OAuth callback handler
```

### Zustand Store Structure

```ts
// One store per domain area, composed as needed

useNotesStore       → notes[], activeNoteId, loading, error
useCollectionsStore → collections[], topics[]
useTagsStore        → tags[]
useUIStore          → sidebarOpen, theme, editorMode, commandPaletteOpen
useAuthStore        → user, token, isAuthenticated  // null if no server configured

useSyncStore → {
  mode: 'local-only' | 'synced' | 'offline'
  // 'local-only' — no server configured
  // 'synced'     — connected and in sync
  // 'offline'    — server configured but unreachable

  status: 'idle' | 'syncing' | 'error'
  lastSynced: Date | null
  pendingCount: number        // number of notes awaiting push
  serverUrl: string | null    // null = local-only mode
  error: string | null
}
```

### Component Structure

```
src/
├── components/
│   ├── editor/
│   │   ├── NoteEditor.tsx        # Tiptap wrapper
│   │   ├── MetadataPanel.tsx     # Type-specific metadata fields
│   │   └── extensions/           # Custom Tiptap extensions
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── NoteList.tsx
│   │   ├── CommandPalette.tsx
│   │   └── SyncStatusBar.tsx     # Global sync indicator (see below)
│   ├── calendar/
│   │   └── CalendarView.tsx
│   ├── search/
│   │   └── SearchBar.tsx
│   └── ui/                       # Generic reusable components
├── stores/                       # Zustand stores
├── hooks/                        # Custom hooks (useSync, useSearch, useKeyboard)
├── lib/
│   ├── api.ts                    # API client (fetch wrapper) — only used when server configured
│   ├── localStore.ts             # Abstraction over SQLite (desktop) / IndexedDB (web)
│   ├── sync.ts                   # Sync engine: offline queue, WS, reconnect, delta pull/push
│   └── crypto.ts                 # Client-side encryption for secrets
├── types/                        # Re-exports from @braindump/shared
└── templates/                    # Default Tiptap content per note type
```

### Sync Status UI

`SyncStatusBar` sits in the bottom of the sidebar or top of the window chrome. It reads from `useSyncStore` and renders:

| State | Display |
|---|---|
| `local-only` | "Local only" — grey dot, no server configured |
| `synced` | "Synced" + last synced time — green dot |
| `offline` (pending = 0) | "Offline" — amber dot, reconnecting |
| `offline` (pending > 0) | "Offline — 3 changes pending" — amber dot |
| `syncing` | "Syncing…" — spinning indicator |
| `error` | "Sync error" — red dot, click for details |

Per-note sync status: notes with `syncStatus = 'pending'` show a small dot in the note list. Notes with `syncStatus = 'conflict'` (post-MVP) show a warning icon.

---

### Tiptap Extensions

Core extensions:
- `StarterKit` — headings, bold, italic, lists, blockquote, code block
- `CodeBlockLowlight` — syntax highlighting via lowlight (covers ~190 languages)
- `TaskList` + `TaskItem` — interactive checkboxes
- `Table` + `TableRow` + `TableCell` — for structured data
- `Link` — inline links
- `Placeholder` — contextual placeholder text per note type

Custom extensions:
- `NoteLink` — `[[Note Title]]` autocomplete that creates inter-note links
- `TagInline` — `#tag` inline detection and styling
- `SecretBlock` — masked/blurred content block for secrets, reveal on click

---

## 5. Desktop (Tauri) Setup

Tauri wraps the web app. The Rust backend is kept minimal — only used for things the browser can't do.

### Rust plugin usage

| Need | Tauri API |
|---|---|
| Local file export (markdown/JSON/PDF) | `tauri-plugin-fs` |
| OS keychain for master encryption key | `tauri-plugin-keychain` |
| System tray (quick capture) | `tauri-plugin-tray` |
| Global hotkey for quick capture | `tauri-plugin-global-shortcut` |
| Auto-updater | `tauri-plugin-updater` |
| Local SQLite cache (offline store) | `tauri-plugin-sql` with SQLite |

### Local SQLite — Primary Store

The local SQLite database is the **primary store**, not a cache. Every read and write in the app goes through local SQLite. The server is a secondary sync target.

- Desktop: SQLite via `tauri-plugin-sql`
- Web / PWA: IndexedDB via Dexie.js (same logical schema, different storage backend)
- No server required — the app is fully usable with SQLite only
- Auth is only required when a sync server is configured in Settings

#### Local notes table additions

The local store adds two columns that don't exist server-side:

```ts
syncStatus: 'synced' | 'pending' | 'conflict'
// 'synced'  — matches server state
// 'pending' — written locally, not yet pushed (no server, or offline)
// 'conflict' — server has a newer version (post-MVP resolution UI)

localOnly: boolean
// true if no sync server is configured — note never leaves this device
```

### Tauri App Config (tauri.conf.json highlights)

```json
{
  "app": { "windows": [{ "width": 1280, "height": 800, "title": "Braindump" }] },
  "bundle": {
    "identifier": "dev.braindump.app",
    "icon": ["icons/icon.icns", "icons/icon.ico", "icons/icon.png"]
  },
  "plugins": {
    "sql": { "preload": ["sqlite:braindump.db"] }
  }
}
```

---

## 6. Sync Service — Implementation

### Fastify Server Structure

```
apps/sync-service/src/
├── index.ts              # Server bootstrap
├── config.ts             # Env vars, DB connection string, JWT secret
├── plugins/
│   ├── db.ts             # postgres.js connection pool plugin
│   ├── auth.ts           # JWT verify decorator
│   └── ws.ts             # WebSocket hub
├── routes/
│   ├── auth.ts
│   ├── notes.ts
│   ├── collections.ts
│   ├── topics.ts
│   ├── tags.ts
│   └── sync.ts
├── services/
│   ├── noteService.ts
│   ├── syncService.ts
│   └── searchService.ts
└── types/                # Imports from @braindump/shared
```

### Google OAuth Flow

```
1. Client redirects user to: GET /auth/google
2. Server redirects to Google consent screen
3. Google redirects to: GET /auth/google/callback?code=...
4. Server exchanges code for Google profile
5. Server upserts user row in DB
6. Server issues JWT (payload: { sub: userId, email })
7. Server redirects client to /auth/callback#token=<jwt>
8. Client stores JWT in secure storage (keychain on desktop, httpOnly cookie on web)
```

### Docker Deployment

```yaml
# docker/sync-service/docker-compose.yml
services:
  sync-service:
    build: .
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://...
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - JWT_SECRET=${JWT_SECRET}
      - ALLOWED_ORIGIN=https://braindump.yourdomain.com
    networks:
      - zima-internal

networks:
  zima-internal:
    external: true
```

The container connects to the existing PostgreSQL instance on the Zima internal network. No database container needed.

---

## 7. Security

### Secrets Note Type

- Content is encrypted client-side before being sent to the server
- Encryption key derived from a user-set master password (PBKDF2 → AES-256-GCM)
- On desktop: master password key can be stored in OS keychain after first unlock
- Server stores only ciphertext — cannot read secrets
- Secrets excluded from server-side full-text search; title-only search available

### General

- JWT expiry: 1 hour access token, 30-day refresh token
- HTTPS enforced on Zima (via reverse proxy, e.g. Nginx + Let's Encrypt)
- CORS locked to known origins
- Rate limiting on auth endpoints

---

## 8. PWA Configuration

The web app is configured as an installable PWA for mobile use.

```json
// public/manifest.json
{
  "name": "Braindump",
  "short_name": "Braindump",
  "display": "standalone",
  "background_color": "#0f0f0f",
  "theme_color": "#0f0f0f",
  "start_url": "/",
  "icons": [...]
}
```

Service worker (via Vite PWA plugin) handles:
- Asset caching for offline load
- Background sync queue for offline edits (Web Background Sync API)
- Push notification support (future: reminders for tasks/appointments)

---

## 9. Development Tooling

| Tool | Use |
|---|---|
| pnpm workspaces | Monorepo package management |
| Vite | Web app bundler |
| Tauri CLI | Desktop build |
| TypeScript 5.x | All packages |
| ESLint + Prettier | Linting and formatting |
| Vitest | Unit tests |
| Playwright | E2E tests (web) |
| tsx | Run TypeScript in sync-service (dev) |
| Drizzle ORM | Type-safe SQL for sync-service (alternative: Kysely) |
| postgres.js | PostgreSQL client |

---

## 10. Build & Deployment

### Web app
- `pnpm build` in `apps/web` → static files
- Serve from Nginx on Zima, or any static host
- Same build used as Tauri frontend source

### Desktop app
- `pnpm tauri build` in `apps/desktop` → native installers (.dmg, .exe, .AppImage)

### Sync service
- `docker build` from `docker/sync-service/`
- Deploy to Zima via `docker-compose up -d`
- Runs alongside existing PostgreSQL, connected via internal Docker network

---

## 11. Export & Sharing

### PDF Export

PDF export uses **server-side Puppeteer** (headless Chromium) running in the sync service. This produces the highest-quality output: selectable text, rendered syntax highlighting, proper fonts, working links, and table formatting — equivalent to what you'd get printing from a browser, but controlled and consistent.

Client-side PDF libraries are not used — they rasterize content to images, which destroys code block legibility and text selectability.

#### Export flow

```
Client                        Sync Service
  |                               |
  |-- POST /notes/:id/export/pdf ->|
  |   (with auth JWT)             |-- fetch note + metadata from DB
  |                               |-- render note to HTML using export template
  |                               |-- Puppeteer: load HTML, print to PDF
  |<-- PDF binary (application/pdf)|
  |
  | → browser triggers download or opens in viewer
```

#### Sync service additions

```ts
// apps/sync-service/src/routes/export.ts

// POST /notes/:id/export/pdf
// Returns: PDF binary stream

// POST /notes/:id/export/markdown
// Returns: .md file download
```

Puppeteer runs inside the Docker container. Add to `Dockerfile`:
```dockerfile
RUN npx puppeteer browsers install chrome
```

#### Export render template

A separate minimal HTML template is used for PDF rendering — not the full app UI. It applies:
- Clean document typography (serif or sans-serif, configurable per export)
- Full-width code blocks with syntax highlighting via `highlight.js` (inlined CSS)
- Print-safe table borders
- Note title, type, date, and tags rendered as a document header
- Metadata fields rendered as a definition list below the header
- Page numbers in footer

#### Export options (passed as query params or request body)

```ts
interface ExportOptions {
  format: 'pdf' | 'markdown'
  includeMetadata: boolean    // include structured metadata fields in output
  includeTags: boolean
  theme: 'light' | 'dark'    // PDF color theme
  fontSize: 'small' | 'medium' | 'large'
}
```

#### Desktop (Tauri) shortcut

On desktop, the app also exposes a "Print / Save as PDF" option that uses the OS native print dialog via the Tauri webview — giving the user a quick local PDF without a server round-trip. The server export is used for sharing and consistent output.

---

### Note Sharing

A note can be shared as a **public read-only link** that requires no login. The link renders the note in a clean viewer using the export template styling.

#### Share model

```sql
CREATE TABLE note_shares (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id      UUID REFERENCES notes(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  token        TEXT UNIQUE NOT NULL,       -- random URL-safe token
  password_hash TEXT,                      -- optional password protection
  expires_at   TIMESTAMPTZ,               -- null = never expires
  include_metadata BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

#### Share API

```
POST   /notes/:id/share         → create share link, returns { url, token }
GET    /notes/:id/share         → get current share settings (if exists)
PATCH  /notes/:id/share         → update expiry, password, metadata visibility
DELETE /notes/:id/share         → revoke share link

GET    /s/:token                → public route — renders shared note (no auth required)
GET    /s/:token/pdf            → public route — download PDF of shared note
```

#### Share link behaviour

- URL format: `https://braindump.yourdomain.com/s/<token>`
- If password-protected: renders a password prompt before the note
- Shared note is always **read-only** — no edit controls rendered
- Secrets note type **cannot be shared** — share endpoint rejects with 403
- Share link reflects the note at time of viewing (live), not a snapshot
- Owner can see share status on the note (indicator in editor toolbar)

#### Share UI

In the editor toolbar, a **Share** button:
- If no active share: prompts to create one (options: expiry, password, include metadata)
- If active: shows the link with copy button, expiry info, option to revoke or update settings

---

## 12. Calendar Event Types

Calendar events are not a separate entity — they are note types with `isCalendarEvent: true` in their `NoteTypeDefinition` and additional time-range metadata fields. This keeps the architecture unified: one registry, one notes table, one sync path.

### Extended NoteTypeDefinition (calendar fields)

```ts
export interface NoteTypeDefinition {
  // ... existing fields ...

  // Calendar-specific (optional — only set on calendar event types)
  isCalendarEvent?: boolean
  startTimeField?: string    // key of the metadata field holding start datetime
  endTimeField?: string      // key of the metadata field holding end datetime
  allDayDefault?: boolean    // default to all-day event if no time component
}
```

The calendar view reads `startTimeField` and `endTimeField` from the type definition to know how to position the event. Non-event notes use `date_ref` as a single-point marker instead.

### Calendar Event Types

| Type | Description | Key Fields | All-Day Default |
|---|---|---|---|
| **Meeting** | Team or client meeting | start, end, attendees, agenda, action items | No |
| **Appointment** | Personal or external appointment | start, end, location, notes | No |
| **Scheduled Task** | A task with a specific time slot (not just a due date) | start, end, linked task, priority | No |
| **Deadline** | Hard end date for a deliverable; severity marker, no checklist | deadline date, deliverable, severity (soft/hard/critical), project | Yes |
| **Focus Block** | Blocked deep-work time; "do not disturb" visual on calendar | start, end, goal/topic, do-not-disturb flag | No |
| **On-Call Shift** | On-call rotation window; spans days on the calendar | start, end, escalation contact, runbook link | No |
| **Release / Deploy** | Scheduled deployment event | datetime, environment (dev/staging/prod), version/tag, rollback plan | No |
| **Review / Retro** | Sprint review, post-mortem, performance review | start, end, attendees, type (review/retro/postmortem), outcomes | No |
| **Reminder** | Lightweight time-stamped reminder; no meeting overhead | datetime, body | No |

### Calendar Display Rules

- **Timed events** (start + end): displayed as blocks in week/day view, dot markers in month view
- **All-day / date-only events** (Deadline, On-Call Shift): displayed as full-width banners at top of day column
- **Note markers** (non-event notes with a `date_ref`): shown as small dots below calendar date number in month view
- **Color coding**: each type's `color` from its `NoteTypeDefinition` is used consistently across all views
- **Overflow**: month view shows up to 3 items per day, then "+N more" that opens a day popover

### Recurrence (Post-MVP)

Recurrence rules (iCal RRULE format) will be added as an optional `recurrence` metadata field on any calendar event type. MVP: single instances only.

---

## 12. Note Type Registry — Developer Extensibility

The note type system is built around a central registry. Adding a new note type means adding one definition file — no changes to core logic required.

### NoteTypeDefinition Interface

```ts
// packages/shared/src/types/noteTypeDefinition.ts

export interface FieldDefinition {
  key: string
  label: string
  type: 'text' | 'textarea' | 'date' | 'datetime' | 'number' | 'boolean' | 'select' | 'multi-select' | 'user-list'
  options?: string[]        // for select / multi-select
  required?: boolean
  placeholder?: string
}

export interface NoteTypeDefinition {
  id: string                          // e.g. 'meeting', 'task', 'custom:uuid'
  label: string                       // e.g. 'Meeting'
  icon: string                        // icon name from icon set
  color: string                       // hex — used for calendar badges and type pills
  system: boolean                     // true = built-in, false = user-defined custom type
  metadataFields: FieldDefinition[]   // fields shown in the metadata panel
  defaultMetadata: Record<string, unknown>
  contentTemplate: () => object       // returns a default Tiptap JSON doc
  calendarDateField?: string          // which metadataFields.key to use as the calendar date
  searchableMetadataFields?: string[] // which metadata fields to include in full-text search
}
```

### Registry Pattern

```ts
// apps/web/src/lib/noteTypeRegistry.ts

import type { NoteTypeDefinition } from '@braindump/shared'
import { meetingType }    from '../noteTypes/meeting'
import { taskType }       from '../noteTypes/task'
import { codeSegmentType } from '../noteTypes/codeSegment'
// ... etc

const builtInTypes: NoteTypeDefinition[] = [
  meetingType, taskType, codeSegmentType, /* ... */
]

// Custom types are loaded from the server at runtime and merged in
let registry: Map<string, NoteTypeDefinition> = new Map()

export function initRegistry(customTypes: NoteTypeDefinition[]) {
  registry = new Map([...builtInTypes, ...customTypes].map(t => [t.id, t]))
}

export function getType(id: string): NoteTypeDefinition | undefined {
  return registry.get(id)
}

export function getAllTypes(): NoteTypeDefinition[] {
  return Array.from(registry.values())
}
```

### Adding a New Built-In Note Type (developer workflow)

1. Create `apps/web/src/noteTypes/myNewType.ts` exporting a `NoteTypeDefinition`
2. Import and add it to the `builtInTypes` array in `noteTypeRegistry.ts`
3. Add the new type id to the `NoteType` union in `packages/shared/src/types/note.ts`
4. Add a matching `metadata` shape interface in `packages/shared/src/types/metadata.ts`

That is the complete process. No changes to the editor, API, or database schema.

### Built-In Type File Structure

```
apps/web/src/noteTypes/
├── dailyJot.ts
├── shortMeeting.ts
├── meeting.ts
├── task.ts
├── codeSegment.ts
├── techDoc.ts
├── contact.ts
├── secret.ts
├── appointment.ts
├── aiAgent.ts
├── scratch.ts
└── index.ts         # re-exports all built-in types
```

---

## 12. Custom Note Types (User-Defined)

Users can create their own note types via a template builder in Settings. These behave identically to built-in types at runtime — they are simply `NoteTypeDefinition` objects stored in the database and loaded into the registry on login.

### Database Schema Addition

```sql
CREATE TABLE custom_note_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT 'file',
  color       TEXT NOT NULL DEFAULT '#6366f1',
  metadata_fields    JSONB NOT NULL DEFAULT '[]',   -- FieldDefinition[]
  default_metadata   JSONB NOT NULL DEFAULT '{}',
  content_template   JSONB NOT NULL DEFAULT '{}',   -- Tiptap JSON doc
  calendar_date_field TEXT,
  searchable_metadata_fields JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

The `id` of a custom type is prefixed `custom:` when used as a `note.type` value (e.g. `custom:3f2a...`). This keeps custom types distinguishable from built-in string literals at the type system level.

### API Additions

```
GET    /note-types/custom       → list user's custom note types
POST   /note-types/custom       → create a custom note type
PATCH  /note-types/custom/:id   → update label, icon, fields, template
DELETE /note-types/custom/:id   → delete (notes of this type remain, shown as 'unknown type')
```

Custom types are loaded during the initial sync bootstrap and added to the client registry alongside built-in types.

### Template Builder UI

Accessible from Settings > Note Types > Create Custom Type.

- **Name + icon + color** picker at the top
- **Metadata fields editor**: add/remove/reorder fields, set type (text, date, select, etc.), mark required
- **Content template editor**: a full Tiptap editor instance — the user lays out the starting content (headings, bullet lists, placeholder text, tables) that every new note of this type will open with
- **Calendar date field**: dropdown — "which field should appear on the calendar?"
- Preview panel showing how a note of this type will look

### Runtime Behaviour

When a user creates a note of a custom type:

1. `contentTemplate()` is called — returns the stored Tiptap JSON doc as the initial content
2. The metadata panel renders the `metadataFields` array as form fields
3. `defaultMetadata` pre-populates any fields with defaults
4. The note is saved with `type: 'custom:uuid'` and synced normally

Custom type definitions are included in the delta sync, so all devices share the same set of custom types.

---

## 13. MVP Build Order

1. Monorepo scaffold + shared types package
2. Sync service: DB schema + migrations (Drizzle), auth (Google OAuth), basic CRUD endpoints
3. Web app: auth flow, note list, Tiptap editor, basic note types (Daily Jot, Task, Meeting, Code Segment, Scratch)
4. Zustand stores + API client
5. Tag system + collection sidebar
6. Search (basic full-text)
7. Calendar view
8. Sync engine (delta sync + WebSocket)
9. Tauri desktop wrapper
10. PWA manifest + service worker
11. Remaining note types (Contact, Appointment, AI Agent)
12. Secrets (client-side encryption)
13. Bi-directional linking
