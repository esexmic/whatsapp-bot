import { getSenderId, clean } from '../lib/perms.js'
import { canUse } from '../lib/roles.js'

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''
  const sender = getSenderId(m)

  // Owner, bot-admin, o WhatsApp group admin pueden usar unmute
  const groupMetadata = await conn.groupMetadata(jid).catch(() => null)
  if (!groupMetadata) {
    return conn.sendMessage(jid, { text: '⚠️ Solo funciona en grupos' }, { quoted: m })
  }

  const senderParticipant = groupMetadata.participants?.find(p => clean(p.id) === sender)
  const isGroupAdmin = senderParticipant && (senderParticipant.admin === 'admin' || senderParticipant.admin === 'superadmin')

  if (!canUse(sender, ['owner', 'admin'], db) && !isGroupAdmin) {
    return conn.sendMessage(jid, {
      text: '⛔ Solo el owner, admins del bot, o admins del grupo pueden usar este comando'
    }, { quoted: m })
  }

  const ctx = m.message?.extendedTextMessage?.contextInfo
  let target = ctx?.participant || ctx?.mentionedJid?.[0]

  if (!target) {
    return conn.sendMessage(jid, {
      text: '⚠️ Responde a alguien o menciónalo para desmutearlo'
    }, { quoted: m })
  }

  const targetId = target.split('@')[0].split(':')[0] + '@s.whatsapp.net'

  if (!db.data.muted) db.data.muted = []
  if (!db.data.muted.includes(targetId)) {
    return conn.sendMessage(jid, {
      text: '⚠️ Este usuario no está muteado'
    }, { quoted: m })
  }

  db.data.muted = db.data.muted.filter(id => id !== targetId)
  global.saveDB?.()

  const name = db.contacts?.[targetId] || targetId.split('@')[0]
  return conn.sendMessage(jid, {
    text: `🔊 *${name}* desmuteado\n\n*CKV BOT*`
  }, { quoted: m })
}
