export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid
  if (!chat) return

  const msgTime = (m.messageTimestamp || 0) * 1000
  const now = Date.now()
  const latency = msgTime ? now - msgTime : 0

  const uptime = process.uptime()
  const d = Math.floor(uptime / 86400)
  const h = Math.floor((uptime % 86400) / 3600)
  const m2 = Math.floor((uptime % 3600) / 60)
  const s = Math.floor(uptime % 60)

  const uptimeStr = d > 0 ? `${d}d ` : ''
  const text = `📶 *PING*\n\n⚡ Latencia: ${latency}ms\n⏱ Activo: ${uptimeStr}${h}h ${m2}m ${s}s\n\n*CKV BOT*`

  await conn.sendMessage(chat, { text }, { quoted: m })
}
