/**
 * Sync engine — manages the lifecycle of server sync.
 * Runs as a background service. All writes go through local store first;
 * this engine pushes pending changes to the server and pulls deltas.
 */
import type { DeltaResponse, SyncPushRequest } from '@braindump/shared'
import { getPendingNotes, upsertNotes, upsertCollections, upsertTopics, upsertTags, upsertCustomNoteTypes } from './localStore'
import { apiClient } from './api'
import { initRegistry } from './noteTypeRegistry'
import { useSyncStore } from '../stores/syncStore'
import { useNotesStore } from '../stores/notesStore'
import { useCollectionsStore } from '../stores/collectionsStore'
import { useAuthStore } from '../stores/authStore'

const HEALTH_POLL_INTERVAL_MS = 15_000
const DEVICE_ID_KEY = 'braindump-device-id'

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

class SyncEngine {
  private ws: WebSocket | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private running = false

  start() {
    const { serverUrl } = useSyncStore.getState()
    if (!serverUrl) return // local-only mode
    if (!useAuthStore.getState().isAuthenticated) return // no token yet
    this.running = true
    void this.connect()
  }

  stop() {
    this.running = false
    this.ws?.close()
    if (this.pollTimer) clearInterval(this.pollTimer)
  }

  private async connect() {
    const { serverUrl } = useSyncStore.getState()
    if (!serverUrl || !this.running) return

    try {
      await this.pullDelta()
      await this.flushPending()
      this.openWebSocket(serverUrl)
      useSyncStore.getState().setMode('synced')
      useSyncStore.getState().setError(null)
    } catch {
      useSyncStore.getState().setStatus('idle')
      useSyncStore.getState().setMode('offline')
      this.startHealthPoll()
    }
  }

  private openWebSocket(serverUrl: string) {
    const wsUrl = serverUrl.replace(/^http/, 'ws') + '/sync/ws'
    const { accessToken } = useNotesStore.getState() as unknown as { accessToken?: string }
    this.ws = new WebSocket(`${wsUrl}?token=${accessToken ?? ''}`)

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as { type: string; payload?: unknown }
        void this.handleServerEvent(msg)
      } catch { /* ignore parse errors */ }
    }

    this.ws.onclose = () => {
      if (!this.running) return
      useSyncStore.getState().setMode('offline')
      this.startHealthPoll()
    }

    this.ws.onerror = () => {
      useSyncStore.getState().setMode('offline')
    }
  }

  private async handleServerEvent(msg: { type: string; payload?: unknown }) {
    const { upsertNote, removeNote } = useNotesStore.getState()
    if (msg.type === 'note:created' || msg.type === 'note:updated') {
      const note = msg.payload as Parameters<typeof upsertNote>[0]
      await upsertNotes([{ ...note, syncStatus: 'synced', localOnly: false }])
      upsertNote({ ...note, syncStatus: 'synced', localOnly: false })
    } else if (msg.type === 'note:deleted') {
      const { id } = msg.payload as { id: string }
      removeNote(id)
    }
  }

  private async pullDelta() {
    const { lastSynced } = useSyncStore.getState()
    const since = lastSynced ?? new Date(0).toISOString()
    const deviceId = getDeviceId()

    useSyncStore.getState().setStatus('syncing')
    const delta: DeltaResponse = await apiClient.get(`/sync/delta?since=${since}&deviceId=${deviceId}`)

    // Persist to local store
    const localNotes = delta.notes.map((n) => ({ ...n, syncStatus: 'synced' as const, localOnly: false }))
    await upsertNotes(localNotes)
    await upsertCollections(delta.collections)
    await upsertTopics(delta.topics)
    await upsertTags(delta.tags)
    await upsertCustomNoteTypes(delta.customNoteTypes)

    // Re-initialise registry with synced custom types
    initRegistry(delta.customNoteTypes)

    // Update Zustand
    useNotesStore.getState().setNotes(localNotes)
    useCollectionsStore.getState().setCollections(delta.collections)
    useCollectionsStore.getState().setTopics(delta.topics)
    useCollectionsStore.getState().setTags(delta.tags)

    useSyncStore.getState().setLastSynced(delta.cursor)
    useSyncStore.getState().setStatus('idle')
  }

  private async flushPending() {
    const pending = await getPendingNotes()
    if (pending.length === 0) return

    const body: SyncPushRequest = { deviceId: getDeviceId(), notes: pending }
    await apiClient.post('/sync/push', body)

    // Mark pushed notes as synced
    const synced = pending.map((n) => ({ ...n, syncStatus: 'synced' as const, localOnly: false }))
    await upsertNotes(synced)
    useSyncStore.getState().setPendingCount(0)
  }

  private startHealthPoll() {
    if (this.pollTimer) return
    this.pollTimer = setInterval(async () => {
      try {
        await apiClient.get('/health')
        if (this.pollTimer) clearInterval(this.pollTimer)
        this.pollTimer = null
        void this.connect()
      } catch { /* still offline */ }
    }, HEALTH_POLL_INTERVAL_MS)
  }
}

export const syncEngine = new SyncEngine()
