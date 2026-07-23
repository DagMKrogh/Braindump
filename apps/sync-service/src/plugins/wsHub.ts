/**
 * WebSocket hub — manages connected clients and broadcasts server events.
 */
import type { WebSocket } from '@fastify/websocket'
import type { ServerEvent } from '@braindump/shared'

// userId → Set of open WebSocket connections
const connections = new Map<string, Set<WebSocket>>()

export function registerConnection(userId: string, ws: WebSocket) {
  if (!connections.has(userId)) connections.set(userId, new Set())
  connections.get(userId)!.add(ws)

  ws.on('close', () => {
    connections.get(userId)?.delete(ws)
  })
}

export function broadcast(userId: string, event: ServerEvent, excludeWs?: WebSocket) {
  const sockets = connections.get(userId)
  if (!sockets) return
  const payload = JSON.stringify(event)
  for (const ws of sockets) {
    if (ws !== excludeWs && ws.readyState === ws.OPEN) {
      ws.send(payload)
    }
  }
}
