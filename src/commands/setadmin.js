import { isOwner, clean, initDB, getSenderId } from "../lib/perms.js"

export default async function handler(conn, m, args, db) {

  initDB(db)

  const jid = m.chat || m.key?.remoteJid || ""
  const sender = getSenderId(m)

  console.log("📩 sender:", sender)
  console.log("📩 message keys:", JSON.stringify({ remoteJid: m?.key?.remoteJid, participant: m?.key?.participant, sender: m?.sender, chat: m?.chat }, null, 2))

  // 🔥 OWNER CHECK
  if (!isOwner(sender)) {
    return conn.sendMessage(jid, {
      text: "⛔ Solo el OWNER puede dar admins"
    }, { quoted: m })
  }

  const user = m.mentionedJid?.[0] || args[0] || ""
  if (!user) {
    return conn.sendMessage(jid, {
      text: "Uso: .setadmin @usuario"
    }, { quoted: m })
  }

  const rawCandidate = String(user)
  const id = clean(rawCandidate)

  console.log("🎯 target raw:", rawCandidate)
  console.log("🎯 target clean:", id)

  if (!id) {
    return conn.sendMessage(jid, {
      text: "❌ No pude obtener un número válido para asignar admin"
    }, { quoted: m })
  }

  if (!db.data.admins.includes(id)) {
    db.data.admins.push(id)
    if (global.saveDB) global.saveDB()
  }

  const contactName = db.contacts?.[id + '@s.whatsapp.net'] || id

  const text = `✅ ADMIN AGREGADO\n\nUsuario: ${contactName}`

  return conn.sendMessage(jid, {
    text
  }, { quoted: m })
}