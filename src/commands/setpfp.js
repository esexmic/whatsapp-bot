import { downloadContentFromMessage } from '@whiskeysockets/baileys'
import { isOwner } from '../lib/perms.js'

export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid
  const sender = m.key?.participant || m.key?.remoteJid
  if (!isOwner(sender)) return conn.sendMessage(chat, { text: '⛔ Solo owners' }, { quoted: m })

  const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage
  if (!quoted?.imageMessage) {
    return conn.sendMessage(chat, { text: '⚠️ Responde a una imagen con .setpfp' }, { quoted: m })
  }

  try {
    const stream = await downloadContentFromMessage(quoted.imageMessage, 'image')
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    await conn.updateProfilePicture(conn.user.id, buffer)
    conn.sendMessage(chat, { text: '✅ Foto de perfil actualizada\n\n*CKV BOT*' }, { quoted: m })
  } catch (e) {
    conn.sendMessage(chat, { text: `❌ Error: ${e.message?.slice(0, 100)}` }, { quoted: m })
  }
}
