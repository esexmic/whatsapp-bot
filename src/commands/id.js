import { getSenderId, clean } from '../lib/perms.js'

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''

  const ctx = m.message?.extendedTextMessage?.contextInfo
  const target = ctx?.mentionedJid?.[0] || ctx?.participant || null

  if (target) {
    return conn.sendMessage(jid, { text: `@${target.split('@')[0]} → ${target}` }, { quoted: m })
  }

  const senderJid = m.key?.participant || m.key?.remoteJid || ''
  return conn.sendMessage(jid, { text: `Tu JID: ${senderJid}` }, { quoted: m })
}
