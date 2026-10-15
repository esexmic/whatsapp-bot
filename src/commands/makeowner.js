import { isOwner, getSenderId, clean } from '../lib/perms.js'

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''
  const sender = getSenderId(m)

  if (!isOwner(sender)) {
    return conn.sendMessage(jid, {
      text: '🔒 Solo el owner puede usar este comando'
    }, { quoted: m })
  }

  const ctx = m.message?.extendedTextMessage?.contextInfo
  let target = ctx?.mentionedJid?.[0] || ctx?.participant || null
  if (!target) {
    return conn.sendMessage(jid, {
      text: '⚠️ Menciona o responde al usuario que quieres hacer owner'
    }, { quoted: m })
  }

  const targetClean = clean(target)

  if (!global._extraOwners) global._extraOwners = []

  if (isOwner(targetClean) || global._extraOwners.includes(targetClean)) {
    return conn.sendMessage(jid, {
      text: '⚠️ Ese usuario ya es owner'
    }, { quoted: m })
  }

  global._extraOwners.push(targetClean)
  if (global.saveDB) global.saveDB()

  return conn.sendMessage(jid, {
    text: `✅ @${targetClean} ahora es owner`,
    mentions: [target]
  }, { quoted: m })
}
