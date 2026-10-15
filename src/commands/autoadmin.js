import { getSenderId, clean } from '../lib/perms.js'

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''
  const sender = getSenderId(m)

  const groupMetadata = await conn.groupMetadata(jid).catch(() => null)
  if (!groupMetadata) {
    return conn.sendMessage(jid, { text: '⚠️ Solo funciona en grupos' }, { quoted: m })
  }

  const senderJid = m.key?.participant || m.message?.extendedTextMessage?.contextInfo?.participant || sender + '@s.whatsapp.net'
  const senderClean = clean(senderJid)

  const isAlreadyAdmin = groupMetadata.participants.some(p => clean(p.id) === senderClean && (p.admin === 'admin' || p.admin === 'superadmin'))
  if (isAlreadyAdmin) {
    return conn.sendMessage(jid, { text: 'ℹ️ Ya eres admin del grupo' }, { quoted: m })
  }

  try {
    await conn.groupParticipantsUpdate(jid, [senderJid], 'promote')
    await conn.sendMessage(jid, { text: '⭐ Ahora eres admin del grupo\n\n*CKV BOT*' }, { quoted: m })
  } catch (e) {
    console.error('Error en autoadmin:', e)
    await conn.sendMessage(jid, { text: '❌ No pude promoverte. Asegúrate de que el bot sea admin del grupo.' }, { quoted: m })
  }
}
