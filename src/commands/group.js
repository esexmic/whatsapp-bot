import { requireGroupStaff } from '../lib/guard.js'

export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid
  if (!chat?.endsWith('@g.us')) return

  if (!(await requireGroupStaff(conn, m, db, { label: '.group' }))) return

  const action = args[0]
  if (!action || !['open', 'close'].includes(action)) {
    return conn.sendMessage(chat, { text: '⚠️ Uso: .group open / close' }, { quoted: m })
  }

  await conn.groupSettingUpdate(chat, action === 'open' ? 'not_announcement' : 'announcement')
  conn.sendMessage(chat, { text: `✅ Grupo ${action === 'open' ? 'abierto' : 'cerrado'}\n\n*CKV BOT*` }, { quoted: m })
}
