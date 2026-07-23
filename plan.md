# Braindump — Project Criteria

## Vision

A developer-focused second-brain application. Not just a note app — a structured knowledge system where every piece of information has a type, a context, and a home. Fast to capture, easy to retrieve, powerful to organize.

---

## Core Principles

- **Capture first, organize later** — getting things in quickly matters more than perfect structure upfront
- **Structure without friction** — templates guide without forcing; defaults should be sensible
- **Search is primary navigation** — the UI should treat search as a first-class citizen, not an afterthought
- **Local-first** — data lives on disk in readable formats; no vendor lock-in
- **Developer-native** — code is a first-class content type; markdown is the baseline format

---

## Note Types & Templates

Each note type has a defined template with relevant fields and metadata. Users can extend or customize templates.

| Type | Purpose | Key Fields |
|---|---|---|
| **Daily Jot** | Freeform daily capture / journal | Date, mood/energy (optional), body, linked tasks |
| **Short Meeting** | Quick sync / standup notes | Date, attendees, points discussed, action items |
| **Meeting** | Full meeting notes | Date, attendees, agenda, discussion, decisions, action items, follow-ups |
| **Task** | Actionable todo item | Title, due date, priority, status, tags, linked notes |
| **Code Segment** | Reusable or notable code snippets | Title, language, tags, code block, description, source/context |
| **Technical Documentation** | Reference docs, HOWTOs, architecture notes | Title, tags, version, body (full markdown), related links |
| **Contact Card** | Person / team reference | Name, role/org, email, phone, social handles, notes, last contacted |
| **Secret** | Sensitive credentials / keys | Title, value (encrypted at rest), category, notes, expiry date |
| **Appointment** | Scheduled event | Title, date/time, location, attendees, linked notes |
| **AI Agent Note** | Outputs, prompts, or context from AI workflows | Agent/model, date, prompt used, output, tags, quality rating |
| **Scratch / Short Note** | Anything that doesn't fit elsewhere | Title (optional), body, tags |

---

## Organization System

### Tags
- Free-form, multi-tag per note
- Hierarchical tags supported (e.g., `dev/backend`, `project/braindump`)
- Tag browser / tag cloud in sidebar

### Collections (Notebooks)
- Notes can belong to one collection
- Collections can be nested (folders)
- Default collections: Inbox, Archive

### Topics
- A higher-level grouping above collections (e.g., "Work", "Personal", "Project X")
- Used for filtering and dashboard grouping

### Linking
- Notes can be bi-directionally linked (`[[Note Title]]` syntax, Obsidian-style)
- Backlinks panel shows what references the current note
- Link graph view (nice-to-have, not MVP)

---

## Search

Search must be fast, flexible, and multi-dimensional.

### Search Modes
- **Quick search** — instant full-text across all notes (keyboard shortcut, always accessible)
- **Filtered search** — combine any of: tags, note type, collection, topic, date range, has-attachment
- **Natural date search** — "last week", "this month", "before June"

### Search Targets
- Note title
- Note body / content
- Tags
- Metadata fields (attendee names, contact names, code language, etc.)
- Note type

### UI Behavior
- Results ranked by relevance + recency
- Snippet preview with matched terms highlighted
- Keyboard navigable results

---

## Calendar View

- Month / week / day views
- Notes with dates (meetings, appointments, daily jots, tasks with due dates) appear on their date
- Clicking a date shows all notes for that day in a side panel
- Color coding by note type
- Tasks show as due-date markers; overdue tasks flagged visually
- Quick-capture from calendar: click a date and select note type to create pre-dated note

---

## Editor

- Rich markdown editor with live preview or split view
- Syntax highlighting for code blocks (auto-detect language)
- Inline task checkboxes
- Inline tag autocomplete
- Note linking with `[[` autocomplete
- Frontmatter / metadata panel (collapsible, not inline noise)
- Distraction-free / focus mode

---

## Security

- Secrets note type: values encrypted at rest using a master password or OS keychain
- Lock screen / idle timeout option
- Secrets never appear in plain-text search results (title only)
- Export of secrets requires explicit re-authentication

---

## Developer-Specific Features

- Code segments: full syntax highlighting, copy button, language badge
- Terminal-style tag entry (type `#tag` inline)
- Git-friendly storage format (one file per note or structured folder)
- CLI companion (nice-to-have): `braindump add`, `braindump search`
- AI Agent Notes: structured capture of LLM workflows, prompts, and outputs

---

## Data & Storage

- Notes stored as markdown files with YAML frontmatter
- Folder structure mirrors collections
- Index/database layer (SQLite or similar) for fast search — derived from files, not the source of truth
- Export: markdown, JSON, PDF per note or bulk
- Import: markdown files, Notion export, Evernote ENEX (nice-to-have)

---

## UI / UX Direction

- Three-panel layout: sidebar (nav/collections/tags) | note list | editor/viewer
- Command palette (Cmd+K) for all actions
- Dark and light themes
- Keyboard-first: every core action reachable without mouse
- Responsive enough for a secondary monitor / half-screen use

---

## MVP Scope (Phase 1)

Focus on the core loop: capture, organize, retrieve.

- [ ] Note creation with type selection and templates
- [ ] Markdown editor with frontmatter metadata
- [ ] Tag system
- [ ] Collections / folder structure
- [ ] Full-text search with type/tag filters
- [ ] Daily Jot, Task, Meeting, Code Segment, Technical Doc, Short Note types
- [ ] Basic calendar view (month, click-to-view)
- [ ] Dark/light theme

## Phase 2

- [ ] Contact cards
- [ ] Appointment type with calendar integration
- [ ] Secrets (encrypted)
- [ ] AI Agent Notes type
- [ ] Bi-directional linking + backlinks
- [ ] Quick capture (global hotkey / tray)

## Phase 3 / Nice-to-Have

- [ ] Graph view
- [ ] CLI companion
- [ ] Import (Notion, Evernote)
- [ ] Mobile companion / sync
- [ ] AI-assisted tagging and summarization

---

## Platform

- **Desktop app** — native desktop client (Windows/macOS/Linux)
- **Web app** — browser-accessible, also installable as a PWA (Progressive Web App) for mobile
- Shared frontend codebase between desktop and web where possible

---

## Sync Architecture

### Local-First, Server-Optional

The local store is the **primary source of truth**. The app is fully functional with no server configured. The sync service is an optional layer that enables multi-device access and backup.

- All reads and writes go to local storage first (SQLite on desktop, IndexedDB on web)
- The sync service is addable at any time via Settings — existing local notes are pushed up on first connect
- If the server goes down during use, the app continues working without interruption; changes queue locally and sync automatically when the connection is restored
- Authentication is only required when a sync server is configured

### Sync Modes

| Mode | Description |
|---|---|
| **Local only** | No server configured. All notes stored locally. Full functionality. |
| **Synced** | Server configured and reachable. Changes sync in real time via WebSocket. |
| **Offline (queued)** | Server configured but unreachable. Writes queue locally with pending status. Auto-syncs on reconnect. |

### Zima Server Sync Service
- A small Docker container hosted on the Zima server acts as the optional sync backend
- Conflict resolution: last-write-wins with per-field timestamps
- Foundation for future server-side features (shared notebooks, webhooks, etc.)

### Sync Service Responsibilities
- Receive and store note changes from clients
- Distribute changes to other connected clients (real-time via WebSocket, fallback to polling)
- Store canonical copy of all notes server-side

### Data Flow
```
Desktop Client  <-->|
Web / PWA       <-->|---> Zima Sync Service (Docker) <---> Server DB   [optional]
Mobile PWA      <-->|

All clients write to local store first. Sync service is a secondary target.
```

---

## Authentication

- **Google OAuth** as the primary sign-in method
- Auth handled by the sync service backend
- JWT tokens issued after OAuth, used for all subsequent API calls
- **User model**: multi-user capable from the start, but initially single user (owner account)
- User management: simple admin panel or config — no self-registration during development phase
- Future: invite-based or open registration toggle

---

## Tech Stack (Resolved)

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React + TypeScript | Large ecosystem, best rich-text editor library support |
| Editor | Tiptap | ProseMirror-based, extensible, handles code blocks, tables, checklists, markdown shortcuts |
| State management | Zustand | Lightweight, minimal boilerplate, sufficient for this app's complexity |
| Desktop wrapper | Tauri | ~5MB bundle vs ~150MB Electron; uses OS webview; native OS keychain, file system via Rust plugins |
| Sync service | Node.js + Fastify + TypeScript | Keeps the full stack in TypeScript; fast, low-overhead HTTP + WebSocket server |
| Server DB | PostgreSQL | Already running on Zima; robust multi-user support |
| Conflict resolution | Last-write-wins (per-field timestamps) | Simultaneous multi-device edits are not a realistic scenario |
| Auth | Google OAuth + JWT | Simple, no password management, multi-user ready |
| Language | TypeScript throughout | Shared types between frontend and sync service; single language across the stack |

---

## No Open Questions — Ready for Technical Planning
