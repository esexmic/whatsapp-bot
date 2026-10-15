import { isOwner } from '../lib/perms.js'

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''
  const sender = m.key?.participant || m.key?.remoteJid || ''

  if (!isOwner(sender)) {
    return conn.sendMessage(jid, { text: 'Solo owners.' }, { quoted: m })
  }

  if (!args[0]) {
    return conn.sendMessage(jid, { text: 'Uso: .cmdoff <comando>' }, { quoted: m })
  }

  const cmd = args[0].toLowerCase().replace(/^[.!]/, '')

  if (!global._disabledCmds) global._disabledCmds = new Map()
  if (global._disabledCmds.has(cmd)) {
    return conn.sendMessage(jid, {
      text: `"${cmd}" ya está desactivado.`
    }, { quoted: m })
  }

  global._disabledCmds.set(cmd, sender)

  await conn.sendMessage(jid, {
    text: `"${cmd}" desactivado.`
  }, { quoted: m })
}
