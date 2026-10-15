import { requireStaff } from '../lib/guard.js'

export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid
  if (!chat?.endsWith('@g.us')) return

  if (!(await requireStaff(conn, m, db, { label: '.antilink' }))) return

  const action = args[0]
  if (!action || !['on', 'off'].includes(action)) {
    return conn.sendMessage(chat, { text: '⚠️ Uso: .antilink on / off' }, { quoted: m })
  }

  const list = global.db.config.antilink || []
  if (action === 'on') {
    if (!list.includes(chat)) list.push(chat)
    global.db.config.antilink = list
    global.saveDB?.()
    conn.sendMessage(chat, { text: '✅ Antilink activado\n\n*CKV BOT*' }, { quoted: m })
  } else {
    global.db.config.antilink = list.filter(g => g !== chat)
    global.saveDB?.()
    conn.sendMessage(chat, { text: '✅ Antilink desactivado\n\n*CKV BOT*' }, { quoted: m })
  }
}
