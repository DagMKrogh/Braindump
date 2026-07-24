# Braindump — External Ingest & Local Bridge

How external tools (Claude skills, scripts, automations) push notes and events into Braindump.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  External Sources                                                            │
│  ─────────────────                                                           │
│  /braindump VSCode skill │ scripts │ automations │ future integrations       │
└────────────┬─────────────────────────┬───────────────────────────────────────┘
             │                         │
             │ (with sync service)     │ (local / no server)
             ▼                         ▼
┌────────────────────────┐   ┌─────────────────────────┐
│   Sync Service         │   │   Local Bridge          │
│   :3001                │   │   :3002                 │
│                        │   │                         │
│  POST /ingest          │   │  POST /ingest           │
│  Auth: X-API-Key       │   │  POST /events (generic) │
│  Writes to: Postgres   │   │  Auth: X-API-Key        │
│  Next sync pulls into  │   │  Writes to: WebSocket   │
│  browser's IndexedDB   │   │  broadcast → browser    │
└────────────────────────┘   └──────────┬──────────────┘
                                        │ ws://127.0.0.1:3002/ws
                                        ▼
                             ┌─────────────────────────┐
                             │   Browser (Braindump)   │
                             │                         │
                             │  localBridge.ts client  │
                             │  auto-reconnects        │
                             │  dispatches events      │
                             │          │              │
                             │          ▼              │
                             │  IndexedDB (Dexie)      │
                             │  + notesStore (Zustand) │
                             └─────────────────────────┘
```

---

## Path 1 — Sync Service Ingest (`POST /ingest`)

**Use when:** The sync service is running (Zima/Docker deployment or local dev with `pnpm dev:sync`).

### Endpoint

```
POST http://<host>:3001/ingest
X-API-Key: <INGEST_API_KEY>
Content-Type: application/json

{
  "title": "My Note Title",
  "body": "Note content here.\n\nSecond paragraph.",
  "tags": ["optional-extra-tag"],
  "type": "scratch",
  "userEmail": "user@example.com"
}
```

- `title` and `body` are required.
- `tags` merges with the always-applied `["claude", "ai-generated"]`.
- `type` defaults to `"scratch"` — can be any built-in or custom note type.
- `userEmail` resolves to a specific user; omit to default to the first user in the DB.
- Body paragraphs (split on `\n\n`) are converted to Tiptap paragraph nodes.

### Auth

Set `INGEST_API_KEY` in the sync service `.env`. Set the same value as `BRAINDUMP_API_KEY` in your shell environment. The header `X-API-Key: <value>` is checked on every request.

If `INGEST_API_KEY` is not set in the environment, the endpoint returns `401` for all requests.

### Flow

```
POST /ingest
  → verify X-API-Key against config.ingestApiKey
  → resolve userId (by email or first user)
  → convert body text → Tiptap JSON doc
  → insert into notes table (Postgres)
  → note is picked up on next delta sync (POST /sync/push pulls pending notes)
  → browser's IndexedDB is updated
```

---

## Path 2 — Local Bridge (`apps/local-bridge`)

**Use when:** Running Braindump locally without the full sync service stack, or for real-time delivery directly into the browser without waiting for a sync cycle.

The bridge is a zero-dependency Node.js process (uses the `ws` package). It has no database — it holds events in memory and broadcasts them to any connected browser tabs over WebSocket.

### Starting the bridge

```bash
pnpm dev:bridge
# or
pnpm --filter @braindump/local-bridge dev
```

The bridge starts on `http://127.0.0.1:3002` by default.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Returns `{ ok, clients, ts }` — unauthenticated |
| `POST` | `/ingest` | Create a note — same body as sync service ingest |
| `POST` | `/events` | Broadcast any event `{ type, payload }` to connected tabs |
| `GET` | `/ws` | WebSocket upgrade endpoint (browser connects here) |

### Event protocol

All WebSocket messages are JSON:
```json
{ "type": "note:ingest", "payload": { ...LocalNote } }
```

The type string is the only routing key. The web app dispatches to registered handlers by type.

### Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `LOCAL_BRIDGE_PORT` | `3002` | Port to listen on |
| `LOCAL_BRIDGE_KEY` | `""` | API key for HTTP endpoints. Empty = no auth (dev mode, logs a warning) |

### Flow

```
POST /ingest
  → verify X-API-Key (if LOCAL_BRIDGE_KEY set)
  → build LocalNote object (id = crypto.randomUUID(), tags include claude/ai-generated)
  → broadcast { type: 'note:ingest', payload: note } to all WS clients
  → browser handler: upsertNote(Dexie) + notesStore.upsertNote(Zustand)
  → note appears in UI immediately, no sync round-trip
```

---

## Web App Client (`apps/web/src/lib/localBridge.ts`)

A singleton `LocalBridgeClient` that:
- Connects to `ws://127.0.0.1:<LOCAL_BRIDGE_PORT>/ws` on `start()`
- Silently retries on disconnect with exponential backoff (2s → 30s)
- Dispatches incoming events to registered handlers by type
- Started/stopped by `AppShell` on mount/unmount

### Registering new event handlers

```ts
import { localBridge } from '../lib/localBridge'

localBridge.on('reminder:trigger', (payload) => {
  // payload is whatever was sent in the POST /events body
  scheduleReminder(payload as ReminderPayload)
})
```

Then from any script or skill:
```bash
curl -X POST http://127.0.0.1:3002/events \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{ "type": "reminder:trigger", "payload": { "noteId": "abc", "at": "2026-08-01T09:00:00Z" } }'
```

---

## `/braindump` Claude Skill

A slash command (`/braindump`) available in any VSCode chat session with Claude Code.

**Location:** `~/.claude/commands/braindump.md`

**Usage:**
```
/braindump My Note Title — Content goes here. Can be multiple sentences.
```

The skill:
1. Parses title + content from the argument (em dash or ` - ` separator, or prompts if missing)
2. Checks env vars to determine target (sync service first, bridge fallback)
3. POSTs via Node.js `http`/`https` with args passed as `process.argv` (injection-safe)
4. Reports success with note ID and which path was used

**Environment variables** (add to `~/.zshrc`):

| Var | Purpose |
|-----|---------|
| `BRAINDUMP_URL` | Sync service URL (e.g. `http://zima:3001`). If set, skill uses this. |
| `BRAINDUMP_API_KEY` | Must match `INGEST_API_KEY` in sync service `.env` |
| `LOCAL_BRIDGE_PORT` | Bridge port override (default `3002`) |
| `LOCAL_BRIDGE_KEY` | Must match `LOCAL_BRIDGE_KEY` env on the bridge process |

---

## Setup Scripts

### Mac/Linux — configure for sync service (Zima deployment)

```bash
cat >> ~/.zshrc << 'EOF'

# Braindump external ingest
export BRAINDUMP_URL=http://zima.local:3001      # change to your Zima address
export BRAINDUMP_API_KEY=your-secret-key-here    # must match INGEST_API_KEY in sync .env
EOF
source ~/.zshrc
```

Verify:
```bash
curl -s -X POST "$BRAINDUMP_URL/ingest" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $BRAINDUMP_API_KEY" \
  -d '{"title":"Test","body":"Hello from curl"}' | jq .
```

---

### Mac/Linux — configure for local bridge only (no sync service)

```bash
cat >> ~/.zshrc << 'EOF'

# Braindump local bridge
export LOCAL_BRIDGE_KEY=dev-local-key           # set same value when starting bridge
# BRAINDUMP_URL intentionally not set — skill will use bridge
EOF
source ~/.zshrc
```

Start the bridge:
```bash
LOCAL_BRIDGE_KEY=dev-local-key pnpm dev:bridge
```

Verify:
```bash
curl -s http://127.0.0.1:3002/health | jq .
```

---

### Both environments (sync service + local bridge as fallback)

```bash
cat >> ~/.zshrc << 'EOF'

# Braindump — sync service (primary)
export BRAINDUMP_URL=http://zima.local:3001
export BRAINDUMP_API_KEY=your-secret-key-here

# Braindump — local bridge (used by /braindump skill when BRAINDUMP_URL is unreachable,
#             or when posting directly to an open browser tab)
export LOCAL_BRIDGE_KEY=dev-local-key
EOF
source ~/.zshrc
```

---

### Regenerate the Claude skill on a new machine

The `/braindump` skill lives in `~/.claude/commands/braindump.md`. To install it on a new machine:

```bash
mkdir -p ~/.claude/commands
cp /path/to/braindump-repo/ContextDocs/braindump-skill-source.md ~/.claude/commands/braindump.md
```

Or copy it manually from `~/.claude/commands/braindump.md` on the original machine.

---

## Adding Future Integrations

The bridge is designed to be an extensible event bus. Adding a new integration:

**1. Define the event type and payload shape** (in `packages/shared/src/types/sync.ts` if shared):
```ts
export type BridgeEventType = 'note:ingest' | 'reminder:trigger' | 'calendar:event' | ...
```

**2. Register a handler in the web app** (`apps/web/src/lib/localBridge.ts`):
```ts
localBridge.on<MyPayload>('my:event', async (payload) => {
  // handle it
})
```

**3. Push from any external tool**:
```bash
POST /events  { "type": "my:event", "payload": { ... } }
```

No changes needed to the bridge server itself — it routes by type string.

**Ideas for future integrations:**
- `reminder:trigger` — pop a toast in the UI for a timed reminder
- `calendar:event` — push a calendar event from an ICS import or script
- `file:attach` — attach a file to a note from the filesystem
- `tag:batch-apply` — apply a tag to a set of note IDs from a script
- `note:update` — patch an existing note's content from outside the UI
