/**
 * useBotLogs — Real-Time Bot Log Stream Hook
 *
 * Subscribes to 'bot:log' events broadcast by bot-monitor.socket.ts, which
 * forwards every Winston log line as a raw ANSI string — identical to what
 * the server terminal prints. ansi-to-react in the UI renders the colours.
 *
 * Capped at MAX_ENTRIES to prevent unbounded memory growth during long sessions.
 */

import { useEffect, useState } from 'react'
import { getSocket } from '@/lib/socket.lib'

const MAX_ENTRIES = 200

interface UseBotLogsReturn {
  logs: string[]
}

export function useBotLogs(sessionKey?: string): UseBotLogsReturn {
  const [logs, setLogs] = useState<string[]>([])

  useEffect(() => {
    // Defer subscription until the session key is known — bot DTO loads async and
    // subscribing to an empty room would result in a permanently blank console.
    if (!sessionKey) return

    const socket = getSocket()
    if (!socket.connected) socket.connect()

    const onHistory = (entries: string[]) => {
      // Hydrate with the server's per-session sliding window on subscribe
      setLogs(entries.slice(-MAX_ENTRIES))
    }

    const onLog = (entry: string) => {
      setLogs((prev) => {
        const next = [...prev, entry]
        return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next
      })
    }

    socket.on('bot:log:history', onHistory)
    socket.on('bot:log:keyed', onLog)

    // Join the session-specific room — server responds immediately with buffered history
    socket.emit('bot:log:subscribe', sessionKey)

    return () => {
      socket.off('bot:log:history', onHistory)
      socket.off('bot:log:keyed', onLog)
      socket.emit('bot:log:unsubscribe', sessionKey)
    }
  }, [sessionKey])

  return { logs }
}
