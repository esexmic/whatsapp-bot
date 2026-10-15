import { isOwner } from '../lib/perms.js'

export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid
  const sender = m.key?.participant || m.key?.remoteJid
  if (!isOwner(sender)) return conn.sendMessage(chat, { text: '⛔ Solo owners' }, { quoted: m })

  const mode = args[0]
  if (!mode || !['public', 'private'].includes(mode)) {
    return conn.sendMessage(chat, { text: '⚠️ Modos: public, private\nUso: .mode <modo>' }, { quoted: m })
  }

  global.db.config.mode = mode
  global.saveDB?.()
  conn.sendMessage(chat, { text: `✅ Modo cambiado a *${mode}*\n${mode === 'private' ? '🔒 Solo owners y admins del bot pueden usar los comandos' : '🌐 Todos pueden usar el bot'}\n\n*CKV BOT*` }, { quoted: m })
}
