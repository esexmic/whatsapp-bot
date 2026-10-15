import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { ytDlp, validateUrl } from '../lib/ytdlp.js'

const COOKIES = path.join(process.cwd(), 'src', 'youtube_cookies.txt')

export default async function handler(conn, m, args) {
  const chat = m.chat || m.key?.remoteJid
  const usage = '⚠️ *Uso:* .spotify <link de Spotify>\n\n📌 *Ejemplo:*\n• .spotify https://open.spotify.com/track/xxx'

  const parsed = validateUrl(args[0], ['spotify.com'])
  if (!parsed) return conn.sendMessage(chat, { text: usage }, { quoted: m })

  const url = parsed.toString()

  await conn.sendMessage(chat, { react: { text: '⏳', key: m.key } })

  const tmp = path.join(process.cwd(), 'temp')
  fs.mkdirSync(tmp, { recursive: true })
  const out = path.join(tmp, `spotify_${Date.now()}.mp3`)
  const hasCookies = fs.existsSync(COOKIES)

  try {
    const oembed = await axios.get(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!oembed?.data?.title) throw new Error('No se pudo obtener info de la canción')

    const track = `${oembed.data.title} ${oembed.data.author_name || ''}`.trim()
    await conn.sendMessage(chat, { react: { text: '🎵', key: m.key } })

    // El título viene de un tercero: va como argumento de array, nunca en un shell.
    await ytDlp(['--default-search', 'ytsearch', '-x', '--audio-format', 'mp3', '--audio-quality', '0', '-o', out, `ytsearch:${track}`], {
      cookies: hasCookies ? COOKIES : undefined,
    })

    if (!fs.existsSync(out) || fs.statSync(out).size < 10000) {
      throw new Error('Archivo muy pequeño o no encontrado en YouTube')
    }

    await conn.sendMessage(chat, { react: { text: '✅', key: m.key } })
    await conn.sendMessage(chat, { audio: { url: out }, mimetype: 'audio/mpeg', ptt: false }, { quoted: m })
  } catch (e) {
    await conn.sendMessage(chat, { react: { text: '❌', key: m.key } }).catch(() => {})
    const msg = e.stderr?.toString() || e.stdout?.toString() || e.message || ''
    conn.sendMessage(chat, { text: `❌ No pude descargar\n${msg.slice(0, 300).trim()}` }, { quoted: m })
  } finally {
    try { fs.unlinkSync(out) } catch {}
  }
}