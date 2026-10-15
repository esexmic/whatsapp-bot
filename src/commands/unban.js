import { isOwner, isAdmin, clean } from '../lib/perms.js'

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''
  const sender = m.key?.participant || m.key?.remoteJid || ''

  if (!isOwner(sender) && !isAdmin(sender, db)) {
    return conn.sendMessage(jid, {
      text: '🚫 Solo admins y owners pueden desbanear usuarios'
    }, { quoted: m })
  }

  const ctx = m.message?.extendedTextMessage?.contextInfo
  const target = ctx?.mentionedJid?.[0] || ctx?.participant || args[0]

  if (!target) {
    return conn.sendMessage(jid, {
      text: '⚠️ Menciona a alguien o responde a su mensaje\nUso: .unban @usuario'
    }, { quoted: m })
  }

  const cleanTarget = clean(target)

  if (!db.data.banned) db.data.banned = []

  if (!db.data.banned.includes(cleanTarget)) {
    return conn.sendMessage(jid, {
      text: 'ℹ️ Este usuario no está baneado'
    }, { quoted: m })
  }

  db.data.banned = db.data.banned.filter(id => id !== cleanTarget)
  global.saveDB?.()

  const mentionJid = target.includes('@') ? target : cleanTarget + '@s.whatsapp.net'
  const name = db.contacts?.[mentionJid] || conn.contacts?.[mentionJid]?.notify || cleanTarget

  await conn.sendMessage(jid, {
    text: `✅ *${name}* desbaneado\n\n*CKV BOT*`
  }, { quoted: m })
}