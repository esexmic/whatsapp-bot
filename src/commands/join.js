import { proto } from '@whiskeysockets/baileys'
import { requireStaff } from '../lib/guard.js'

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''
  const sender = m.key?.participant || m.key?.remoteJid || ''

  if (!(await requireStaff(conn, m, db, { label: '.join' }))) return

  const link = args[0]
  if (!link || !link.includes('chat.whatsapp.com/')) {
    return conn.sendMessage(jid, {
      text: '⚠️ Envía un link de grupo\nUso: .join https://chat.whatsapp.com/...'
    }, { quoted: m })
  }

  const raw = link.split('chat.whatsapp.com/')[1] || ''
  const code = raw.split(/[?/\s]/)[0].trim()

  if (!code || code.length < 5) {
    return conn.sendMessage(jid, {
      text: '⚠️ No pude extraer el código del link. Verifica que sea un link válido.'
    }, { quoted: m })
  }

  await conn.sendMessage(jid, { react: { text: '⏳', key: m.key } })

  try {
    let groupJid = null
    try {
      groupJid = await conn.groupAcceptInvite(code)
    } catch (e) {
      const msg = e?.message || ''
      console.log('groupAcceptInvite failed:', msg)
      if (msg.includes('account_reachout_restricted') || msg.includes('restricted')) {
        console.log('Trying V4 fallback...')
        const info = await conn.groupGetInviteInfo(code)
        if (!info?.id) throw new Error('No se pudo resolver la info del grupo')
        const adminJid = sender?.includes('@') ? sender : (sender + '@s.whatsapp.net')
        const inviteMsg = proto.Message.GroupInviteMessage.fromObject({
          inviteCode: code,
          inviteExpiration: Math.floor(Date.now() / 1000) + 86400,
          groupJid: info.id,
          groupName: info.subject || '',
          jpegThumbnail: null,
          caption: null
        })
        await conn.groupAcceptInviteV4(adminJid, inviteMsg)
        groupJid = info.id
      } else {
        throw e
      }
    }

    if (!groupJid) {
      throw new Error('La API retornó vacío — link expirado o grupo lleno')
    }

    const info = await conn.groupMetadata(groupJid)
    await conn.sendMessage(jid, { react: { text: '✅', key: m.key } })
    await conn.sendMessage(jid, {
      text: `✅ Me uní a *${info.subject}* (${info.participants?.length || 0} miembros)\n\n*CKV BOT*`
    }, { quoted: m })
  } catch (e) {
    await conn.sendMessage(jid, { react: { text: '❌', key: m.key } }).catch(() => {})
    console.error('[join]', e.message)
    await conn.sendMessage(jid, {
      text: `❌ No pude unirme al grupo\n• ${e.message || 'Link inválido o expirado'}`
    }, { quoted: m })
  }
}