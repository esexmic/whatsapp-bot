import { isOwner, getSenderId } from '../lib/perms.js'

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''
  const sender = getSenderId(m)

  if (!isOwner(sender)) {
    return conn.sendMessage(jid, {
      text: '🔒 Solo el owner puede usar este comando'
    }, { quoted: m })
  }

  try {
    if (global.saveDB) {
      global.saveDB()
      conn.sendMessage(jid, { text: '✅ Datos guardados correctamente\n\n*CKV BOT*' }, { quoted: m })
    } else {
      conn.sendMessage(jid, { text: '❌ Función saveDB no disponible' }, { quoted: m })
    }
  } catch (e) {
    conn.sendMessage(jid, { text: `❌ Error al guardar: ${e.message?.slice(0, 100)}` }, { quoted: m })
  }
}
