/**
 * Local Bridge client — connects the web app to the local-bridge process
 * via WebSocket so external tools (Claude skills, scripts) can push events
 * into the browser's local store in real time.
 *
 * Usage:
 *   localBridge.on('note:ingest', handler)
 *   localBridge.start()   // called from AppShell
 *   localBridge.stop()    // called on unmount / nav away
 *
 * The bridge silently does nothing if the local-bridge server isn't running —
 * no errors shown to the user; it just retries in the background.
 *
 * Adding new event types:
 *   1. Register a handler: localBridge.on('my:event', (payload) => { ... })
 *   2. On the bridge side: POST /events { type: 'my:event', payload: {...} }
 *   That's it — no other wiring needed.
 */

import type { LocalNote } from '@braindump/shared'
import { upsertNote, softDeleteNote } from './localStore'
import { useNotesStore } from '../stores/notesStore'

export type BridgeEvent = { type: string; payload: unknown }
export type BridgeHandler<T = unknown> = (payload: T) => void | Promise<void>

const BRIDGE_URL = `ws://127.0.0.1:${import.meta.env['VITE_LOCAL_BRIDGE_PORT'] ?? 3002}/ws`
const RECONNECT_BASE_MS = 2_000
const RECONNECT_MAX_MS = 30_000

class LocalBridgeClient {
  private ws: WebSocket | null = null
  private handlers = new Map<string, BridgeHandler[]>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = RECONNECT_BASE_MS
  private running = false

  // ── Public API ─────────────────────────────────────────────────────────

  on<T>(type: string, handler: BridgeHandler<T>) {
    const list = this.handlers.get(type) ?? []
    list.push(handler as BridgeHandler)
    this.handlers.set(type, list)
    return this // chainable
  }

  off(type: string, handler: BridgeHandler) {
    const list = this.handlers.get(type)
    if (list) this.handlers.set(type, list.filter((h) => h !== handler))
  }

  start() {
    if (this.running) return
    this.running = true
    this.connect()
  }

  stop() {
    this.running = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
  }

  /** Send an event to the bridge server for relay to other clients. */
  send(type: string, payload: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }))
    }
  }

  // ── Internal ───────────────────────────────────────────────────────────

  private connect() {
    if (!this.running) return
    try {
      const ws = new WebSocket(BRIDGE_URL)
      this.ws = ws

      ws.addEventListener('open', () => {
        this.reconnectDelay = RECONNECT_BASE_MS
        console.debug('[bridge] connected')
      })

      ws.addEventListener('message', (ev: MessageEvent<string>) => {
        let event: BridgeEvent
        try { event = JSON.parse(ev.data) as BridgeEvent }
        catch { return }
        this.dispatch(event)
      })

      ws.addEventListener('close', () => {
        this.ws = null
        this.scheduleReconnect()
      })

      ws.addEventListener('error', () => {
        // Intentionally silent — bridge may not be running
        ws.close()
      })
    } catch {
      this.scheduleReconnect()
    }
  }

  private dispatch(event: BridgeEvent) {
    const handlers = this.handlers.get(event.type) ?? []
    for (const h of handlers) {
      try { void h(event.payload) }
      catch (err) { console.error(`[bridge] handler error for ${event.type}:`, err) }
    }
  }

  private scheduleReconnect() {
    if (!this.running) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, RECONNECT_MAX_MS)
      this.connect()
    }, this.reconnectDelay)
  }
}

// ── Singleton instance ─────────────────────────────────────────────────────

export const localBridge = new LocalBridgeClient()

// ── Built-in handler: note:ingest ──────────────────────────────────────────

localBridge.on<LocalNote>('note:ingest', async (raw) => {
  const note = { ...raw, userId: raw.userId || 'local' }
  await upsertNote(note)
  useNotesStore.getState().upsertNote(note)
  console.debug('[bridge] note ingested:', note.id, note.title)
})

// ── Peer sync: note created/updated in another client ─────────────────────

localBridge.on<LocalNote>('note:upsert', async (raw) => {
  const note = { ...raw, userId: raw.userId || 'local' }
  await upsertNote(note)
  useNotesStore.getState().upsertNote(note)
  console.debug('[bridge] note synced:', note.id, note.title)
})

localBridge.on<{ id: string }>('note:delete', async ({ id }) => {
  await softDeleteNote(id)
  useNotesStore.getState().removeNote(id)
  console.debug('[bridge] note deleted:', id)
})
