import { execFile } from 'child_process'
import { promisify } from 'util'
import { makeSticker } from '../lib/sticker.js'
import { makeAnimatedSticker } from '../lib/animated-sticker.js'
import { downloadMediaBuffer, findMedia } from '../lib/media.js'
import { parseStickerOptions } from '../lib/sticker-options.js'
import { FFMPEG } from '../lib/ytdlp.js'
import { getSenderId } from '../lib/perms.js'

const execFileAsync = promisify(execFile)

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''
  const sender = getSenderId(m)
  const { packname, author } = parseStickerOptions(args, {
    packname: db?.config?.stickerPack || m.pushName || sender || 'bot',
    author: db?.config?.stickerAuthor || '',
  })

  try {
    const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage || {}
    const own = m.message || {}
    const media = findMedia(own) || findMedia(quoted)

    if (!media) {
      return conn.sendMessage(jid, {
        text: '🎨 Responde a una imagen, video o GIF con .sticker\n\n📌 Opcional: .sticker <pack>|<autor>',
      }, { quoted: m })
    }

    const isVideo = media.type === 'video'

    if (isVideo) {
      const duration = own.videoMessage?.seconds || quoted.videoMessage?.seconds || 0
      if (duration > 10) {
        return conn.sendMessage(jid, { text: '⏱️ El video no puede durar más de 10 segundos' }, { quoted: m })
      }

      const buffer = await downloadMediaBuffer(media.content, media.type)
      const sticker = await makeAnimatedSticker(buffer, { packname, author, maxDuration: 10 })
      await conn.sendMessage(jid, { sticker }, { quoted: m })
      return
    }

    const buffer = await downloadMediaBuffer(media.content, media.type)
    const sticker = await makeSticker(buffer, { packname, author })
    await conn.sendMessage(jid, { sticker }, { quoted: m })
  } catch (error) {
    console.error('[sticker]', error.message)
    await conn
      .sendMessage(jid, { text: `❌ No pude crear el sticker\n${String(error.message).slice(0, 150)}` }, { quoted: m })
      .catch(() => {})
  }
}