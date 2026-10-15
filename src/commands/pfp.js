import { clean } from '../lib/perms.js'
import { requireStaff } from '../lib/guard.js'

export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid || ''
  const botJid = conn.user?.id || conn.user?.jid || ''

  let target = null
  const ctx = m.message?.extendedTextMessage?.contextInfo

  if (ctx?.mentionedJid?.length) target = ctx.mentionedJid[0]
  if (!target && ctx?.participant) target = ctx.participant

  if (!target && args.length) {
    const digits = args.join('').replace(/\D/g, '')
    if (digits.length >= 10) target = digits + '@s.whatsapp.net'
    else return conn.sendMessage(chat, { text: '⚠️ Número inválido. Ej: .pfp 525644444644' }, { quoted: m })
  }

  if (!target) target = m.key?.participant || chat

  const targetNum = clean(target)
  if (!targetNum) return
  if (clean(botJid) === targetNum) return // no se roba su propia foto

  // .pfp sobre el bot = cambiarle la foto de perfil al bot: solo owner.
  const isSelf = ctx?.mentionedJid?.some((j) => clean(j) === clean(botJid))
  if (isSelf || (!ctx?.mentionedJid?.length && !ctx?.participant && !args.length && clean(chat) === clean(botJid))) {
    if (!(await requireStaff(conn, m, db, { label: 'cambiar mi foto de perfil' }))) return
  }

  const ppUrl = await conn.profilePictureUrl(target, 'image').catch(() => null)

  if (!ppUrl) {
    return conn.sendMessage(chat, {
      text: `👤 @${targetNum} no tiene foto de perfil o es privada`,
      mentions: [targetNum + '@s.whatsapp.net'],
    }, { quoted: m })
  }

  try {
    await conn.sendMessage(chat, { image: { url: ppUrl }, caption: `Foto de @${targetNum}` }, { quoted: m })
  } catch (e) {
    console.log('[pfp]', e.message)
    await conn.sendMessage(chat, {
      text: `❌ Error al obtener la foto de @${targetNum}`,
      mentions: [targetNum + '@s.whatsapp.net'],
    }, { quoted: m })
  }
}