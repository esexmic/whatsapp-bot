import { getSenderId } from '../lib/perms.js'
import { canUse } from '../lib/roles.js'

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''
  const ctx = m.message?.extendedTextMessage?.contextInfo

  if (!ctx?.stanzaId || !ctx?.participant) {
    return conn.sendMessage(jid, {
      text: '⚠️ Responde a un mensaje con .del para eliminarlo'
    }, { quoted: m })
  }

  const repliedFromMe = ctx?.remoteJid === jid && ctx?.participant?.includes(conn.user?.id?.split(':')[0])

  if (!repliedFromMe) {
    const sender = getSenderId(m)
    if (!canUse(sender, ['owner', 'admin'], db)) {
      return conn.sendMessage(jid, {
        text: '⛔ Solo el owner o admins pueden eliminar mensajes de otros'
      }, { quoted: m })
    }
  }

  try {
    await conn.sendMessage(jid, {
      delete: {
        remoteJid: jid,
        fromMe: repliedFromMe,
        id: ctx.stanzaId,
        participant: ctx.participant
      }
    })
    return conn.sendMessage(jid, {
      text: '🗑️ Mensaje eliminado'
    }, { quoted: m })
  } catch (e) {
    console.log("DEL error:", e)
    return conn.sendMessage(jid, {
      text: '❌ No pude eliminar el mensaje. Asegúrate de que el bot sea admin.'
    }, { quoted: m })
  }
}