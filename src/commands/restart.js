import { isOwner, getSenderId } from '../lib/perms.js'
import { flushDB } from '../lib/store.js'

export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid
  const sender = getSenderId(m)
  if (!isOwner(sender)) return conn.sendMessage(chat, { text: '⛔ Solo owners' }, { quoted: m })

  await conn.sendMessage(chat, { text: '♻️ Reiniciando...\n\n*CKV BOT*' }, { quoted: m }).catch(() => {})

  // Deja que el mensaje salga antes de morir.
  await new Promise((r) => setTimeout(r, 1500))
  flushDB()
  try {
    conn.end(undefined, true)
  } catch {}
  process.exit(0)
}
