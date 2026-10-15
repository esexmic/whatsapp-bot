import { canUse } from '../lib/roles.js'
import { getSenderId, clean } from '../lib/perms.js'

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''
  const sender = getSenderId(m)

  const groupMetadata = await conn.groupMetadata(jid).catch(() => null)
  if (!groupMetadata) {
    return conn.sendMessage(jid, { text: '⚠️ Solo funciona en grupos' }, { quoted: m })
  }

  const participant = groupMetadata.participants.find(p => clean(p.id) === sender)
  const isGroupAdmin = participant && (participant.admin === 'admin' || participant.admin === 'superadmin')

  if (!canUse(sender, ['owner', 'admin'], db) && !isGroupAdmin) {
    return conn.sendMessage(jid, { text: '⛔ Solo owners, admins del bot o admins del grupo pueden usar este comando' }, { quoted: m })
  }

  const ctx = m.message?.extendedTextMessage?.contextInfo
  const target = ctx?.mentionedJid?.[0] || ctx?.participant || null

  if (!target) {
    return conn.sendMessage(jid, { text: '⚠️ Menciona o responde al mensaje de un usuario para promoverlo' }, { quoted: m })
  }

  const targetClean = clean(target)
  const isAlreadyAdmin = groupMetadata.participants.some(p => clean(p.id) === targetClean && (p.admin === 'admin' || p.admin === 'superadmin'))
  if (isAlreadyAdmin) {
    return conn.sendMessage(jid, { text: 'ℹ️ Este usuario ya es admin del grupo' }, { quoted: m })
  }

  try {
    await conn.groupParticipantsUpdate(jid, [target], 'promote')
    const name = db.contacts?.[targetClean + '@s.whatsapp.net'] || targetClean
    await conn.sendMessage(jid, { text: `⭐ *${name}* ahora es admin del grupo\n\n*CKV BOT*` }, { quoted: m })
  } catch (e) {
    console.error('Error promoting:', e)
    await conn.sendMessage(jid, {
      text: `❌ No pude promover a @${targetClean}\nAsegúrate de que el bot sea admin del grupo`,
      mentions: [target]
    }, { quoted: m })
  }
}
