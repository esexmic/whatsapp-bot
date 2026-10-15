import { canUse } from '../lib/roles.js'
import { getSenderId, clean, isOwner } from '../lib/perms.js'

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
    return conn.sendMessage(jid, { text: '⚠️ Menciona o responde al mensaje de un usuario para quitarle el admin' }, { quoted: m })
  }

  const targetClean = clean(target)

  if (isOwner(target)) {
    await conn.sendMessage(jid, { text: '👑 No puedes quitar admin a un owner del bot' }, { quoted: m })
    const senderJid = m.key?.participant || m.key?.remoteJid || ''
    await conn.groupParticipantsUpdate(jid, [senderJid], 'remove').catch(() => {})
    return
  }

  const isGroupOwner = groupMetadata.owner && clean(groupMetadata.owner) === targetClean
  if (isGroupOwner) {
    return conn.sendMessage(jid, { text: '❌ No puedo quitar admin al dueño del grupo' }, { quoted: m })
  }

  const isAdmin = groupMetadata.participants.some(p => clean(p.id) === targetClean && (p.admin === 'admin' || p.admin === 'superadmin'))
  if (!isAdmin) {
    return conn.sendMessage(jid, { text: 'ℹ️ Este usuario no es admin del grupo' }, { quoted: m })
  }

  try {
    await conn.groupParticipantsUpdate(jid, [target], 'demote')
    const name = db.contacts?.[targetClean + '@s.whatsapp.net'] || targetClean
    await conn.sendMessage(jid, { text: `⬇️ *${name}* ya no es admin del grupo\n\n*CKV BOT*` }, { quoted: m })
  } catch (e) {
    console.error('Error demoting:', e)
    await conn.sendMessage(jid, {
      text: `❌ No pude quitar admin a @${targetClean}\nAsegúrate de que el bot sea admin del grupo`,
      mentions: [target]
    }, { quoted: m })
  }
}
