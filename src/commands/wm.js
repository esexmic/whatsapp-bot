import { makeSticker } from '../lib/sticker.js'
import { makeAnimatedSticker } from '../lib/animated-sticker.js'
import { downloadMediaBuffer, findMedia } from '../lib/media.js'
import { parseStickerOptions } from '../lib/sticker-options.js'
import { getSenderId } from '../lib/perms.js'

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''
  const sender = getSenderId(m)
  const { packname, author } = parseStickerOptions(args, {
    packname: db?.config?.stickerPack || m.pushName || sender || 'bot',
    author: db?.config?.stickerAuthor || '',
  })

  let sticker = null
  try {
    const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const message = m.message || {}
    const targetMsg = quotedMsg || message
    const media = findMedia(targetMsg)

    if (!media) {
      return conn.sendMessage(jid, { text: '🖼️ Responde a una imagen, video o sticker con .wm' }, { quoted: m })
    }

    if (media.type === 'video') {
      const duration = targetMsg.videoMessage?.seconds || 0
      if (duration > 8) {
        return conn.sendMessage(jid, { text: '⏱️ El video no puede durar más de 8 segundos' }, { quoted: m })
      }
    }

    const buffer = await downloadMediaBuffer(media.content, media.type)
    sticker = media.type === 'video'
      ? await makeAnimatedSticker(buffer, { packname, author, maxDuration: 8 })
      : await makeSticker(buffer, { packname, author })

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
