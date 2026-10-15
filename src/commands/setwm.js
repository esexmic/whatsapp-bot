import { isOwner } from '../lib/perms.js'

export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid
  const sender = m.key?.participant || m.key?.remoteJid
  if (!isOwner(sender)) return conn.sendMessage(chat, { text: '⛔ Solo owners' }, { quoted: m })

  const text = args.join(' ')
  if (!text || !text.includes('|')) {
    return conn.sendMessage(chat, { text: '⚠️ Uso: .setwm <pack>|<author>\nEj: .setwm CKV|xyb' }, { quoted: m })
  }

  const [pack, author] = text.split('|').map(s => s.trim())
  global.db.config.stickerPack = pack || 'CKV'
  global.db.config.stickerAuthor = author || 'xyb'
  global.saveDB?.()
  conn.sendMessage(chat, { text: `✅ Sticker WM actualizado\n📦 Pack: *${global.db.config.stickerPack}*\n👤 Author: *${global.db.config.stickerAuthor}*\n\n*CKV BOT*` }, { quoted: m })
}
