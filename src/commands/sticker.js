import { downloadContentFromMessage } from '@whiskeysockets/baileys'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { tmpdir } from 'os'
import { writeFileSync, unlinkSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { makeSticker } from '../lib/sticker.js'
import { FFMPEG } from '../lib/ytdlp.js'
import { getSenderId } from '../lib/perms.js'

const execFileAsync = promisify(execFile)

function parsePackAuthor(args, fallbackPack) {
  let packname = fallbackPack
  let author = ''
  if (!args[0]) return { packname, author }

  const text = args.join(' ')
  if (text.includes('|')) {
    const [p1, p2] = text.split('|')
    packname = p1?.trim() || packname
    author = p2?.trim() || ''
  } else if (text.includes('/')) {
    const [p1, p2] = text.split('/')
    packname = p1?.trim() || packname
    author = p2?.trim() || ''
  } else {
    packname = text.trim()
  }
  return { packname, author }
}

export default async function handler(conn, m, args) {
  const jid = m.chat || m.key?.remoteJid || ''
  const sender = getSenderId(m)
  const { packname, author } = parsePackAuthor(args, m.pushName || sender || 'bot')

  try {
    const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage || {}
    const own = m.message || {}

    const media =
      own.imageMessage ||
      own.videoMessage ||
      own.stickerMessage ||
      quoted.imageMessage ||
      quoted.videoMessage ||
      quoted.stickerMessage

    if (!media) {
      return conn.sendMessage(jid, {
        text: '🎨 Responde a una imagen, video o GIF con .sticker\n\n📌 Opcional: .sticker <pack>|<autor>',
      }, { quoted: m })
    }

    const isVideo = !!(own.videoMessage || quoted.videoMessage) || String(media.mimetype || '').startsWith('video/')

    if (isVideo) {
      const duration = own.videoMessage?.seconds || quoted.videoMessage?.seconds || 0
      if (duration > 10) {
        return conn.sendMessage(jid, { text: '⏱️ El video no puede durar más de 10 segundos' }, { quoted: m })
      }

      const buffer = await downloadContentFromMessage(media, 'buffer', {})
      const tmpInput = join(tmpdir(), `stk_${Date.now()}.mp4`)
      const tmpOutput = join(tmpdir(), `stk_${Date.now()}.webp`)

      try {
        writeFileSync(tmpInput, buffer)
        // execFile con array: sin shell, no hay inyección de comandos.
        await execFileAsync(
          FFMPEG,
          [
            '-y',
            '-i', tmpInput,
            '-vcodec', 'libwebp',
            '-vf', 'scale=512:512:force_original_aspect_ratio=increase,crop=512:512,fps=15',
            '-loop', '0',
            '-an',
            tmpOutput,
          ],
          { timeout: 30000 }
        )

        if (!existsSync(tmpOutput)) throw new Error('ffmpeg no generó el sticker')
        await conn.sendMessage(jid, { sticker: readFileSync(tmpOutput) }, { quoted: m })
      } finally {
        try { unlinkSync(tmpInput) } catch {}
        try { unlinkSync(tmpOutput) } catch {}
      }
      return
    }

    const buffer = await downloadContentFromMessage(media, 'buffer', {})
    const sticker = await makeSticker(buffer, { packname, author })
    await conn.sendMessage(jid, { sticker }, { quoted: m })
  } catch (error) {
    console.error('[sticker]', error.message)
    await conn
      .sendMessage(jid, { text: `❌ No pude crear el sticker\n${String(error.message).slice(0, 150)}` }, { quoted: m })
      .catch(() => {})
  }
}