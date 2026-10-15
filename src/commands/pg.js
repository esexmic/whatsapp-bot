import { getSenderId } from '../lib/perms.js'
import { canUse } from '../lib/roles.js'

function normalize(jid) {
  if (!jid) return ''
  return jid.split('@')[0].split(':')[0] + '@s.whatsapp.net'
}

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''
  const sender = getSenderId(m)

  if (!canUse(sender, ['owner', 'admin'], db)) {
    return conn.sendMessage(jid, {
      text: '⛔ Solo el owner o admins pueden usar este comando'
    }, { quoted: m })
  }

  const chat = jid
  const trackerSender = normalize(m.key?.participant || m.key?.remoteJid)
  const keys = global._msgLog?.[chat]?.[trackerSender]

  if (!keys || keys.length === 0) {
    return conn.sendMessage(jid, {
      text: '⚠️ No hay mensajes recientes para eliminar'
    }, { quoted: m })
  }

  const toDelete = keys.splice(-10)

  // Before deleting, move messages to _snipes
  if (!global._snipes) global._snipes = {}
  for (const k of toDelete) {
    if (global._msgStore?.[k.id]) {
      if (!global._snipes[chat]) global._snipes[chat] = []
      global._snipes[chat].unshift(global._msgStore[k.id])
      if (global._snipes[chat].length > 5) global._snipes[chat].pop()
      delete global._msgStore[k.id]
    }
  }

  let deleted = 0

  for (const k of toDelete) {
    try {
      await conn.sendMessage(chat, {
        delete: {
          remoteJid: chat,
          fromMe: k.fromMe,
          id: k.id,
          participant: k.participant
        }
      })
      deleted++
    } catch (e) {
      console.log("PG delete error:", e)
    }
  }

  return conn.sendMessage(jid, {
    text: `🧹 Eliminados ${deleted} mensajes`
  }, { quoted: m })
}