import { isOwner } from '../lib/perms.js'

export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid
  const sender = m.key?.participant || m.key?.remoteJid
  if (!isOwner(sender)) return conn.sendMessage(chat, { text: '⛔ Solo owners' }, { quoted: m })

  const text = args.join(' ')
  if (!text) return conn.sendMessage(chat, { text: '⚠️ *Uso:* .bc <mensaje>\n\n📌 Envía un mensaje a todos los grupos donde está el bot' }, { quoted: m })

  await conn.sendMessage(chat, { react: { text: '⏳', key: m.key } })

  let sent = 0
  let failed = 0

  try {
    const groups = await conn.groupFetchAllParticipating()
    const groupIds = Object.keys(groups)

    for (const jid of groupIds) {
      try {
        await conn.sendMessage(jid, { text: `📢 *COMUNICADO*\n\n${text}` })
        sent++
      } catch { failed++ }
      await new Promise(r => setTimeout(r, 300))
    }
  } catch (e) {
    return conn.sendMessage(chat, { text: `❌ Error al obtener grupos: ${e.message?.slice(0, 100)}` }, { quoted: m })
  }

  await conn.sendMessage(chat, { react: { text: '✅', key: m.key } })
  conn.sendMessage(chat, { text: `✅ Broadcast enviado a ${sent} grupos${failed ? `, ${failed} fallaron` : ''}\n\n*CKV BOT*` }, { quoted: m })
}
