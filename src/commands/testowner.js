import { isOwner, getSenderId } from '../lib/perms.js'

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''
  const sender = getSenderId(m)

  if (!isOwner(sender)) {
    return conn.sendMessage(jid, { text: '⛔ Solo owners' }, { quoted: m })
  }

  await conn.sendMessage(jid, { text: 'ya puedes cachar a peruanos' }, { quoted: m })
}
