/**
 * WebSocket 可能重复投递同一 message_id；双模式时与 HTTP 同时到达也去重
 */
const seen = new Map<string, number>()
const DEFAULT_TTL_MS = 2 * 60 * 1000

function prune(now: number, ttl: number) {
  for (const [id, t] of seen) {
    if (now - t > ttl) seen.delete(id)
  }
}

export function isDuplicateMessageId(messageId: string | undefined, ttlMs = DEFAULT_TTL_MS): boolean {
  if (!messageId) return false
  const now = Date.now()
  prune(now, ttlMs)
  if (seen.has(messageId)) return true
  seen.set(messageId, now)
  return false
}
