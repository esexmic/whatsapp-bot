import fs from 'fs'
import path from 'path'
import { ytDlp, validateUrl, YT_HOSTS } from '../lib/ytdlp.js'

const COOKIES = path.join(process.cwd(), 'src', 'youtube_cookies.txt')

export default async function handler(conn, m, args) {
  const chat = m.chat || m.key?.remoteJid
  const usage =
    '⚠️ *Uso:* .ytmp3 <link de YouTube>\n\n📌 *Ejemplos:*\n• .ytmp3 https://youtu.be/xxx\n• .ytmp3 https://youtube.com/watch?v=xxx'

  const parsed = validateUrl(args[0], YT_HOSTS)
  if (!parsed) return conn.sendMessage(chat, { text: usage }, { quoted: m })

  const url = parsed.toString()

  await conn.sendMessage(chat, { react: { text: '⏳', key: m.key } })

  const tmp = path.join(process.cwd(), 'temp')
  fs.mkdirSync(tmp, { recursive: true })
  const out = path.join(tmp, `yt_${Date.now()}.mp3`)
  const hasCookies = fs.existsSync(COOKIES)

  try {
    await ytDlp(
      [
        '--geo-bypass',
        '-x',
        '--audio-format',
        'mp3',
        '--audio-quality',
        '0',
        '--print',
        'after_move:filepath',
        '-o',
        out,
        url,
      ],
      { cookies: hasCookies ? COOKIES : undefined }
    )

    if (!fs.existsSync(out) || fs.statSync(out).size < 5000) {
      throw new Error('Audio muy pequeño o vacío')
    }

    await conn.sendMessage(chat, { react: { text: '✅', key: m.key } })
    await conn.sendMessage(chat, { audio: { url: out }, mimetype: 'audio/mpeg', ptt: false }, { quoted: m })
  } catch (e) {
    await conn.sendMessage(chat, { react: { text: '❌', key: m.key } }).catch(() => {})
    const msg = (e.stderr?.toString() || e.stdout?.toString() || e.message || '')
    if (/sign in|login|cookies|429|bot/i.test(msg) && !hasCookies) {
      conn.sendMessage(
        chat,
        {
          text: '❌ YouTube bloqueó la descarga.\n\n💡 Usa .ytcookies para subir cookies de YouTube:\n1. Chrome > extensión Get cookies.txt LOCALLY\n2. Ve a youtube.com, inicia sesión\n3. Exporta cookies\n4. Envía el .txt al chat y responde .ytcookies',
        },
        { quoted: m }
      )
    } else {
      conn.sendMessage(chat, { text: `❌ Error\n${msg.slice(0, 300).trim() || 'desconocido'}` }, { quoted: m })
    }
  } finally {
    try { fs.unlinkSync(out) } catch {}
  }
}