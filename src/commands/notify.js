import { requireStaff } from '../lib/guard.js'

const COOLDOWN_MS = 60000

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''

  if (!(await requireStaff(conn, m, db, { label: '.n' }))) return

  const quotedMsg = m.message?.extendedTextMessage?.contextInfo
  const quotedText = quotedMsg?.quotedMessage?.conversation
    || quotedMsg?.quotedMessage?.extendedTextMessage?.text
    || quotedMsg?.quotedMessage?.imageMessage?.caption
    || quotedMsg?.quotedMessage?.videoMessage?.caption
    || null

  let text
  if (args.length) {
    text = args.join(' ')
  } else if (quotedText) {
    text = quotedText
  } else {
    return conn.sendMessage(jid, {
      text: '✏️ Uso: .n <texto> o responde a un mensaje con .n'
    }, { quoted: m })
  }

  const groupMetadata = await conn.groupMetadata(jid).catch(() => null)
  if (!groupMetadata) {
    return conn.sendMessage(jid, {
      text: '⚠️ Solo funciona en grupos'
    }, { quoted: m })
  }

  const botJid = conn.user?.id || conn.user?.jid || ''
  const participants = groupMetadata.participants || []
  const mentions = participants
    .filter(p => p.id !== botJid)
    .map(p => p.id)

  // Mención masiva: cooldown por chat para no llevar la cuenta a un baneo.
  if (!global._massCooldown) global._massCooldown = new Map()
  const last = global._massCooldown.get(jid) || 0
  if (Date.now() - last < COOLDOWN_MS) {
    const secs = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000)
    return conn.sendMessage(jid, { text: `⏳ Espera ${secs}s antes de volver a mencionar a todos.` }, { quoted: m })
  }
  global._massCooldown.set(jid, Date.now())

  await conn.sendMessage(jid, { text, mentions }, { quoted: m })
}
