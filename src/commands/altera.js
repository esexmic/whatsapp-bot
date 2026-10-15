import { requireStaff } from '../lib/guard.js'

if (!global._spamIntervals) global._spamIntervals = new Map()

const DELAY = 1500
const MAX_MESSAGES = 20

export default async function handler(conn, m, args, db) {
  const jid = m?.chat || m?.key?.remoteJid
  if (!jid) return

  if (!(await requireStaff(conn, m, db, { label: '.altera' }))) return

  if (global._spamIntervals.has(jid)) {
    return conn.sendMessage(jid, { text: '⚠️ Ya hay spam activo. Usa .pause para detenerlo.' }, { quoted: m })
  }

  await conn.sendMessage(jid, { text: '🔥 Spam iniciado. Usa .pause para detener.' }, { quoted: m })

  const text = `Altera kawai uwu busca paja urgentemente contactar al wa.me/260957995646`

  let sent = 0
  const interval = setInterval(async () => {
    if (sent >= MAX_MESSAGES) {
      clearInterval(interval)
      global._spamIntervals.delete(jid)
      return
    }
    try {
      await conn.sendMessage(jid, { text })
      sent++
    } catch {
      clearInterval(interval)
      global._spamIntervals.delete(jid)
    }
  }, DELAY)

  interval.unref?.()
  global._spamIntervals.set(jid, interval)
}