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

/** Unauthenticated fetch — for login/register before we have a token */
export async function apiFetch<T>(serverUrl: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${serverUrl}${path}`, {
    method: body !== undefined ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}
