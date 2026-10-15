import { isOwner, getSenderId } from '../lib/perms.js'

export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid
  const sender = getSenderId(m)
  if (!isOwner(sender)) return conn.sendMessage(chat, { text: '⛔ Solo owners' }, { quoted: m })

  const name = args.join(' ')
  if (!name) return conn.sendMessage(chat, { text: '⚠️ Uso: .setname <nombre>' }, { quoted: m })

  global.db.config.botName = name
  global.saveDB?.()
  conn.sendMessage(chat, { text: `✅ Nombre del bot cambiado a *${name}*\n\n*CKV BOT*` }, { quoted: m })
}
