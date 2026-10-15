import { getSenderId, clean } from '../lib/perms.js'

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''
  const sender = getSenderId(m)

  const groupMetadata = await conn.groupMetadata(jid).catch(() => null)
  if (!groupMetadata) {
    return conn.sendMessage(jid, {
      text: '⚠️ Este comando solo funciona en grupos'
    }, { quoted: m })
  }

  const participant = groupMetadata.participants.find(p => clean(p.id) === sender)
  if (!participant || (participant.admin !== 'admin' && participant.admin !== 'superadmin')) {
    return conn.sendMessage(jid, {
      text: '⛔ Solo administradores del grupo pueden usar este comando'
    }, { quoted: m })
  }

  try {
    await conn.groupSettingUpdate(jid, 'announcement')
    await conn.sendMessage(jid, {
      text: '🔒 Grupo cerrado\n\nSolo admins pueden escribir ahora'
    }, { quoted: m })
  } catch (error) {
    console.error('Error en cerrar:', error)
    await conn.sendMessage(jid, {
      text: '❌ Error: No pude cerrar el grupo. Asegúrate de que el bot sea admin.'
    }, { quoted: m })
  }
}
