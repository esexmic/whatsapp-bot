import { clean } from '../lib/perms.js'

function normalize(jid) {
  if (!jid) return ''
  return jid.split('@')[0].split(':')[0] + '@s.whatsapp.net'
}

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''
  if (!jid.endsWith('@g.us')) {
    return conn.sendMessage(jid, { text: '⚠️ Este comando solo funciona en grupos' }, { quoted: m })
  }

  if (!db.data) db.data = {}
  if (!db.data.afk) db.data.afk = {}

  const userKey = normalize(m.key?.participant || m.key?.remoteJid)
  if (!userKey) return

  const existing = db.data.afk[userKey]
  if (existing) {
    const elapsed = Math.floor((Date.now() - existing.since) / 1000)
    const mins = Math.floor(elapsed / 60)
    const secs = elapsed % 60
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`

    delete db.data.afk[userKey]
    global.saveDB?.()

    return conn.sendMessage(jid, {
      text: `✨ Bienvenido de vuelta!\n\nEstuviste AFK durante ${timeStr}`
    }, { quoted: m })
  }

  const reason = args.length > 0 ? args.join(' ') : 'Sin motivo'
  const name = db.contacts?.[userKey] || m.pushName || userKey.split('@')[0]

  db.data.afk[userKey] = { name, reason, since: Date.now() }
  global.saveDB?.()

  return conn.sendMessage(jid, {
    text: `🛌 *AFK*\n\n${name} ahora está AFK\n📝 ${reason}`
  }, { quoted: m })
}