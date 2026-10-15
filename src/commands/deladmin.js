import { isOwner, clean, initDB, getSenderId } from "../lib/perms.js"

export default async function handler(conn, m, args, db) {

  initDB(db)

  const jid = m.chat || m.key?.remoteJid || ""
  const sender = getSenderId(m)

  if (!isOwner(sender)) {
    return conn.sendMessage(jid, {
      text: "⛔ Solo el OWNER puede usar este comando"
    }, { quoted: m })
  }

  const user = m.mentionedJid?.[0] || args[0]
  if (!user) return

  const id = clean(user)
  if (!id) return

  const wasAdmin = db.data.admins.some((a) => clean(a) === id)
  if (!wasAdmin) {
    return conn.sendMessage(jid, { text: 'ℹ️ Ese usuario no es admin del bot' }, { quoted: m })
  }

  db.data.admins = db.data.admins.filter(a => clean(a) !== id)
  global.saveDB?.()

  const contactName = db.contacts?.[id + '@s.whatsapp.net'] || id

  const text = `🗑️ ADMIN REMOVIDO\n\nUsuario: ${contactName}`

  return conn.sendMessage(jid, {
    text
  }, { quoted: m })
}