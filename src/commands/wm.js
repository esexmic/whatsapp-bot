import { downloadContentFromMessage } from '@whiskeysockets/baileys'
import { makeSticker } from '../lib/sticker.js'
import { getSenderId } from '../lib/perms.js'

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''
  const sender = getSenderId(m)

  let packname = m.pushName || sender || 'bot'
  let author = ''

  if (args[0]) {
    const text = args.join(' ')
    if (text.includes('/') || text.includes('|')) {
      const sep = text.includes('/') ? '/' : '|'
      const [p1, p2] = text.split(sep)
      packname = p1?.trim() || packname
      author = p2?.trim() || ''
    } else {
      packname = text.trim()
      author = ''
    }
  }

  let sticker = null
  try {
    const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const message = m.message || {}
    const targetMsg = quotedMsg || message

    const mime = targetMsg.imageMessage?.mimetype || targetMsg.videoMessage?.mimetype || targetMsg.stickerMessage?.mimetype || ''

    if (!mime || !/webp|image|video/g.test(mime)) {
      return conn.sendMessage(jid, { text: '🖼️ Responde a una imagen, video o sticker con .wm' }, { quoted: m })
    }

    if (/video/g.test(mime)) {
      const duration = targetMsg.videoMessage?.seconds || 0
      if (duration > 8) {
        return conn.sendMessage(jid, { text: '⏱️ El video no puede durar más de 8 segundos' }, { quoted: m })
      }
    }

    const media = targetMsg.imageMessage
      ? targetMsg.imageMessage
      : targetMsg.videoMessage
        ? targetMsg.videoMessage
        : targetMsg.stickerMessage
    const buffer = await downloadContentFromMessage(media, 'buffer', {})

    sticker = await makeSticker(buffer, { packname, author })

    if (sticker) {
      await conn.sendMessage(jid, { sticker }, { quoted: m })
    } else {
      throw new Error('No se pudo procesar el sticker')
    }
  } catch (error) {
    console.error('[wm]', error.message)
    await conn.sendMessage(jid, { text: '❌ No pude cambiar el nombre del sticker' }, { quoted: m })
  }
}
