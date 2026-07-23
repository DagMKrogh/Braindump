/**
 * API client — thin fetch wrapper.
 * Only used when a sync server is configured. All UI reads from local store.
 */
import { useSyncStore } from '../stores/syncStore'
import { useAuthStore } from '../stores/authStore'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { serverUrl } = useSyncStore.getState()
  if (!serverUrl) throw new Error('No sync server configured')

  const { accessToken } = useAuthStore.getState()
  const res = await fetch(`${serverUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    throw new Error(`API ${method} ${path} failed: ${res.status}`)
  }

  return res.json() as Promise<T>
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
