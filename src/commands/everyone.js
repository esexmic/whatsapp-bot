import { requireStaff } from '../lib/guard.js'

const COOLDOWN_MS = 60000

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''

  const groupMetadata = await conn.groupMetadata(jid).catch(() => null)
  if (!groupMetadata) {
    return conn.sendMessage(jid, {
      text: '⚠️ Este comando solo funciona en grupos'
    }, { quoted: m })
  }

  if (!(await requireStaff(conn, m, db, { label: '.everyone' }))) return

  // Mentionar a todos puede llevar a un baneo: cooldown por chat.
  if (!global._massCooldown) global._massCooldown = new Map()
  const last = global._massCooldown.get(jid) || 0
  if (Date.now() - last < COOLDOWN_MS) {
    const secs = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000)
    return conn.sendMessage(jid, { text: `⏳ Espera ${secs}s antes de volver a mencionar a todos.` }, { quoted: m })
  }
  global._massCooldown.set(jid, Date.now())

  const botJid = conn.user?.id || conn.user?.jid || ''

  const participants = groupMetadata.participants || []
  const mentions = participants
    .filter(p => p.id !== botJid)
    .map(p => p.id)

  if (!mentions.length) {
    return conn.sendMessage(jid, {
      text: '⚠️ No hay participantes para mencionar'
    }, { quoted: m })
  }

  const senderKey = (m.key?.participant || m.key?.remoteJid || '').split('@')[0].split(':')[0] + '@s.whatsapp.net'
  const senderName = db.contacts?.[senderKey] || m.pushName || senderKey.split('@')[0]
  const count = mentions.length

  const text = `📢 *${senderName}* ha invocado a todos (${count})` + '\n' +
    mentions.map(jid => `@${jid.split('@')[0]}`).join(' ')

  await conn.sendMessage(jid, {
    text,
    mentions
  }, { quoted: m })
}
