import { isOwner } from '../lib/perms.js'

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''

  const groupMetadata = await conn.groupMetadata(jid).catch(() => null)
  if (!groupMetadata) {
    return conn.sendMessage(jid, {
      text: '⚠️ Este comando solo funciona en grupos'
    }, { quoted: m })
  }

  const botJid = conn.user?.jid || conn.user?.id || ''
  const senderJid = m.key?.participant || m.key?.remoteJid || ''
  const ctx = m.message?.extendedTextMessage?.contextInfo
  const ownerGroup = groupMetadata.owner || jid.split('-')[0] + '@s.whatsapp.net'

  let usersToKick = []

  if (ctx?.mentionedJid?.length) {
    usersToKick.push(...ctx.mentionedJid)
  }

  if (ctx?.participant && !usersToKick.includes(ctx.participant)) {
    usersToKick.push(ctx.participant)
  }

  if (!usersToKick.length) {
    return conn.sendMessage(jid, {
      text: '⚠️ Menciona a alguien o responde a un mensaje'
    }, { quoted: m })
  }

  let kicked = []
  let errors = []

  for (let user of usersToKick) {
    if (user === botJid) {
      errors.push('🤖 No puedo eliminarme a mí mismo')
      continue
    }
    if (user === ownerGroup) {
      errors.push('👑 No puedo sacar al dueño del grupo')
      continue
    }
    if (isOwner(user)) {
      await conn.groupParticipantsUpdate(jid, [senderJid], 'remove').catch(() => {})
      return conn.sendMessage(jid, { text: '👑 No puedes sacar a un owner del bot' }, { quoted: m })
    }

    try {
      await conn.groupParticipantsUpdate(jid, [user], 'remove')
      kicked.push(user)
    } catch (e) {
      errors.push(`⚠️ @${user.split('@')[0]}`)
    }
  }

  function getName(jid) {
    const key = jid.split('@')[0].split(':')[0] + '@s.whatsapp.net'
    return db.contacts?.[key] || conn.contacts?.[key]?.notify || key.split('@')[0]
  }

  let parts = []
  if (kicked.length) {
    parts.push(`👢 *Expulsados:*\n` + kicked.map(u => `• ${getName(u)}`).join('\n'))
  }
  if (errors.length) {
    parts.push(`❌ *No expulsados:*\n` + errors.join('\n'))
  }
  parts.push('*CKV BOT*')
  await conn.sendMessage(jid, { text: parts.join('\n\n') }, { quoted: m })
}
