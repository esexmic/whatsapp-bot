import { requireStaff } from '../lib/guard.js'

export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid
  if (!chat?.endsWith('@g.us')) return

  if (!(await requireStaff(conn, m, db, { label: '.goodbye' }))) return

  const text = args.join(' ')
  if (!text || text === 'off') {
    if (text === 'off') {
      delete global.db.config.goodbye[chat]
      global.saveDB?.()
      return conn.sendMessage(chat, { text: '✅ Despedida desactivada\n\n*CKV BOT*' }, { quoted: m })
    }
    return conn.sendMessage(chat, { text: '⚠️ Uso: .goodbye <texto> o .goodbye off\nUsa @user para mencionar' }, { quoted: m })
  }

  global.db.config.goodbye[chat] = text
  global.saveDB?.()
  conn.sendMessage(chat, { text: `✅ Mensaje de despedida activado\n\n*CKV BOT*` }, { quoted: m })
}
