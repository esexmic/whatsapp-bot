import { requireGroupStaff } from '../lib/guard.js'

export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid
  if (!chat?.endsWith('@g.us')) return

  if (!(await requireGroupStaff(conn, m, db, { label: '.linkrevoke' }))) return

  const code = await conn.groupRevokeInvite(chat)
  if (!code) return conn.sendMessage(chat, { text: '❌ No pude revocar el link' }, { quoted: m })

  conn.sendMessage(chat, { text: `✅ Link revocado\n🔗 Nuevo link:\nhttps://chat.whatsapp.com/${code}\n\n*CKV BOT*` }, { quoted: m })
}
